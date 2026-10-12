"use server";

import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  curriculumTopics,
  dailyQuestionEntries,
  studentDenemeAttempts,
  weeklyDenemeTargets,
  weeklyTargets,
} from "@/db/schema";
import { addDaysISO, parseMonday, todayInIstanbul } from "@/lib/week-utils";
import { netScore } from "@/components/quiz-entry/weekly-quiz-schema";
import { actionErrorMessage } from "@/lib/action-error";
import {
  computeDenemeTrend,
  computeRecord,
  computeSubjectTrends,
  countDaysEntered,
  summarizeLastWeek,
  type DayRecord,
  type DayTotal,
  type DenemeTrend,
  type SubjectTrend,
} from "@/lib/motivation";

export type MotivationActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export interface MotivationData {
  ring: {
    daysEntered: number;
    daysTotal: number;
    targetPct: number | null;
    targetSolved: number | null;
    targetTotal: number | null;
    targetLabel: "soru" | "deneme" | null;
  };
  growth: {
    subjectTrends: SubjectTrend[];
    denemeTrend: DenemeTrend | null;
    record: DayRecord | null;
    todayTotal: number;
  };
}

async function getStudentId(): Promise<
  | { ok: true; studentId: string }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string }
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

async function loadSubjectNames(
  subjectIds: string[],
): Promise<Map<string, string>> {
  const subjectNames = new Map<string, string>();
  if (subjectIds.length === 0) return subjectNames;
  const nameRows = await db
    .selectDistinct({
      subjectId: curriculumTopics.subjectId,
      subjectName: curriculumTopics.subjectName,
    })
    .from(curriculumTopics)
    .where(inArray(curriculumTopics.subjectId, subjectIds));
  for (const row of nameRows) {
    subjectNames.set(row.subjectId, row.subjectName);
  }
  return subjectNames;
}

export async function getMotivationData(): Promise<
  MotivationActionResult<MotivationData>
> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const studentId = ctx.studentId;
    const weekStart = parseMonday();
    const today = todayInIstanbul();
    const weekEnd = addDaysISO(weekStart, 6);
    const windowStart = addDaysISO(weekStart, -14);

    const [
      dailyRows,
      denemeRows,
      dayTotalRows,
      targetRows,
      denemeTargetRows,
      weekAttemptRows,
    ] = await Promise.all([
      db
        .select({
          date: dailyQuestionEntries.date,
          subjectId: dailyQuestionEntries.subjectId,
          correct: dailyQuestionEntries.correct,
          wrong: dailyQuestionEntries.wrong,
          blank: dailyQuestionEntries.blank,
        })
        .from(dailyQuestionEntries)
        .where(
          and(
            eq(dailyQuestionEntries.studentId, studentId),
            gte(dailyQuestionEntries.date, windowStart),
            lte(dailyQuestionEntries.date, today),
          ),
        ),
      db
        .select({
          date: studentDenemeAttempts.date,
          correct: studentDenemeAttempts.correct,
          wrong: studentDenemeAttempts.wrong,
        })
        .from(studentDenemeAttempts)
        .where(eq(studentDenemeAttempts.studentId, studentId))
        .orderBy(
          desc(studentDenemeAttempts.date),
          desc(studentDenemeAttempts.id),
        )
        .limit(10),
      db
        .select({
          date: dailyQuestionEntries.date,
          total: sql<number>`coalesce(sum(${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}), 0)::int`,
        })
        .from(dailyQuestionEntries)
        .where(eq(dailyQuestionEntries.studentId, studentId))
        .groupBy(dailyQuestionEntries.date),
      db
        .select({
          subjectId: weeklyTargets.subjectId,
          targetQuestionCount: weeklyTargets.targetQuestionCount,
        })
        .from(weeklyTargets)
        .where(
          and(
            eq(weeklyTargets.studentId, studentId),
            eq(weeklyTargets.weekStartDate, weekStart),
          ),
        ),
      db
        .select({ targetCount: weeklyDenemeTargets.targetCount })
        .from(weeklyDenemeTargets)
        .where(
          and(
            eq(weeklyDenemeTargets.studentId, studentId),
            eq(weeklyDenemeTargets.weekStartDate, weekStart),
          ),
        ),
      db
        .select({ date: studentDenemeAttempts.date })
        .from(studentDenemeAttempts)
        .where(
          and(
            eq(studentDenemeAttempts.studentId, studentId),
            gte(studentDenemeAttempts.date, weekStart),
            lte(studentDenemeAttempts.date, weekEnd),
          ),
        ),
    ]);

    const subjectIds = [...new Set(dailyRows.map((row) => row.subjectId))];
    const subjectNames = await loadSubjectNames(subjectIds);

    const daysEntered = countDaysEntered(
      dailyRows.map((row) => row.date),
      weekStart,
    );

    let targetPct: number | null = null;
    let targetSolved: number | null = null;
    let targetTotal: number | null = null;
    let targetLabel: "soru" | "deneme" | null = null;

    if (targetRows.length > 0) {
      const targetSubjects = new Set(targetRows.map((row) => row.subjectId));
      targetTotal = targetRows.reduce(
        (sum, row) => sum + row.targetQuestionCount,
        0,
      );
      let solved = 0;
      for (const row of dailyRows) {
        if (
          row.date >= weekStart &&
          row.date <= weekEnd &&
          targetSubjects.has(row.subjectId)
        ) {
          solved += row.correct + row.wrong + row.blank;
        }
      }
      targetSolved = solved;
      targetPct = targetTotal > 0 ? (solved / targetTotal) * 100 : 0;
      targetLabel = "soru";
    } else if (denemeTargetRows.length > 0) {
      targetTotal = denemeTargetRows.reduce(
        (sum, row) => sum + row.targetCount,
        0,
      );
      targetSolved = weekAttemptRows.length;
      targetPct = targetTotal > 0 ? (weekAttemptRows.length / targetTotal) * 100 : 0;
      targetLabel = "deneme";
    }

    const subjectTrends = computeSubjectTrends(
      dailyRows,
      subjectNames,
      weekStart,
    );
    const nets = denemeRows.map(
      (row) => Math.round(netScore(row.correct, row.wrong) * 100) / 100,
    );
    const denemeTrend = computeDenemeTrend(nets);
    const dayTotals: DayTotal[] = dayTotalRows.map((row) => ({
      date: row.date,
      total: Number(row.total),
    }));
    const record = computeRecord(today, weekStart, dayTotals);
    const todayTotal = dayTotals.find((day) => day.date === today)?.total ?? 0;

    return {
      success: true,
      data: {
        ring: {
          daysEntered,
          daysTotal: 7,
          targetPct,
          targetSolved,
          targetTotal,
          targetLabel,
        },
        growth: {
          subjectTrends,
          denemeTrend,
          record,
          todayTotal,
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export interface WeeklySummaryData {
  weekStart: string;
  daysEntered: number;
  totalQuestions: number;
  bestSubject: SubjectTrend | null;
}

export async function getWeeklySummary(): Promise<
  MotivationActionResult<WeeklySummaryData>
> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const weekStart = parseMonday();
    const windowStart = addDaysISO(weekStart, -14);
    const lastWeekEnd = addDaysISO(weekStart, -1);

    const rows = await db
      .select({
        date: dailyQuestionEntries.date,
        subjectId: dailyQuestionEntries.subjectId,
        correct: dailyQuestionEntries.correct,
        wrong: dailyQuestionEntries.wrong,
        blank: dailyQuestionEntries.blank,
      })
      .from(dailyQuestionEntries)
      .where(
        and(
          eq(dailyQuestionEntries.studentId, ctx.studentId),
          gte(dailyQuestionEntries.date, windowStart),
          lte(dailyQuestionEntries.date, lastWeekEnd),
        ),
      );

    const subjectIds = [...new Set(rows.map((row) => row.subjectId))];
    const subjectNames = await loadSubjectNames(subjectIds);
    const stats = summarizeLastWeek(rows, subjectNames, weekStart);

    return {
      success: true,
      data: {
        weekStart,
        daysEntered: stats.daysEntered,
        totalQuestions: stats.totalQuestions,
        bestSubject: stats.bestSubject,
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}
