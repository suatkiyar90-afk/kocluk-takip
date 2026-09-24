"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  curriculumTopics,
  dailyQuestionEntries,
  teacherStudents,
} from "@/db/schema";
import { parseMonday } from "@/lib/week-utils";
import { netScore } from "@/components/quiz-entry/weekly-quiz-schema";

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
  examType: z.enum(["TYT", "AYT"]),
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
      examType?: "TYT" | "AYT";
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
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
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
  examType: "TYT" | "AYT";
  subjectId: string;
  subjectName: string;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
}

export type WeeklyReportResult =
  | {
      success: true;
      data: {
        weekStart: string;
        weekEnd: string;
        days: DailyReportDay[];
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
        examType: "TYT" | "AYT";
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

    const sortedTopics = [...topicMap.entries()].sort(([, a], [, b]) => {
      const ea = a.examType === "TYT" ? 0 : 1;
      const eb = b.examType === "TYT" ? 0 : 1;
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
      data: { weekStart, weekEnd, days, byTopic },
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
