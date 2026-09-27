"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { teacherStudents, users } from "@/db/schema";

export interface AdminTeacher {
  id: string;
  name: string;
  email: string | null;
}

export interface AdminStudent {
  id: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
}

export type AdminActionResult<T> =
  | { success: true; data: T; message: string }
  | {
      success: false;
      status: "UNAUTHORIZED" | "VALIDATION_FAILED" | "CONFLICT" | "DATABASE_ERROR";
      message: string;
    };

const UNAUTHORIZED_MESSAGE = "Oturum açmanız gerekiyor.";
const NOT_ADMIN_MESSAGE = "Bu işlem için yönetici yetkisi gerekli.";

async function getAdminUserId(): Promise<
  | { ok: true; adminId: string }
  | { ok: false; message: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: UNAUTHORIZED_MESSAGE };
  }
  if (session.user.role !== "admin") {
    return {
      ok: false,
      message: NOT_ADMIN_MESSAGE,
    };
  }
  return { ok: true, adminId: session.user.id };
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Ad boş olamaz.").max(100),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı.").max(200),
  role: z.enum(["teacher", "student"]),
  studentNumber: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine(
      (v) => v === undefined || v === null || v === "" || /^[A-Za-z0-9\-/._]{1,50}$/.test(v),
      "Öğrenci numarası geçersiz.",
    ),
});

export async function adminCreateUser(
  input: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const ctx = await getAdminUserId();
  if (ctx.ok === false) {
    return { success: false, status: "UNAUTHORIZED", message: ctx.message };
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { name, email, password, role, studentNumber } = parsed.data;
  const normalizedStudentNumber =
    role === "student" && studentNumber ? studentNumber.trim() : null;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      return {
        success: false,
        status: "CONFLICT",
        message: "Bu e-posta ile kayıtlı bir kullanıcı zaten var.",
      };
    }

    if (normalizedStudentNumber) {
      const existingNumber = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.studentNumber, normalizedStudentNumber))
        .limit(1);
      if (existingNumber.length > 0) {
        return {
          success: false,
          status: "CONFLICT",
          message: "Bu öğrenci numarası başka bir kullanıcıya ait.",
        };
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await db
      .insert(users)
      .values({
        name,
        email,
        role,
        studentNumber: normalizedStudentNumber,
        passwordHash,
        mustChangePassword: true,
      })
      .returning({ id: users.id });

    const roleLabel = role === "teacher" ? "Öğretmen" : "Öğrenci";
    return {
      success: true,
      data: { id: inserted[0].id },
      message: `${roleLabel} kaydedildi.`,
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

const bulkStudentsSchema = z.object({
  rows: z
    .array(
      z.object({
        fullName: z
          .string()
          .trim()
          .min(1, "Ad soyad boş olamaz.")
          .max(100, "Ad soyad çok uzun."),
        studentNumber: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9\-/._]{1,50}$/, "Öğrenci numarası geçersiz."),
      }),
    )
    .min(1, "En az 1 satır gerekli.")
    .max(1000, "Tek dosyada en fazla 1000 öğrenci olabilir."),
});

export interface BulkCreateSkipped {
  studentNumber: string;
  fullName: string;
  reason: string;
}

export interface BulkCreateData {
  created: number;
  skipped: BulkCreateSkipped[];
}

export async function bulkCreateStudents(
  input: unknown,
): Promise<AdminActionResult<BulkCreateData>> {
  const ctx = await getAdminUserId();
  if (ctx.ok === false) {
    return { success: false, status: "UNAUTHORIZED", message: ctx.message };
  }

  const parsed = bulkStudentsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const skipped: BulkCreateSkipped[] = [];
  const toInsert: Array<{
    name: string;
    email: string;
    role: "student";
    studentNumber: string;
    passwordHash: string;
    mustChangePassword: true;
  }> = [];

  try {
    const seenNumbers = new Set<string>();
    const numbers = parsed.data.rows.map((r) => r.studentNumber);
    const emails = numbers.map((n) => `${n}@kocluk.local`);

    const [existingNumberRows, existingEmailRows] = await Promise.all([
      db
        .select({ studentNumber: users.studentNumber })
        .from(users)
        .where(inArray(users.studentNumber, numbers)),
      db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, emails)),
    ]);

    const existingNumbers = new Set(
      existingNumberRows
        .map((r) => r.studentNumber)
        .filter((v): v is string => v !== null),
    );
    const existingEmails = new Set(
      existingEmailRows
        .map((r) => r.email)
        .filter((v): v is string => v !== null),
    );

    const passwordHash = await bcrypt.hash("123456", 10);

    for (const row of parsed.data.rows) {
      const number = row.studentNumber;
      if (seenNumbers.has(number)) {
        skipped.push({
          studentNumber: number,
          fullName: row.fullName,
          reason: "Dosyada tekrar eden numara.",
        });
        continue;
      }
      seenNumbers.add(number);

      if (existingNumbers.has(number) || existingEmails.has(`${number}@kocluk.local`)) {
        skipped.push({
          studentNumber: number,
          fullName: row.fullName,
          reason: "Bu numara sistemde zaten kayıtlı.",
        });
        continue;
      }

      toInsert.push({
        name: row.fullName,
        email: `${number}@kocluk.local`,
        role: "student",
        studentNumber: number,
        passwordHash,
        mustChangePassword: true,
      });
    }

    if (toInsert.length > 0) {
      await db.insert(users).values(toInsert);
    }

    return {
      success: true,
      data: { created: toInsert.length, skipped },
      message: `${toInsert.length} öğrenci eklendi${
        skipped.length > 0 ? `, ${skipped.length} satır atlandı.` : "."
      }`,
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

export async function adminListUsers(): Promise<
  AdminActionResult<{ teachers: AdminTeacher[]; students: AdminStudent[] }>
> {
  const ctx = await getAdminUserId();
  if (ctx.ok === false) {
    return { success: false, status: "UNAUTHORIZED", message: ctx.message };
  }

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        studentNumber: users.studentNumber,
      })
      .from(users)
      .where(
        or(eq(users.role, "teacher"), eq(users.role, "student")),
      );

    const teachers = rows
      .filter((r) => r.role === "teacher")
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map((r) => ({ id: r.id, name: r.name, email: r.email }));
    const students = rows
      .filter((r) => r.role === "student")
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        studentNumber: r.studentNumber,
      }));

    return {
      success: true,
      data: { teachers, students },
      message: "",
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

const assignTeacherSchema = z.object({
  teacherId: z.string().uuid("Geçerli bir öğretmen seçin."),
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
});

export async function adminAssignTeacher(
  input: unknown,
): Promise<AdminActionResult<{ assigned: boolean }>> {
  const ctx = await getAdminUserId();
  if (ctx.ok === false) {
    return { success: false, status: "UNAUTHORIZED", message: ctx.message };
  }

  const parsed = assignTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { teacherId, studentId } = parsed.data;

  try {
    const teacherRows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, teacherId), eq(users.role, "teacher")))
      .limit(1);
    if (teacherRows.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Seçilen öğretmen bulunamadı.",
      };
    }

    const studentRows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, "student")))
      .limit(1);
    if (studentRows.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Seçilen öğrenci bulunamadı.",
      };
    }

    const existingLink = await db
      .select({ id: teacherStudents.id })
      .from(teacherStudents)
      .where(
        and(
          eq(teacherStudents.teacherId, teacherId),
          eq(teacherStudents.studentId, studentId),
        ),
      )
      .limit(1);

    if (existingLink.length > 0) {
      return {
        success: true,
        data: { assigned: false },
        message: "Bu öğrenci zaten seçilen öğretmene atanmış.",
      };
    }

    await db
      .insert(teacherStudents)
      .values({ teacherId, studentId })
      .onConflictDoNothing();

    return {
      success: true,
      data: { assigned: true },
      message: "Öğrenci öğretmene atandı.",
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