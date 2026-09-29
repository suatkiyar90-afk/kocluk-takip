"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  curriculumTopics,
  dailyQuestionEntries,
  studentDailyNotes,
  teacherStudents,
} from "@/db/schema";
import { parseMonday } from "@/lib/week-utils";
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

function isValidISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getStudentStatistics(
  studentId: string,
): Promise<StudentStatisticsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      status: "UNAUTHORIZED",
      message: "Oturum açmanız gerekiyor.",
    };
  }

  const role = session.user.role;
  if (role === "student") {
    if (session.user.id !== studentId) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu istatistikleri görüntüleme yetkiniz yok.",
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
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }
  } else if (role !== "admin") {
    return {
      success: false,
      status: "FORBIDDEN",
      message: "Bu işlem için yetkiniz yok.",
    };
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
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

export interface DailyEntryData {
  entries: DayEntryRow[];
  subjects: SubjectOptions;
  dailyNote: string | null;
}

function isValidPastDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  const real =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
  if (!real) return false;
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return value <= todayIso;
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

  const safeDate = isValidPastDate(date)
    ? date
    : new Date().toISOString().slice(0, 10);

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
