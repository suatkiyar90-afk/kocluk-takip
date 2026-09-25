"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { mockExams, teacherStudents, users } from "@/db/schema";

export interface MockExamRecord {
  id: number;
  examName: string;
  examDate: string;
  turkceNet: number;
  tarihNet: number;
  cografyaNet: number;
  felsefeNet: number;
  dinNet: number;
  matematikNet: number;
  geometriNet: number;
  fizikNet: number;
  kimyaNet: number;
  biyolojiNet: number;
  toplamNet: number;
  tytPuani: number;
}

export interface ImportedExamRow {
  studentName: string;
  studentNumber: string;
  turkceNet: number;
  tarihNet: number;
  cografyaNet: number;
  felsefeNet: number;
  dinNet: number;
  matematikNet: number;
  geometriNet: number;
  fizikNet: number;
  kimyaNet: number;
  biyolojiNet: number;
  toplamNet: number;
  tytPuani: number;
}

export type ImportMockExamsResult =
  | {
      success: true;
      data: {
        total: number;
        matched: number;
        unmatched: number;
        unmatchedNumbers: string[];
        saved: ImportedExamRow[];
      };
      message: string;
    }
  | {
      success: false;
      status:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "VALIDATION_FAILED"
        | "DATABASE_ERROR";
      message: string;
    };

type GuardCtx =
  | { ok: true; userId: string }
  | {
      ok: false;
      status: "UNAUTHORIZED" | "FORBIDDEN";
      message: string;
    };

async function getStudentId(): Promise<GuardCtx> {
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
  return { ok: true, userId: session.user.id };
}

async function getAdminId(): Promise<GuardCtx> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      status: "UNAUTHORIZED",
      message: "Oturum açmanız gerekiyor.",
    };
  }
  if (session.user.role !== "admin") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu işlem için yönetici yetkisi gerekli.",
    };
  }
  return { ok: true, userId: session.user.id };
}

async function getTeacherOrAdminId(): Promise<GuardCtx> {
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
  return { ok: true, userId: session.user.id };
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

function normalizeNumber(value: string): string {
  return value.trim();
}

function numericKey(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return String(parseInt(trimmed, 10));
  }
  return null;
}

const scoreField = z.coerce.number().min(-200).max(1000).optional();

const importMockExamsInputSchema = z.object({
  examName: z
    .string()
    .trim()
    .min(1, "Deneme adı boş olamaz.")
    .max(200, "Deneme adı çok uzun."),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sınav tarihi geçersiz."),
  rows: z
    .array(
      z.object({
        studentNumber: z
          .string()
          .trim()
          .min(1, "Öğrenci numarası boş olamaz.")
          .max(50, "Öğrenci numarası çok uzun."),
        turkceNet: scoreField,
        tarihNet: scoreField,
        cografyaNet: scoreField,
        felsefeNet: scoreField,
        dinNet: scoreField,
        matematikNet: scoreField,
        geometriNet: scoreField,
        fizikNet: scoreField,
        kimyaNet: scoreField,
        biyolojiNet: scoreField,
        toplamNet: scoreField,
        tytPuani: scoreField,
      }),
    )
    .max(5000, "Tek dosyada en fazla 5000 satır olabilir."),
});

export async function importMockExams(
  input: unknown,
): Promise<ImportMockExamsResult> {
  const ctx = await getAdminId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = importMockExamsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { examName, examDate, rows } = parsed.data;

  if (!isValidISODate(examDate)) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Sınav tarihi gerçek bir tarih olmalı (YYYY-MM-DD).",
    };
  }

  try {
    const studentRows = await db
      .select({ id: users.id, name: users.name, studentNumber: users.studentNumber })
      .from(users)
      .where(and(eq(users.role, "student"), isNotNull(users.studentNumber)));

    const byNormalized = new Map<string, (typeof studentRows)[number]>();
    const byNumeric = new Map<string, (typeof studentRows)[number]>();
    for (const s of studentRows) {
      const num = s.studentNumber ?? "";
      const normalized = normalizeNumber(num);
      if (normalized) {
        byNormalized.set(normalized, s);
        const key = numericKey(num);
        if (key !== null) byNumeric.set(key, s);
      }
    }

    const toInsert: Array<{
      studentId: string;
      studentName: string;
      studentNumber: string;
      turkceNet: number;
      tarihNet: number;
      cografyaNet: number;
      felsefeNet: number;
      dinNet: number;
      matematikNet: number;
      geometriNet: number;
      fizikNet: number;
      kimyaNet: number;
      biyolojiNet: number;
      toplamNet: number;
      tytPuani: number;
    }> = [];
    const unmatchedNumbers: string[] = [];

    for (const row of rows) {
      const normalized = normalizeNumber(row.studentNumber);
      let student = byNormalized.get(normalized);
      if (!student) {
        const key = numericKey(normalized);
        if (key !== null) student = byNumeric.get(key) ?? undefined;
      }

      if (!student) {
        unmatchedNumbers.push(normalized);
        continue;
      }

      toInsert.push({
        studentId: student.id,
        studentName: student.name || "İsimsiz öğrenci",
        studentNumber: student.studentNumber ?? normalized,
        turkceNet: row.turkceNet ?? 0,
        tarihNet: row.tarihNet ?? 0,
        cografyaNet: row.cografyaNet ?? 0,
        felsefeNet: row.felsefeNet ?? 0,
        dinNet: row.dinNet ?? 0,
        matematikNet: row.matematikNet ?? 0,
        geometriNet: row.geometriNet ?? 0,
        fizikNet: row.fizikNet ?? 0,
        kimyaNet: row.kimyaNet ?? 0,
        biyolojiNet: row.biyolojiNet ?? 0,
        toplamNet: row.toplamNet ?? 0,
        tytPuani: row.tytPuani ?? 0,
      });
    }

    let saved: ImportedExamRow[] = [];
    if (toInsert.length > 0) {
      const inserted = await db
        .insert(mockExams)
        .values(
          toInsert.map((r) => ({
            studentId: r.studentId,
            examName,
            examDate,
            turkceNet: r.turkceNet,
            tarihNet: r.tarihNet,
            cografyaNet: r.cografyaNet,
            felsefeNet: r.felsefeNet,
            dinNet: r.dinNet,
            matematikNet: r.matematikNet,
            geometriNet: r.geometriNet,
            fizikNet: r.fizikNet,
            kimyaNet: r.kimyaNet,
            biyolojiNet: r.biyolojiNet,
            toplamNet: r.toplamNet,
            tytPuani: r.tytPuani,
          })),
        )
        .onConflictDoUpdate({
          target: [mockExams.studentId, mockExams.examName, mockExams.examDate],
          set: {
            turkceNet: sql`excluded.turkce_net`,
            tarihNet: sql`excluded.tarih_net`,
            cografyaNet: sql`excluded.cografya_net`,
            felsefeNet: sql`excluded.felsefe_net`,
            dinNet: sql`excluded.din_net`,
            matematikNet: sql`excluded.matematik_net`,
            geometriNet: sql`excluded.geometri_net`,
            fizikNet: sql`excluded.fizik_net`,
            kimyaNet: sql`excluded.kimya_net`,
            biyolojiNet: sql`excluded.biyoloji_net`,
            toplamNet: sql`excluded.toplam_net`,
            tytPuani: sql`excluded.tyt_puani`,
          } as {
            id?: number;
            studentId?: string;
            examName?: string;
            examDate?: string;
            turkceNet?: unknown;
            tarihNet?: unknown;
            cografyaNet?: unknown;
            felsefeNet?: unknown;
            dinNet?: unknown;
            matematikNet?: unknown;
            geometriNet?: unknown;
            fizikNet?: unknown;
            kimyaNet?: unknown;
            biyolojiNet?: unknown;
            toplamNet?: unknown;
            tytPuani?: unknown;
            createdAt?: Date;
          },
        })
        .returning({ studentId: mockExams.studentId });

      const savedStudentIds = new Set(inserted.map((i) => i.studentId));
      saved = toInsert.filter((r) => savedStudentIds.has(r.studentId));
    }

    return {
      success: true,
      data: {
        total: rows.length,
        matched: saved.length,
        unmatched: unmatchedNumbers.length,
        unmatchedNumbers,
        saved,
      },
      message: `${saved.length} öğrencinin sonucu "${examName}" denemesine kaydedildi.`,
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

export type MockExamsResult =
  | { success: true; data: MockExamRecord[] }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export async function getMyMockExams(): Promise<MockExamsResult> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const rows = await db
      .select()
      .from(mockExams)
      .where(eq(mockExams.studentId, ctx.userId))
      .orderBy(desc(mockExams.examDate), desc(mockExams.createdAt));

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        examName: r.examName,
        examDate: r.examDate,
        turkceNet: r.turkceNet,
        tarihNet: r.tarihNet,
        cografyaNet: r.cografyaNet,
        felsefeNet: r.felsefeNet,
        dinNet: r.dinNet,
        matematikNet: r.matematikNet,
        geometriNet: r.geometriNet,
        fizikNet: r.fizikNet,
        kimyaNet: r.kimyaNet,
        biyolojiNet: r.biyolojiNet,
        toplamNet: r.toplamNet,
        tytPuani: r.tytPuani,
      })),
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

export async function getStudentMockExams(
  studentId: string,
): Promise<MockExamsResult> {
  const ctx = await getTeacherOrAdminId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    if (!(await isAssigned(ctx.userId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const rows = await db
      .select()
      .from(mockExams)
      .where(eq(mockExams.studentId, studentId))
      .orderBy(desc(mockExams.examDate), desc(mockExams.createdAt));

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        examName: r.examName,
        examDate: r.examDate,
        turkceNet: r.turkceNet,
        tarihNet: r.tarihNet,
        cografyaNet: r.cografyaNet,
        felsefeNet: r.felsefeNet,
        dinNet: r.dinNet,
        matematikNet: r.matematikNet,
        geometriNet: r.geometriNet,
        fizikNet: r.fizikNet,
        kimyaNet: r.kimyaNet,
        biyolojiNet: r.biyolojiNet,
        toplamNet: r.toplamNet,
        tytPuani: r.tytPuani,
      })),
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