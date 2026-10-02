"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  curriculumTopics,
  dailyQuestionEntries,
  studentDailyNotes,
  teacherStudents,
} from "@/db/schema";
import {
  addDaysISO,
  isValidISODate,
  mondayOfISO,
  parseMonday,
  todayInIstanbul,
} from "@/lib/week-utils";
import {
  ALL_SUBJECTS,
  examTypes,
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";
import type {
  DayEntryRow,
  SubjectOption,
  SubjectOptions,
} from "@/components/quiz-entry/daily-entry-types";
import { actionErrorMessage } from "@/lib/action-error";
import {
  assertEntryWindowOpen,
  ENTRY_DATE_MESSAGE,
  ENTRY_WINDOW_MESSAGE,
  getEntryWindow,
} from "@/lib/entry-window";
import { markUserSeen } from "@/lib/touch-last-seen";

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

function roundNet(n: number): number {
  return Math.round(n * 100) / 100;
}

const dailyEntrySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-AA formatında olmalı."),
  examType: z.enum(examTypes),
  subjectId: z.string().min(1).max(50),
  topicId: z.number().int().positive(),
  correct: z.number().int().min(0).max(500),
  wrong: z.number().int().min(0).max(500),
  blank: z.number().int().min(0).max(500),
});

export type SaveDailyEntryResult =
  | {
      success: true;
      data: { id: number; date: string };
    }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_FAILED" | "DATABASE_ERROR";
      message: string;
    };

export async function saveDailyEntry(
  payload: unknown,
): Promise<SaveDailyEntryResult> {
  const authCtx = await getStudentId();
  if (authCtx.ok === false) {
    return {
      success: false,
      status: authCtx.status,
      message: authCtx.message,
    };
  }
  const studentId = authCtx.studentId;

  const parsed = dailyEntrySchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const { date, examType, subjectId, topicId, correct, wrong, blank } =
    parsed.data;

  if (!isValidISODate(date)) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Geçersiz tarih.",
    };
  }

  const now = new Date();
  try {
    assertEntryWindowOpen(now);
  } catch (err) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: err instanceof Error ? err.message : ENTRY_WINDOW_MESSAGE,
    };
  }
  const entryWindow = getEntryWindow(now);
  if (date !== entryWindow.today) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: ENTRY_DATE_MESSAGE,
    };
  }

  try {
    const topicRows = await db
      .select({ id: curriculumTopics.id })
      .from(curriculumTopics)
      .where(
        and(
          eq(curriculumTopics.id, topicId),
          eq(curriculumTopics.examType, examType),
          eq(curriculumTopics.subjectId, subjectId),
        ),
      )
      .limit(1);

    if (topicRows.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Seçilen konu, ders ve sınav türü ile eşleşmiyor.",
      };
    }

    const setValues = {
      correct: sql`excluded.correct`,
      wrong: sql`excluded.wrong`,
      blank: sql`excluded.blank`,
    } as {
      id?: number;
      studentId?: string;
      date?: string;
      examType?: ExamType;
      subjectId?: string;
      topicId?: number;
      correct?: unknown;
      wrong?: unknown;
      blank?: unknown;
      createdAt?: Date;
    };

    const row = {
      studentId,
      date,
      examType,
      subjectId,
      topicId,
      correct,
      wrong,
      blank,
    };

    const inserted = await db
      .insert(dailyQuestionEntries)
      .values(row)
      .onConflictDoUpdate({
        target: [
          dailyQuestionEntries.studentId,
          dailyQuestionEntries.date,
          dailyQuestionEntries.examType,
          dailyQuestionEntries.subjectId,
          dailyQuestionEntries.topicId,
        ],
        set: setValues,
      })
      .returning({ id: dailyQuestionEntries.id });

    await markUserSeen(studentId);
    return { success: true, data: { id: inserted[0].id, date } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}

export type SaveDailyNoteResult =
  | {
      success: true;
      data: { date: string };
    }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_FAILED" | "DATABASE_ERROR";
      message: string;
    };

export async function saveDailyNote(
  date: string,
  note: string,
): Promise<SaveDailyNoteResult> {
  const authCtx = await getStudentId();
  if (authCtx.ok === false) {
    return {
      success: false,
      status: authCtx.status,
      message: authCtx.message,
    };
  }

  if (!isValidPastDate(date)) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Geçersiz tarih.",
    };
  }

  const now = new Date();
  try {
    assertEntryWindowOpen(now);
  } catch (err) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: err instanceof Error ? err.message : ENTRY_WINDOW_MESSAGE,
    };
  }
  if (date !== getEntryWindow(now).today) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: ENTRY_DATE_MESSAGE,
    };
  }

  const trimmed = note.trim();
  if (trimmed.length === 0) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Not boş olamaz.",
    };
  }
  if (trimmed.length > 2000) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Not en fazla 2000 karakter olabilir.",
    };
  }

  try {
    await db
      .insert(studentDailyNotes)
      .values({
        studentId: authCtx.studentId,
        date,
        note: trimmed,
      })
      .onConflictDoUpdate({
        target: [studentDailyNotes.studentId, studentDailyNotes.date],
        set: {
          note: trimmed,
          updatedAt: new Date(),
        } as Partial<typeof studentDailyNotes.$inferInsert>,
      });

    return { success: true, data: { date } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}

export interface DailyReportDay {
  date: string;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
}

export interface DailyReportTopic {
  topicId: number;
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
}

export interface DailyReportEntry {
  date: string;
  examType: ExamType;
  subjectName: string;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
}

export interface DailyReportNote {
  date: string;
  note: string;
  updatedAt: Date;
}

export type WeeklyReportResult =
  | {
      success: true;
      data: {
        weekStart: string;
        weekEnd: string;
        days: DailyReportDay[];
        entries: DailyReportEntry[];
        dailyNotes: DailyReportNote[];
        byTopic: DailyReportTopic[];
      };
    }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export async function getWeeklyReportByStudent(
  studentId: string,
  weekStartArg?: string,
): Promise<WeeklyReportResult> {
  const authCtx = await getTeacherId();
  if (authCtx.ok === false) {
    return {
      success: false,
      status: authCtx.status,
      message: authCtx.message,
    };
  }

  try {
    if (!(await isAssigned(authCtx.teacherId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const weekStart = parseMonday(weekStartArg);
    const weekEnd = addDaysISO(weekStart, 6);

    const rows = await db
      .select({
        date: dailyQuestionEntries.date,
        examType: dailyQuestionEntries.examType,
        subjectId: dailyQuestionEntries.subjectId,
        subjectName: curriculumTopics.subjectName,
        topicName: curriculumTopics.topicName,
        sortOrder: curriculumTopics.sortOrder,
        topicId: dailyQuestionEntries.topicId,
        correct: dailyQuestionEntries.correct,
        wrong: dailyQuestionEntries.wrong,
        blank: dailyQuestionEntries.blank,
      })
      .from(dailyQuestionEntries)
      .innerJoin(
        curriculumTopics,
        eq(curriculumTopics.id, dailyQuestionEntries.topicId),
      )
      .where(
        and(
          eq(dailyQuestionEntries.studentId, studentId),
          gte(dailyQuestionEntries.date, weekStart),
          lte(dailyQuestionEntries.date, weekEnd),
        ),
      )
      .orderBy(asc(dailyQuestionEntries.date));

    const dayMap = new Map<
      string,
      { correct: number; wrong: number; blank: number }
    >();
    for (let i = 0; i < 7; i++) {
      const d = addDaysISO(weekStart, i);
      dayMap.set(d, { correct: 0, wrong: 0, blank: 0 });
    }

    const topicMap = new Map<
      number,
      {
        examType: ExamType;
        subjectId: string;
        subjectName: string;
        topicName: string;
        sortOrder: number;
        correct: number;
        wrong: number;
        blank: number;
      }
    >();

    for (const row of rows) {
      const day = dayMap.get(row.date);
      if (day) {
        day.correct += row.correct;
        day.wrong += row.wrong;
        day.blank += row.blank;
      }

      let acc = topicMap.get(row.topicId);
      if (!acc) {
        acc = {
          examType: row.examType,
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          topicName: row.topicName,
          sortOrder: row.sortOrder,
          correct: 0,
          wrong: 0,
          blank: 0,
        };
        topicMap.set(row.topicId, acc);
      }
      acc.correct += row.correct;
      acc.wrong += row.wrong;
      acc.blank += row.blank;
    }

    const days: DailyReportDay[] = [];
    for (const [date, totals] of dayMap) {
      const solved = totals.correct + totals.wrong + totals.blank;
      days.push({
        date,
        ...totals,
        solved,
        net: roundNet(netScore(totals.correct, totals.wrong)),
      });
    }

    const entries: DailyReportEntry[] = rows.map((row) => {
      const solved = row.correct + row.wrong + row.blank;
      return {
        date: row.date,
        examType: row.examType,
        subjectName: row.subjectName,
        topicName: row.topicName,
        correct: row.correct,
        wrong: row.wrong,
        blank: row.blank,
        solved,
        net: roundNet(netScore(row.correct, row.wrong)),
      };
    });

    const noteRows = await db
      .select({
        date: studentDailyNotes.date,
        note: studentDailyNotes.note,
        updatedAt: studentDailyNotes.updatedAt,
      })
      .from(studentDailyNotes)
      .where(
        and(
          eq(studentDailyNotes.studentId, studentId),
          gte(studentDailyNotes.date, weekStart),
          lte(studentDailyNotes.date, weekEnd),
        ),
      )
      .orderBy(asc(studentDailyNotes.date));

    const dailyNotes: DailyReportNote[] = noteRows;

    const sortedTopics = [...topicMap.entries()].sort(([, a], [, b]) => {
      const ea = examTypes.indexOf(a.examType);
      const eb = examTypes.indexOf(b.examType);
      if (ea !== eb) return ea - eb;
      if (a.subjectId !== b.subjectId)
        return a.subjectId.localeCompare(b.subjectId, "tr");
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.topicName.localeCompare(b.topicName, "tr");
    });

    const byTopic: DailyReportTopic[] = sortedTopics.map(([topicId, t]) => ({
      topicId,
      examType: t.examType,
      subjectId: t.subjectId,
      subjectName: t.subjectName,
      topicName: t.topicName,
      correct: t.correct,
      wrong: t.wrong,
      blank: t.blank,
      solved: t.correct + t.wrong + t.blank,
      net: roundNet(netScore(t.correct, t.wrong)),
    }));

    return {
      success: true,
      data: { weekStart, weekEnd, days, entries, dailyNotes, byTopic },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}

export interface SubjectStatistics {
  subjectId: string;
  subjectName: string;
  lastWeekTotal: number;
  lastMonthTotal: number;
  allTimeTotal: number;
}

export type StudentStatisticsResult =
  | { success: true; data: SubjectStatistics[] }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

function isoDaysAgo(days: number): string {
  return addDaysISO(todayInIstanbul(), -days);
}

async function checkStatisticsAccess(studentId: string): Promise<
  | { ok: true }
  | {
      ok: false;
      error: { status: "UNAUTHORIZED" | "FORBIDDEN"; message: string };
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      error: { status: "UNAUTHORIZED", message: "Oturum açmanız gerekiyor." },
    };
  }

  const role = session.user.role;
  if (role === "student") {
    if (session.user.id !== studentId) {
      return {
        ok: false,
        error: {
          status: "FORBIDDEN",
          message: "Bu istatistikleri görüntüleme yetkiniz yok.",
        },
      };
    }
  } else if (role === "teacher") {
    const assigned = await db
      .select({ studentId: teacherStudents.studentId })
      .from(teacherStudents)
      .where(
        and(
          eq(teacherStudents.teacherId, session.user.id),
          eq(teacherStudents.studentId, studentId),
        ),
      )
      .limit(1);
    if (assigned.length === 0) {
      return {
        ok: false,
        error: {
          status: "FORBIDDEN",
          message: "Bu öğrenci size atanmamış.",
        },
      };
    }
  } else if (role !== "admin") {
    return {
      ok: false,
      error: {
        status: "FORBIDDEN",
        message: "Bu işlem için yetkiniz yok.",
      },
    };
  }

  return { ok: true };
}

export async function getStudentStatistics(
  studentId: string,
): Promise<StudentStatisticsResult> {
  const access = await checkStatisticsAccess(studentId);
  if (access.ok === false) {
    return {
      success: false,
      status: access.error.status,
      message: access.error.message,
    };
  }

  try {
    const today = todayInIstanbul();
    const weekAgo = isoDaysAgo(7);
    const monthAgo = isoDaysAgo(30);
    const solved = sql<number>`${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}`;

    const rows = await db
      .select({
        subjectId: dailyQuestionEntries.subjectId,
        subjectName: curriculumTopics.subjectName,
        lastWeekTotal: sql<number>`coalesce(sum(case when ${dailyQuestionEntries.date} >= ${weekAgo} and ${dailyQuestionEntries.date} <= ${today} then ${solved} else 0 end)::int, 0)`,
        lastMonthTotal: sql<number>`coalesce(sum(case when ${dailyQuestionEntries.date} >= ${monthAgo} and ${dailyQuestionEntries.date} <= ${today} then ${solved} else 0 end)::int, 0)`,
        allTimeTotal: sql<number>`coalesce(sum(${solved})::int, 0)`,
      })
      .from(dailyQuestionEntries)
      .innerJoin(
        curriculumTopics,
        eq(curriculumTopics.id, dailyQuestionEntries.topicId),
      )
      .where(eq(dailyQuestionEntries.studentId, studentId))
      .groupBy(dailyQuestionEntries.subjectId, curriculumTopics.subjectName);

    const data: SubjectStatistics[] = rows
      .map((row) => ({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        lastWeekTotal: Number(row.lastWeekTotal),
        lastMonthTotal: Number(row.lastMonthTotal),
        allTimeTotal: Number(row.allTimeTotal),
      }))
      .sort(
        (a, b) =>
          b.allTimeTotal - a.allTimeTotal ||
          a.subjectName.localeCompare(b.subjectName, "tr"),
      );

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}

export interface StudentTrendWeek {
  weekStart: string;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  net: number;
}

export interface StudentTrendSubject {
  subjectId: string;
  subjectName: string;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
}

export interface StudentTrendDay {
  date: string;
  total: number;
}

export interface StudentTrendsData {
  weeks: StudentTrendWeek[];
  subjects: StudentTrendSubject[];
  daily: StudentTrendDay[];
}

export type StudentTrendsResult =
  | { success: true; data: StudentTrendsData }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export async function getStudentTrends(
  studentId: string,
  weeks = 8,
): Promise<StudentTrendsResult> {
  const access = await checkStatisticsAccess(studentId);
  if (access.ok === false) {
    return {
      success: false,
      status: access.error.status,
      message: access.error.message,
    };
  }

  const weekCount = Math.min(Math.max(Math.trunc(weeks) || 8, 1), 52);

  try {
    const today = todayInIstanbul();
    const currentWeek = mondayOfISO(today);
    const weekBound = addDaysISO(currentWeek, -7 * (weekCount - 1));
    const dayBound = addDaysISO(today, -29);

    const weekKey = sql<string>`to_char(date_trunc('week', ${dailyQuestionEntries.date}::date), 'YYYY-MM-DD')`;
    const solved = sql<number>`${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}`;

    const [weeklyRows, subjectRows, dailyRows] = await Promise.all([
      db
        .select({
          weekStart: weekKey,
          correct: sql<number>`coalesce(sum(${dailyQuestionEntries.correct})::int, 0)`,
          wrong: sql<number>`coalesce(sum(${dailyQuestionEntries.wrong})::int, 0)`,
          blank: sql<number>`coalesce(sum(${dailyQuestionEntries.blank})::int, 0)`,
        })
        .from(dailyQuestionEntries)
        .where(
          and(
            eq(dailyQuestionEntries.studentId, studentId),
            gte(dailyQuestionEntries.date, weekBound),
            lte(dailyQuestionEntries.date, today),
          ),
        )
        .groupBy(weekKey)
        .orderBy(asc(weekKey)),
      db
        .select({
          subjectId: dailyQuestionEntries.subjectId,
          subjectName: curriculumTopics.subjectName,
          correct: sql<number>`coalesce(sum(${dailyQuestionEntries.correct})::int, 0)`,
          wrong: sql<number>`coalesce(sum(${dailyQuestionEntries.wrong})::int, 0)`,
          blank: sql<number>`coalesce(sum(${dailyQuestionEntries.blank})::int, 0)`,
        })
        .from(dailyQuestionEntries)
        .innerJoin(
          curriculumTopics,
          eq(curriculumTopics.id, dailyQuestionEntries.topicId),
        )
        .where(eq(dailyQuestionEntries.studentId, studentId))
        .groupBy(dailyQuestionEntries.subjectId, curriculumTopics.subjectName),
      db
        .select({
          date: dailyQuestionEntries.date,
          total: sql<number>`coalesce(sum(${solved})::int, 0)`,
        })
        .from(dailyQuestionEntries)
        .where(
          and(
            eq(dailyQuestionEntries.studentId, studentId),
            gte(dailyQuestionEntries.date, dayBound),
            lte(dailyQuestionEntries.date, today),
          ),
        )
        .groupBy(dailyQuestionEntries.date)
        .orderBy(asc(dailyQuestionEntries.date)),
    ]);

    const weeklyByKey = new Map(weeklyRows.map((r) => [r.weekStart, r]));
    const trendWeeks: StudentTrendWeek[] = [];
    for (let i = weekCount - 1; i >= 0; i--) {
      const weekStart = addDaysISO(currentWeek, -7 * i);
      const row = weeklyByKey.get(weekStart);
      const correct = Number(row?.correct ?? 0);
      const wrong = Number(row?.wrong ?? 0);
      const blank = Number(row?.blank ?? 0);
      trendWeeks.push({
        weekStart,
        correct,
        wrong,
        blank,
        total: correct + wrong + blank,
        net: roundNet(netScore(correct, wrong)),
      });
    }

    const trendSubjects: StudentTrendSubject[] = subjectRows
      .map((row) => {
        const correct = Number(row.correct);
        const wrong = Number(row.wrong);
        const blank = Number(row.blank);
        return {
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          correct,
          wrong,
          blank,
          total: correct + wrong + blank,
        };
      })
      .filter((row) => row.total > 0)
      .sort(
        (a, b) =>
          b.total - a.total ||
          a.subjectName.localeCompare(b.subjectName, "tr"),
      );

    const dailyByDate = new Map(dailyRows.map((r) => [r.date, Number(r.total)]));
    const trendDaily: StudentTrendDay[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = addDaysISO(today, -i);
      trendDaily.push({ date, total: dailyByDate.get(date) ?? 0 });
    }

    return {
      success: true,
      data: { weeks: trendWeeks, subjects: trendSubjects, daily: trendDaily },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}

export interface DailyEntryData {
  entries: DayEntryRow[];
  subjects: SubjectOptions;
  dailyNote: string | null;
}

function isValidPastDate(value: string): boolean {
  if (!isValidISODate(value)) return false;
  return value <= todayInIstanbul();
}

export async function getDailyEntryData(
  date: string,
): Promise<
  | { success: true; data: DailyEntryData }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    }
> {
  const guard = await getStudentId();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  const safeDate = isValidPastDate(date) ? date : todayInIstanbul();

  try {
    const [entryRows, topicRows, noteRows] = await Promise.all([
      db
        .select({
          id: dailyQuestionEntries.id,
          examType: dailyQuestionEntries.examType,
          subjectName: curriculumTopics.subjectName,
          topicName: curriculumTopics.topicName,
          correct: dailyQuestionEntries.correct,
          wrong: dailyQuestionEntries.wrong,
          blank: dailyQuestionEntries.blank,
        })
        .from(dailyQuestionEntries)
        .innerJoin(
          curriculumTopics,
          eq(curriculumTopics.id, dailyQuestionEntries.topicId),
        )
        .where(
          and(
            eq(dailyQuestionEntries.studentId, guard.studentId),
            eq(dailyQuestionEntries.date, safeDate),
          ),
        )
        .orderBy(
          asc(dailyQuestionEntries.examType),
          asc(curriculumTopics.subjectName),
          asc(curriculumTopics.sortOrder),
        ),
      db
        .select({
          id: curriculumTopics.id,
          examType: curriculumTopics.examType,
          subjectId: curriculumTopics.subjectId,
          subjectName: curriculumTopics.subjectName,
          topicName: curriculumTopics.topicName,
          sortOrder: curriculumTopics.sortOrder,
        })
        .from(curriculumTopics)
        .orderBy(
          asc(curriculumTopics.examType),
          asc(curriculumTopics.subjectId),
          asc(curriculumTopics.sortOrder),
        ),
      db
        .select({ note: studentDailyNotes.note })
        .from(studentDailyNotes)
        .where(
          and(
            eq(studentDailyNotes.studentId, guard.studentId),
            eq(studentDailyNotes.date, safeDate),
          ),
        )
        .limit(1),
    ]);

    const subjects: SubjectOptions = { TYT: [], AYT: [], YDT: [] };
    const groupByKey = new Map<string, SubjectOption>();
    for (const topic of topicRows) {
      const key = `${topic.examType}:${topic.subjectId}`;
      let group = groupByKey.get(key);
      if (!group) {
        group = {
          subjectId: topic.subjectId,
          subjectName: topic.subjectName,
          topics: [],
        };
        groupByKey.set(key, group);
        subjects[topic.examType].push(group);
      }
      group.topics.push({ id: topic.id, name: topic.topicName });
    }

    for (const examType of examTypes) {
      const rank = new Map(
        ALL_SUBJECTS[examType].map((subject, index) => [subject.id, index]),
      );
      subjects[examType].sort(
        (a, b) =>
          (rank.get(a.subjectId) ?? 99) - (rank.get(b.subjectId) ?? 99),
      );
    }

    const entries: DayEntryRow[] = entryRows;
    const dailyNote = noteRows[0]?.note ?? null;
    return { success: true, data: { entries, subjects, dailyNote } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}

export interface EntryWindowStatusData {
  state: "before" | "open" | "after";
  serverNow: string;
  opensAt: string;
  closesAt: string;
  hasEntryToday: boolean;
}

export type EntryWindowStatusResult =
  | { success: true; data: EntryWindowStatusData; message: string }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export async function getEntryWindowStatus(): Promise<EntryWindowStatusResult> {
  const guard = await getStudentId();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  try {
    const now = new Date();
    const entryWindow = getEntryWindow(now);

    const [entryRows, noteRows] = await Promise.all([
      db
        .select({ id: dailyQuestionEntries.id })
        .from(dailyQuestionEntries)
        .where(
          and(
            eq(dailyQuestionEntries.studentId, guard.studentId),
            eq(dailyQuestionEntries.date, entryWindow.today),
          ),
        )
        .limit(1),
      db
        .select({ id: studentDailyNotes.id })
        .from(studentDailyNotes)
        .where(
          and(
            eq(studentDailyNotes.studentId, guard.studentId),
            eq(studentDailyNotes.date, entryWindow.today),
          ),
        )
        .limit(1),
    ]);

    return {
      success: true,
      data: {
        state: entryWindow.state,
        serverNow: now.toISOString(),
        opensAt: entryWindow.opensAt.toISOString(),
        closesAt: entryWindow.closesAt.toISOString(),
        hasEntryToday: entryRows.length > 0 || noteRows.length > 0,
      },
      message: "Giriş penceresi durumu yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export interface PastEntryRow {
  id: number;
  date: string;
  examType: ExamType;
  subjectName: string;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
}

export type PastEntriesResult =
  | { success: true; data: { entries: PastEntryRow[] }; message: string }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export async function getPastWeekEntries(): Promise<PastEntriesResult> {
  const guard = await getStudentId();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  try {
    const today = todayInIstanbul();
    const weekStart = mondayOfISO(today);

    const rows = await db
      .select({
        id: dailyQuestionEntries.id,
        date: dailyQuestionEntries.date,
        examType: dailyQuestionEntries.examType,
        subjectName: curriculumTopics.subjectName,
        topicName: curriculumTopics.topicName,
        correct: dailyQuestionEntries.correct,
        wrong: dailyQuestionEntries.wrong,
        blank: dailyQuestionEntries.blank,
      })
      .from(dailyQuestionEntries)
      .innerJoin(
        curriculumTopics,
        eq(curriculumTopics.id, dailyQuestionEntries.topicId),
      )
      .where(
        and(
          eq(dailyQuestionEntries.studentId, guard.studentId),
          gte(dailyQuestionEntries.date, weekStart),
          lt(dailyQuestionEntries.date, today),
        ),
      )
      .orderBy(
        desc(dailyQuestionEntries.date),
        asc(curriculumTopics.subjectName),
      );

    return {
      success: true,
      data: { entries: rows },
      message: "Geçmiş girişler yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}
