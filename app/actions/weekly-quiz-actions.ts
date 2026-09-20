"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coachingFeedbacks,
  users,
  weeklyQuestionEntries,
} from "@/db/schema";
import { parseMonday } from "@/lib/week-utils";
import {
  netScore,
  weeklyQuizSchema,
  type EntryValues,
} from "@/components/quiz-entry/weekly-quiz-schema";

async function getStudentId(): Promise<
  | { ok: true; studentId: string }
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
  if (session.user.role !== "student") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu işlem için öğrenci yetkisi gerekli.",
    };
  }
  return { ok: true, studentId: session.user.id };
}

export type ThisWeeksEntriesResult =
  | {
      success: true;
      data: { weekStart: string; entries: EntryValues[] };
    }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export type SaveWeeklyQuizResult =
  | {
      success: true;
      data: { upsertedCount: number; weekStart: string };
    }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN";
      message: string;
    }
  | {
      success: false;
      status: "VALIDATION_FAILED";
      message: string;
    }
  | {
      success: false;
      status: "DATABASE_ERROR";
      message: string;
    };

export async function saveWeeklyQuizEntries(
  payload: unknown,
  weekStartArg?: string,
): Promise<SaveWeeklyQuizResult> {
  const authCtx = await getStudentId();
  if (authCtx.ok === false) {
    return {
      success: false,
      status: authCtx.status,
      message: authCtx.message,
    };
  }
  const studentId = authCtx.studentId;

  const parsed = weeklyQuizSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const weekStart = parseMonday(
    weekStartArg ?? parsed.data.weekStart,
  );
  const rows = parsed.data.categories;
  const filled = rows.filter((r) => r.correct + r.wrong + r.blank > 0);
  const cleared = rows.filter((r) => r.correct + r.wrong + r.blank === 0);

  try {
    const upsertedCount = await db.transaction(async (tx) => {
      if (cleared.length > 0) {
        await tx
          .delete(weeklyQuestionEntries)
          .where(
            and(
              eq(weeklyQuestionEntries.studentId, studentId),
              eq(weeklyQuestionEntries.weekStart, weekStart),
              or(
                ...cleared.map((r) =>
                  and(
                    eq(weeklyQuestionEntries.examType, r.examType),
                    eq(weeklyQuestionEntries.subjectId, r.subjectId),
                  ),
                ),
              ),
            ),
          );
      }

      if (filled.length > 0) {
        const setValues = {
          correct: sql`excluded.correct`,
          wrong: sql`excluded.wrong`,
          blank: sql`excluded.blank`,
          updatedAt: sql`now()`,
        } as {
          studentId?: string;
          weekStart?: string;
          examType?: "TYT" | "AYT";
          subjectId?: string;
          correct: unknown;
          wrong: unknown;
          blank: unknown;
          updatedAt?: unknown;
        };

        const inserted = await tx
          .insert(weeklyQuestionEntries)
          .values(
            filled.map((r) => ({
              studentId,
              weekStart,
              examType: r.examType,
              subjectId: r.subjectId,
              correct: r.correct,
              wrong: r.wrong,
              blank: r.blank,
            })),
          )
          .onConflictDoUpdate({
            target: [
              weeklyQuestionEntries.studentId,
              weeklyQuestionEntries.weekStart,
              weeklyQuestionEntries.examType,
              weeklyQuestionEntries.subjectId,
            ],
            set: setValues,
          })
          .returning({ id: weeklyQuestionEntries.id });

        return inserted.length;
      }

      return 0;
    });

    return {
      success: true,
      data: { upsertedCount, weekStart },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

export async function getThisWeeksEntries(
  weekStartArg?: string,
): Promise<ThisWeeksEntriesResult> {
  const authCtx = await getStudentId();
  if (authCtx.ok === false) {
    return {
      success: false,
      status: authCtx.status,
      message: authCtx.message,
    };
  }
  const studentId = authCtx.studentId;

  const weekStart = parseMonday(weekStartArg);

  try {
    const rows = await db
      .select()
      .from(weeklyQuestionEntries)
      .where(
        and(
          eq(weeklyQuestionEntries.studentId, studentId),
          eq(weeklyQuestionEntries.weekStart, weekStart),
        ),
      )
      .orderBy(
        weeklyQuestionEntries.examType,
        weeklyQuestionEntries.subjectId,
      );

    const entries: EntryValues[] = rows.map((row) => ({
      examType: row.examType,
      subjectId: row.subjectId,
      correct: row.correct,
      wrong: row.wrong,
      blank: row.blank,
    }));

    return { success: true, data: { weekStart, entries } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

export interface StudentOverviewData {
  weekStart: string;
  totals: { tytNet: number; aytNet: number; solved: number };
  feedback: Array<{
    teacherId: string;
    teacherName: string;
    comment: string;
    createdAt: string;
  }>;
}

export type StudentOverviewResult =
  | {
      success: true;
      data: StudentOverviewData;
    }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

function roundNet(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getStudentOverview(
  weekStartArg?: string,
): Promise<StudentOverviewResult> {
  const authCtx = await getStudentId();
  if (authCtx.ok === false) {
    return {
      success: false,
      status: authCtx.status,
      message: authCtx.message,
    };
  }
  const studentId = authCtx.studentId;

  const weekStart = parseMonday(weekStartArg);

  try {
    const [entryRows, feedbackRows] = await Promise.all([
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
        .select()
        .from(coachingFeedbacks)
        .where(
          and(
            eq(coachingFeedbacks.studentId, studentId),
            eq(coachingFeedbacks.weekStart, weekStart),
          ),
        )
        .orderBy(desc(coachingFeedbacks.createdAt)),
    ]);

    let tytNet = 0;
    let aytNet = 0;
    let solved = 0;
    for (const e of entryRows) {
      solved += e.correct + e.wrong + e.blank;
      const net = netScore(e.correct, e.wrong);
      if (e.examType === "TYT") {
        tytNet += net;
      } else {
        aytNet += net;
      }
    }

    const teacherIds = [...new Set(feedbackRows.map((r) => r.teacherId))];
    const teacherRows =
      teacherIds.length > 0
        ? await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, teacherIds))
        : [];
    const nameById = new Map(teacherRows.map((t) => [t.id, t.name]));

    return {
      success: true,
      data: {
        weekStart,
        totals: {
          tytNet: roundNet(tytNet),
          aytNet: roundNet(aytNet),
          solved,
        },
        feedback: feedbackRows.map((f) => ({
          teacherId: f.teacherId,
          teacherName: nameById.get(f.teacherId) || "Öğretmen",
          comment: f.comment,
          createdAt: f.createdAt.toJSON(),
        })),
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}