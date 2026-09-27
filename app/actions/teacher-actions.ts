"use server";

import { auth } from "@/auth";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  coachingFeedbacks,
  teacherStudents,
  users,
  weeklyQuestionEntries,
} from "@/db/schema";
import { getCurrentWeekMonday, parseMonday } from "@/lib/week-utils";
import {
  ALL_SUBJECTS,
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";
import { coachingFeedbackSchema } from "@/components/coaching/feedback-schema";

export type TeacherActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      status:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "VALIDATION_FAILED"
        | "DATABASE_ERROR";
      message: string;
    };

export interface AssignedStudent {
  studentId: string;
  studentName: string;
  hasEntriesThisWeek: boolean;
  weekTotalQuestions: number;
  weekNet: number;
}

export interface SubjectSummary {
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  maxQuestions: number;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
}

export interface WeeklySummaryData {
  student: { id: string; name: string };
  weekStart: string;
  subjects: SubjectSummary[];
  totals: {
    solved: number;
    correct: number;
    wrong: number;
    blank: number;
    net: number;
  };
  feedback: { comment: string; createdAt: string } | null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.";
}

function roundNet(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getTeacherId(): Promise<
  | { ok: true; teacherId: string }
  | {
      ok: false;
      status: "UNAUTHORIZED" | "FORBIDDEN";
      message: string;
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      status: "UNAUTHORIZED",
      message: "Oturum açmanız gerekiyor.",
    };
  }
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu işlem için öğretmen yetkisi gerekli.",
    };
  }
  return { ok: true, teacherId: session.user.id };
}

async function isAssigned(
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const rows = await db
    .select({ studentId: teacherStudents.studentId })
    .from(teacherStudents)
    .where(
      and(
        eq(teacherStudents.teacherId, teacherId),
        eq(teacherStudents.studentId, studentId),
      ),
    )
    .limit(1);
  return rows.length === 1;
}

export async function getAssignedStudents(): Promise<
  TeacherActionResult<AssignedStudent[]>
> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const assignments = await db
      .select({
        studentId: teacherStudents.studentId,
        studentName: users.name,
      })
      .from(teacherStudents)
      .innerJoin(users, eq(users.id, teacherStudents.studentId))
      .where(eq(teacherStudents.teacherId, ctx.teacherId))
      .orderBy(users.name);

    const studentIds = assignments.map((a) => a.studentId);
    const weekStart = getCurrentWeekMonday();

    const entries =
      studentIds.length > 0
        ? await db
            .select()
            .from(weeklyQuestionEntries)
            .where(
              and(
                inArray(weeklyQuestionEntries.studentId, studentIds),
                eq(weeklyQuestionEntries.weekStart, weekStart),
              ),
            )
        : [];

    const agg = new Map<string, { total: number; net: number }>();
    for (const e of entries) {
      const current = agg.get(e.studentId) ?? { total: 0, net: 0 };
      current.total += e.correct + e.wrong + e.blank;
      current.net += netScore(e.correct, e.wrong);
      agg.set(e.studentId, current);
    }

    const data: AssignedStudent[] = assignments.map((a) => {
      const s = agg.get(a.studentId);
      return {
        studentId: a.studentId,
        studentName: a.studentName || "İsimsiz öğrenci",
        hasEntriesThisWeek: s !== undefined,
        weekTotalQuestions: s?.total ?? 0,
        weekNet: roundNet(s?.net ?? 0),
      };
    });

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: errorMessage(err),
    };
  }
}

export async function getStudentWeeklySummary(
  studentId: string,
  weekStartArg?: string,
): Promise<TeacherActionResult<WeeklySummaryData>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    if (!(await isAssigned(ctx.teacherId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const weekStart = parseMonday(weekStartArg);

    const [profileRows, rows, feedbackRows] = await Promise.all([
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, studentId))
        .limit(1),
      db
        .select()
        .from(weeklyQuestionEntries)
        .where(
          and(
            eq(weeklyQuestionEntries.studentId, studentId),
            eq(weeklyQuestionEntries.weekStart, weekStart),
          ),
        ),
      db
        .select({
          comment: coachingFeedbacks.comment,
          createdAt: coachingFeedbacks.createdAt,
        })
        .from(coachingFeedbacks)
        .where(
          and(
            eq(coachingFeedbacks.studentId, studentId),
            eq(coachingFeedbacks.teacherId, ctx.teacherId),
            eq(coachingFeedbacks.weekStart, weekStart),
          ),
        )
        .limit(1),
    ]);

    const byKey = new Map(
      rows.map((r) => [`${r.examType}:${r.subjectId}`, r]),
    );

    const subjects: SubjectSummary[] = (["TYT", "AYT"] as const).flatMap(
      (examType) =>
        ALL_SUBJECTS[examType].map((s) => {
          const e = byKey.get(`${examType}:${s.id}`);
          const correct = e?.correct ?? 0;
          const wrong = e?.wrong ?? 0;
          const blank = e?.blank ?? 0;
          return {
            examType,
            subjectId: s.id,
            subjectName: s.name,
            maxQuestions: s.maxQuestions,
            correct,
            wrong,
            blank,
            solved: correct + wrong + blank,
            net: roundNet(netScore(correct, wrong)),
          };
        }),
    );

    const totals = subjects.reduce(
      (acc, s) => {
        acc.solved += s.solved;
        acc.correct += s.correct;
        acc.wrong += s.wrong;
        acc.blank += s.blank;
        acc.net += s.net;
        return acc;
      },
      { solved: 0, correct: 0, wrong: 0, blank: 0, net: 0 },
    );
    totals.net = roundNet(totals.net);

    return {
      success: true,
      data: {
        student: {
          id: studentId,
          name: profileRows[0]?.name || "İsimsiz öğrenci",
        },
        weekStart,
        subjects,
        totals,
        feedback: feedbackRows[0]
          ? {
              comment: feedbackRows[0].comment,
              createdAt: feedbackRows[0].createdAt.toJSON(),
            }
          : null,
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: errorMessage(err),
    };
  }
}

export async function saveCoachingFeedback(
  input: unknown,
  weekStartArg?: string,
): Promise<
  TeacherActionResult<{ id: number; comment: string; weekStart: string }>
> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = coachingFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const { studentId, comment } = parsed.data;
  const weekStart = parseMonday(weekStartArg);

  try {
    if (!(await isAssigned(ctx.teacherId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const saved = await db
      .insert(coachingFeedbacks)
      .values({
        studentId,
        teacherId: ctx.teacherId,
        weekStart,
        comment,
      })
      .onConflictDoUpdate({
        target: [
          coachingFeedbacks.studentId,
          coachingFeedbacks.teacherId,
          coachingFeedbacks.weekStart,
        ],
        set: { comment },
      })
      .returning({
        id: coachingFeedbacks.id,
        comment: coachingFeedbacks.comment,
      });

    return {
      success: true,
      data: {
        id: saved[0].id,
        comment: saved[0].comment,
        weekStart,
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: errorMessage(err),
    };
  }
}