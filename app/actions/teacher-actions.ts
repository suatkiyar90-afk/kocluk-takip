"use server";

import { auth } from "@/auth";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { logActivity } from "@/lib/activity-log";
import {
  coachingFeedbacks,
  curriculumTopics,
  dailyQuestionEntries,
  qaThreads,
  studentDenemeAttempts,
  teacherStudents,
  users,
  weeklyStudyPlans,
  weeklyTargets,
} from "@/db/schema";
import {
  addDaysISO,
  getCurrentWeekMonday,
  parseMonday,
  todayInIstanbul,
} from "@/lib/week-utils";
import { DAY_LONG_LABELS } from "@/lib/study-plan-meta";
import {
  aggregateWeekEntries,
  weekEndOf,
  type DailyEntryLike,
} from "@/lib/week-entries";
import { sendPushNotification } from "@/lib/web-push-helper";
import {
  ALL_SUBJECTS,
  examTypes,
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";
import { coachingFeedbackSchema } from "@/components/coaching/feedback-schema";
import { actionErrorMessage } from "@/lib/action-error";
import { normalizeGradeLevel, type GradeLevel } from "@/lib/grade-config";
import {
  canStaffAccessStudent,
  type StaffRole,
} from "@/lib/student-access";

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
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    studyField: string | null;
    gradeLevel: GradeLevel;
    advisorName: string | null;
  };
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
  return actionErrorMessage(err);
}

function roundNet(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getTeacherId(): Promise<
  | { ok: true; teacherId: string; role: StaffRole }
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
  return {
    ok: true,
    teacherId: session.user.id,
    role: session.user.role === "admin" ? "admin" : "teacher",
  };
}

export async function getAssignedStudents(): Promise<
  TeacherActionResult<AssignedStudent[]>
> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const assignments =
      ctx.role === "admin"
        ? await db
            .select({
              studentId: users.id,
              studentName: users.name,
            })
            .from(users)
            .where(eq(users.role, "student"))
            .orderBy(users.name)
        : await db
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
    const weekEnd = weekEndOf(weekStart);

    interface WeekRow extends DailyEntryLike {
      studentId: string;
    }

    const entries: WeekRow[] =
      studentIds.length > 0
        ? await db
            .select({
              studentId: dailyQuestionEntries.studentId,
              date: dailyQuestionEntries.date,
              correct: dailyQuestionEntries.correct,
              wrong: dailyQuestionEntries.wrong,
              blank: dailyQuestionEntries.blank,
            })
            .from(dailyQuestionEntries)
            .where(
              and(
                inArray(dailyQuestionEntries.studentId, studentIds),
                gte(dailyQuestionEntries.date, weekStart),
                lte(dailyQuestionEntries.date, weekEnd),
              ),
            )
        : [];

    const byStudent = new Map<string, DailyEntryLike[]>();
    for (const e of entries) {
      const list = byStudent.get(e.studentId) ?? [];
      list.push(e);
      byStudent.set(e.studentId, list);
    }

    const data: AssignedStudent[] = assignments.map((a) => {
      const totals = aggregateWeekEntries(
        byStudent.get(a.studentId) ?? [],
        weekStart,
      );
      return {
        studentId: a.studentId,
        studentName: a.studentName || "İsimsiz öğrenci",
        hasEntriesThisWeek: totals.hasEntries,
        weekTotalQuestions: totals.total,
        weekNet: roundNet(totals.net),
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

export interface AttentionStudent {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  gradeLevel: GradeLevel;
  studyField: string | null;
  advisorId: string | null;
  advisorName: string | null;
  weekTotalQuestions: number;
  weekNet: number;
  lastEntryDate: string | null;
  daysSinceEntry: number | null;
  pendingQuestionCount: number;
  oldestPendingWaitingHours: number | null;
}

export interface AttentionStaleItem {
  studentId: string;
  studentName: string;
  daysSinceEntry: number | null;
}

export interface AttentionWaitingItem {
  studentId: string;
  studentName: string;
  pendingCount: number;
  oldestWaitingHours: number;
}

export interface AttentionListData {
  students: AttentionStudent[];
  stale: AttentionStaleItem[];
  waiting: AttentionWaitingItem[];
}

const STALE_DAYS = 3;
const WAITING_HOURS = 48;

function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.floor((from - to) / 86_400_000));
}

export async function getAttentionList(): Promise<
  TeacherActionResult<AttentionListData>
> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const weekStart = getCurrentWeekMonday();
    const weekEnd = weekEndOf(weekStart);
    const today = todayInIstanbul();

    const scope =
      ctx.role === "admin"
        ? eq(users.role, "student")
        : and(
            eq(users.role, "student"),
            inArray(
              users.id,
              db
                .select({ studentId: teacherStudents.studentId })
                .from(teacherStudents)
                .where(eq(teacherStudents.teacherId, ctx.teacherId)),
            ),
          );

    const rows = await db
      .select({
        studentId: users.id,
        studentName: users.name,
        studentNumber: users.studentNumber,
        gradeLevel: users.gradeLevel,
        studyField: users.studyField,
      })
      .from(users)
      .where(scope)
      .orderBy(users.name);

    const [advisorRows, pendingRows] = await Promise.all([
      db
        .select({
          studentId: teacherStudents.studentId,
          advisorId: users.id,
          advisorName: users.name,
        })
        .from(teacherStudents)
        .innerJoin(
          users,
          and(
            eq(users.id, teacherStudents.teacherId),
            eq(users.role, "teacher"),
          ),
        )
        .orderBy(asc(teacherStudents.createdAt)),
      db
        .select({
          studentId: qaThreads.studentId,
          pendingCount: sql<number>`count(*)::int`,
          oldestPendingAt: sql<
            string | null
          >`to_char(min(${qaThreads.createdAt}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
        })
        .from(qaThreads)
        .where(eq(qaThreads.status, "bekliyor"))
        .groupBy(qaThreads.studentId),
    ]);

    const advisorByStudent = new Map<
      string,
      { advisorId: string | null; advisorName: string | null }
    >();
    for (const row of advisorRows) {
      if (!advisorByStudent.has(row.studentId)) {
        advisorByStudent.set(row.studentId, {
          advisorId: row.advisorId,
          advisorName: row.advisorName,
        });
      }
    }

    const pendingByStudent = new Map(
      pendingRows.map((row) => [
        row.studentId,
        {
          pendingCount: Number(row.pendingCount) || 0,
          oldestPendingAt: row.oldestPendingAt ?? null,
        },
      ]),
    );

    const studentIds = rows.map((row) => row.studentId);

    interface WeekRow extends DailyEntryLike {
      studentId: string;
    }

    let weekRows: WeekRow[] = [];
    let lastEntryRows: { studentId: string; lastDate: string | null }[] = [];
    let lastDenemeRows: { studentId: string; lastDate: string | null }[] = [];

    if (studentIds.length > 0) {
      [weekRows, lastEntryRows, lastDenemeRows] = await Promise.all([
        db
          .select({
            studentId: dailyQuestionEntries.studentId,
            date: dailyQuestionEntries.date,
            correct: dailyQuestionEntries.correct,
            wrong: dailyQuestionEntries.wrong,
            blank: dailyQuestionEntries.blank,
          })
          .from(dailyQuestionEntries)
          .where(
            and(
              inArray(dailyQuestionEntries.studentId, studentIds),
              gte(dailyQuestionEntries.date, weekStart),
              lte(dailyQuestionEntries.date, weekEnd),
            ),
          ),
        db
          .select({
            studentId: dailyQuestionEntries.studentId,
            lastDate: sql<string | null>`to_char(max(${dailyQuestionEntries.date}), 'YYYY-MM-DD')`,
          })
          .from(dailyQuestionEntries)
          .where(inArray(dailyQuestionEntries.studentId, studentIds))
          .groupBy(dailyQuestionEntries.studentId),
        db
          .select({
            studentId: studentDenemeAttempts.studentId,
            lastDate: sql<string | null>`to_char(max(${studentDenemeAttempts.date}), 'YYYY-MM-DD')`,
          })
          .from(studentDenemeAttempts)
          .where(inArray(studentDenemeAttempts.studentId, studentIds))
          .groupBy(studentDenemeAttempts.studentId),
      ]);
    }

    const weekByStudent = new Map<string, DailyEntryLike[]>();
    for (const row of weekRows) {
      const list = weekByStudent.get(row.studentId) ?? [];
      list.push(row);
      weekByStudent.set(row.studentId, list);
    }

    const lastByStudent = new Map(
      lastEntryRows.map((row) => [row.studentId, row.lastDate]),
    );
    for (const row of lastDenemeRows) {
      const current = lastByStudent.get(row.studentId) ?? null;
      if (row.lastDate !== null && (current === null || row.lastDate > current)) {
        lastByStudent.set(row.studentId, row.lastDate);
      }
    }

    const students: AttentionStudent[] = rows.map((row) => {
      const totals = aggregateWeekEntries(
        weekByStudent.get(row.studentId) ?? [],
        weekStart,
      );
      const lastEntryDate = lastByStudent.get(row.studentId) ?? null;
      const advisor = advisorByStudent.get(row.studentId) ?? null;
      const pending = pendingByStudent.get(row.studentId) ?? null;
      const pendingCount = pending?.pendingCount ?? 0;
      const oldestPendingAt = pending?.oldestPendingAt
        ? Date.parse(pending.oldestPendingAt)
        : NaN;
      const waitingHours =
        pendingCount > 0 && !Number.isNaN(oldestPendingAt)
          ? Math.max(
              1,
              Math.floor((Date.now() - oldestPendingAt) / 3_600_000),
            )
          : null;

      return {
        studentId: row.studentId,
        studentName: row.studentName || "İsimsiz öğrenci",
        studentNumber: row.studentNumber ?? null,
        gradeLevel: normalizeGradeLevel(row.gradeLevel),
        studyField: row.studyField ?? null,
        advisorId: advisor?.advisorId ?? null,
        advisorName: advisor?.advisorName ?? null,
        weekTotalQuestions: totals.total,
        weekNet: roundNet(totals.net),
        lastEntryDate,
        daysSinceEntry:
          lastEntryDate === null ? null : daysBetweenIso(today, lastEntryDate),
        pendingQuestionCount: pendingCount,
        oldestPendingWaitingHours: waitingHours,
      };
    });

    const stale: AttentionStaleItem[] = students
      .filter(
        (s) =>
          s.daysSinceEntry === null || s.daysSinceEntry >= STALE_DAYS,
      )
      .map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        daysSinceEntry: s.daysSinceEntry,
      }));

    const waiting: AttentionWaitingItem[] = students
      .filter(
        (s) =>
          s.pendingQuestionCount > 0 &&
          (s.oldestPendingWaitingHours ?? 0) >= WAITING_HOURS,
      )
      .map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        pendingCount: s.pendingQuestionCount,
        oldestWaitingHours: s.oldestPendingWaitingHours ?? 0,
      }));

    return { success: true, data: { students, stale, waiting } };
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
    if (!(await canStaffAccessStudent(ctx, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const weekStart = parseMonday(weekStartArg);
    const weekEnd = weekEndOf(weekStart);
    const advisor = alias(users, "summary_advisor");

    const [profileRows, rows, feedbackRows] = await Promise.all([
      db
        .select({
          name: users.name,
          studentNumber: users.studentNumber,
          studyField: users.studyField,
          gradeLevel: users.gradeLevel,
          advisorName: advisor.name,
        })
        .from(users)
        .leftJoin(
          teacherStudents,
          eq(teacherStudents.studentId, users.id),
        )
        .leftJoin(
          advisor,
          and(eq(advisor.id, teacherStudents.teacherId), eq(advisor.role, "teacher")),
        )
        .where(eq(users.id, studentId))
        .limit(1),
      db
        .select({
          examType: dailyQuestionEntries.examType,
          subjectId: dailyQuestionEntries.subjectId,
          correct: sql<number>`sum(${dailyQuestionEntries.correct})::int`,
          wrong: sql<number>`sum(${dailyQuestionEntries.wrong})::int`,
          blank: sql<number>`sum(${dailyQuestionEntries.blank})::int`,
        })
        .from(dailyQuestionEntries)
        .where(
          and(
            eq(dailyQuestionEntries.studentId, studentId),
            gte(dailyQuestionEntries.date, weekStart),
            lte(dailyQuestionEntries.date, weekEnd),
          ),
        )
        .groupBy(
          dailyQuestionEntries.examType,
          dailyQuestionEntries.subjectId,
        ),
      db
        .select({
          comment: coachingFeedbacks.comment,
          createdAt: coachingFeedbacks.createdAt,
        })
        .from(coachingFeedbacks)
        .where(
          ctx.role === "admin"
            ? and(
                eq(coachingFeedbacks.studentId, studentId),
                eq(coachingFeedbacks.weekStart, weekStart),
              )
            : and(
                eq(coachingFeedbacks.studentId, studentId),
                eq(coachingFeedbacks.teacherId, ctx.teacherId),
                eq(coachingFeedbacks.weekStart, weekStart),
              ),
        )
        .orderBy(desc(coachingFeedbacks.createdAt))
        .limit(1),
    ]);

    const byKey = new Map(
      rows.map((r) => [`${r.examType}:${r.subjectId}`, r]),
    );

    const subjects: SubjectSummary[] = examTypes.flatMap((examType) =>
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
          name: profileRows[0]?.name || "İsimsiz Öğrenci",
          studentNumber: profileRows[0]?.studentNumber ?? null,
          studyField: profileRows[0]?.studyField ?? null,
          gradeLevel: normalizeGradeLevel(profileRows[0]?.gradeLevel),
          advisorName: profileRows[0]?.advisorName ?? null,
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
    if (!(await canStaffAccessStudent(ctx, studentId))) {
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

    await sendPushNotification(
      studentId,
      "Yeni Haftalık Dönüt",
      "Danışman öğretmenin bu hafta için sana yeni hedefler ve değerlendirmeler yazdı.",
      "/weekly-targets",
    );

    await logActivity({
      actorId: ctx.teacherId,
      action: "feedback_saved",
      studentId,
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

export interface PreviousWeekReviewItem {
  kind: "etut" | "hedef";
  label: string;
  detail: string;
}

export interface PreviousWeekReviewData {
  studentName: string;
  currentWeekStart: string;
  previousWeekStart: string;
  /** Geçen hafta hedef, soru kaydı veya çalışma planı var mı? */
  hasActivity: boolean;
  /** Pop-up otomatik açılmalı mı? (kayıt var + dönüt yok) */
  shouldPrompt: boolean;
  feedback: { comment: string; updatedAt: string } | null;
  questions: { solved: number; target: number; percent: number };
  accuracy: { correct: number; wrong: number; percent: number };
  activeDays: number;
  plan: { completed: number; total: number; percent: number };
  unfinished: PreviousWeekReviewItem[];
  unfinishedTotal: number;
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function subjectLabelOf(subjectId: string): string {
  for (const examType of examTypes) {
    const match = ALL_SUBJECTS[examType].find((s) => s.id === subjectId);
    if (match) return match.name;
  }
  return subjectId;
}

/**
 * Öğrenci detay ekranı açıldığında bir önceki haftanın performansını özetler.
 * Dönüt henüz girilmemişse ve geçen hafta kaydı varsa pop-up açılmalıdır.
 */
export async function getPreviousWeekReviewStatus(
  studentId: string,
): Promise<TeacherActionResult<PreviousWeekReviewData>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    if (!(await canStaffAccessStudent(ctx, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const currentWeekStart = getCurrentWeekMonday();
    const previousWeekStart = addDaysISO(currentWeekStart, -7);
    const previousWeekEnd = addDaysISO(previousWeekStart, 6);

    const [profileRows, targetRows, entryRows, planRows, feedbackRows] =
      await Promise.all([
        db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, studentId))
          .limit(1),
        db
          .select({
            subjectId: weeklyTargets.subjectId,
            targetQuestionCount: weeklyTargets.targetQuestionCount,
            targetTopics: weeklyTargets.targetTopics,
          })
          .from(weeklyTargets)
          .where(
            and(
              eq(weeklyTargets.studentId, studentId),
              eq(weeklyTargets.weekStartDate, previousWeekStart),
            ),
          ),
        db
          .select({
            date: dailyQuestionEntries.date,
            topicId: dailyQuestionEntries.topicId,
            correct: dailyQuestionEntries.correct,
            wrong: dailyQuestionEntries.wrong,
            blank: dailyQuestionEntries.blank,
          })
          .from(dailyQuestionEntries)
          .where(
            and(
              eq(dailyQuestionEntries.studentId, studentId),
              gte(dailyQuestionEntries.date, previousWeekStart),
              lte(dailyQuestionEntries.date, previousWeekEnd),
            ),
          ),
        db
          .select({ slots: weeklyStudyPlans.slots })
          .from(weeklyStudyPlans)
          .where(
            and(
              eq(weeklyStudyPlans.studentId, studentId),
              eq(weeklyStudyPlans.weekStartDate, previousWeekStart),
            ),
          )
          .limit(1),
        db
          .select({
            comment: coachingFeedbacks.comment,
            updatedAt: coachingFeedbacks.createdAt,
          })
          .from(coachingFeedbacks)
          .where(
            ctx.role === "admin"
              ? and(
                  eq(coachingFeedbacks.studentId, studentId),
                  eq(coachingFeedbacks.weekStart, previousWeekStart),
                )
              : and(
                  eq(coachingFeedbacks.studentId, studentId),
                  eq(coachingFeedbacks.teacherId, ctx.teacherId),
                  eq(coachingFeedbacks.weekStart, previousWeekStart),
                ),
          )
          .orderBy(desc(coachingFeedbacks.createdAt))
          .limit(1),
      ]);

    const planSlots = planRows[0]?.slots ?? [];
    const solvedTopicIds = new Set<number>();
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    const activeDates = new Set<string>();

    for (const entry of entryRows) {
      const solved = entry.correct + entry.wrong + entry.blank;
      correct += entry.correct;
      wrong += entry.wrong;
      blank += entry.blank;
      if (solved > 0) {
        activeDates.add(entry.date);
        solvedTopicIds.add(entry.topicId);
      }
    }

    const solved = correct + wrong + blank;
    const targetQuestions = targetRows.reduce(
      (sum, row) => sum + row.targetQuestionCount,
      0,
    );
    const completedSlots = planSlots.filter((slot) => slot.isCompleted).length;

    const pendingTopicIds = new Set<number>();
    for (const row of targetRows) {
      for (const topicId of row.targetTopics ?? []) {
        if (!solvedTopicIds.has(topicId)) pendingTopicIds.add(topicId);
      }
    }

    const topicNameById = new Map<number, string>();
    if (pendingTopicIds.size > 0) {
      const topicRows = await db
        .select({
          id: curriculumTopics.id,
          topicName: curriculumTopics.topicName,
        })
        .from(curriculumTopics)
        .where(inArray(curriculumTopics.id, [...pendingTopicIds]));
      for (const row of topicRows) {
        topicNameById.set(row.id, row.topicName);
      }
    }

    const unfinished: PreviousWeekReviewItem[] = [];
    for (const slot of planSlots) {
      if (slot.isCompleted) continue;
      unfinished.push({
        kind: "etut",
        label: `${DAY_LONG_LABELS[slot.dayIndex] ?? "Gün"} · ${slot.subjectName}${
          slot.topicName ? ` · ${slot.topicName}` : ""
        }`,
        detail: `${slot.startTime}–${slot.endTime}`,
      });
    }
    for (const row of targetRows) {
      const subjectName = subjectLabelOf(row.subjectId);
      for (const topicId of row.targetTopics ?? []) {
        if (solvedTopicIds.has(topicId)) continue;
        unfinished.push({
          kind: "hedef",
          label: `${subjectName} · ${
            topicNameById.get(topicId) ?? `Konu #${topicId}`
          }`,
          detail: "Hedef konu",
        });
      }
    }

    const feedback = feedbackRows[0]
      ? {
          comment: feedbackRows[0].comment,
          updatedAt: feedbackRows[0].updatedAt.toJSON(),
        }
      : null;
    const hasActivity =
      targetRows.length > 0 || entryRows.length > 0 || planSlots.length > 0;

    return {
      success: true,
      data: {
        studentName: profileRows[0]?.name || "İsimsiz Öğrenci",
        currentWeekStart,
        previousWeekStart,
        hasActivity,
        shouldPrompt: hasActivity && feedback === null,
        feedback,
        questions: {
          solved,
          target: targetQuestions,
          percent: percentOf(solved, targetQuestions),
        },
        accuracy: {
          correct,
          wrong,
          percent: percentOf(correct, correct + wrong),
        },
        activeDays: activeDates.size,
        plan: {
          completed: completedSlots,
          total: planSlots.length,
          percent: percentOf(completedSlots, planSlots.length),
        },
        unfinished,
        unfinishedTotal: unfinished.length,
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