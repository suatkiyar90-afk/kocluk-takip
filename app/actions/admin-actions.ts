"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  curriculumTopics,
  dailyQuestionEntries,
  teacherStudents,
  users,
} from "@/db/schema";
import { actionErrorMessage } from "@/lib/action-error";

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

export interface RecentLogin {
  id: string;
  name: string;
  roleLabel: string;
  lastLoginAt: string;
}

export interface RecentDataEntry {
  id: number;
  studentName: string;
  examType: string;
  subjectName: string;
  totalSolved: number;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  student: "Öğrenci",
  teacher: "Öğretmen",
  admin: "Yönetici",
};

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

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

function addUsernameIssues(
  ctx: z.RefinementCtx,
  username: string,
  path: (string | number)[],
): void {
  if (username.includes("@")) {
    ctx.addIssue({
      code: "custom",
      path,
      message: "Kullanıcı adı '@' içeremez.",
    });
    return;
  }
  if (
    username.length < 3 ||
    username.length > 30 ||
    !USERNAME_PATTERN.test(username)
  ) {
    ctx.addIssue({
      code: "custom",
      path,
      message:
        "Kullanıcı adı 3-30 karakter olmalı; yalnızca a-z, 0-9, nokta, alt çizgi ve tire içerebilir.",
    });
  }
}

const createUserSchema = z
  .object({
    name: z.string().trim().min(1, "Ad boş olamaz.").max(100),
    email: z.string().trim().toLowerCase(),
    password: z.string().min(6, "Şifre en az 6 karakter olmalı.").max(200),
    role: z.enum(["teacher", "student"]),
    studentNumber: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (v) =>
          v === undefined ||
          v === null ||
          v === "" ||
          /^[A-Za-z0-9\-/._]{1,50}$/.test(v),
        "Öğrenci numarası geçersiz.",
      ),
  })
  .superRefine((value, ctx) => {
    if (value.role === "teacher") {
      addUsernameIssues(ctx, value.email, ["email"]);
      return;
    }
    const parsedEmail = z
      .string()
      .trim()
      .min(1, "E-posta boş olamaz.")
      .email("Geçerli bir e-posta girin.")
      .safeParse(value.email);
    if (!parsedEmail.success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message:
          parsedEmail.error.issues[0]?.message ?? "Geçerli bir e-posta girin.",
      });
    }
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
    if (role === "teacher") {
      const existingUsername = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.email, email), eq(users.studentNumber, email)))
        .limit(1);
      if (existingUsername.length > 0) {
        return {
          success: false,
          status: "CONFLICT",
          message: "Bu kullanıcı adı zaten kullanılıyor.",
        };
      }
    } else {
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
        actionErrorMessage(err),
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
        actionErrorMessage(err),
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
        actionErrorMessage(err),
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
        actionErrorMessage(err),
    };
  }
}

const PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASSWORD_LOWER = "abcdefghijkmnopqrstuvwxyz";
const PASSWORD_DIGITS = "23456789";

function generateTemporaryPassword(): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const chars: string[] = [];
  for (let i = 0; i < 4; i++) chars.push(pick(PASSWORD_UPPER));
  for (let i = 0; i < 4; i++) chars.push(pick(PASSWORD_LOWER));
  for (let i = 0; i < 4; i++) chars.push(pick(PASSWORD_DIGITS));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}

const resetPasswordSchema = z.object({
  userId: z.string().uuid("Geçerli bir kullanıcı seçin."),
});

export interface AdminResetPasswordData {
  userId: string;
  name: string;
  password: string;
}

export async function adminResetUserPassword(
  input: unknown,
): Promise<AdminActionResult<AdminResetPasswordData>> {
  const ctx = await getAdminUserId();
  if (ctx.ok === false) {
    return { success: false, status: "UNAUTHORIZED", message: ctx.message };
  }

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const rows = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, parsed.data.userId))
      .limit(1);
    const target = rows[0];
    if (!target || (target.role !== "teacher" && target.role !== "student")) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Sıfırlanacak kullanıcı bulunamadı.",
      };
    }

    const password = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(users.id, target.id));

    return {
      success: true,
      data: { userId: target.id, name: target.name, password },
      message: `${target.name} için yeni şifre oluşturuldu.`,
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

const updateUsernameSchema = z
  .object({
    userId: z.string().uuid("Geçerli bir kullanıcı seçin."),
    username: z.string().trim().toLowerCase(),
  })
  .superRefine((value, ctx) => {
    addUsernameIssues(ctx, value.username, ["username"]);
  });

export async function adminUpdateTeacherUsername(
  input: unknown,
): Promise<AdminActionResult<{ userId: string; username: string }>> {
  const ctx = await getAdminUserId();
  if (ctx.ok === false) {
    return { success: false, status: "UNAUTHORIZED", message: ctx.message };
  }

  const parsed = updateUsernameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { userId, username } = parsed.data;

  try {
    const targetRows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const target = targetRows[0];
    if (!target || target.role !== "teacher") {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Güncellenecek öğretmen bulunamadı.",
      };
    }

    const clashRows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          or(eq(users.email, username), eq(users.studentNumber, username)),
          ne(users.id, userId),
        ),
      )
      .limit(1);
    if (clashRows.length > 0) {
      return {
        success: false,
        status: "CONFLICT",
        message: "Bu kullanıcı adı zaten kullanılıyor.",
      };
    }

    await db.update(users).set({ email: username }).where(eq(users.id, userId));

    return {
      success: true,
      data: { userId, username },
      message: "Kullanıcı adı güncellendi.",
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

export async function getRecentLogins(): Promise<
  AdminActionResult<{ logins: RecentLogin[] }>
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
        role: users.role,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(isNotNull(users.lastLoginAt))
      .orderBy(desc(users.lastLoginAt))
      .limit(20);

    const logins: RecentLogin[] = [];
    for (const row of rows) {
      if (!row.lastLoginAt) {
        continue;
      }
      logins.push({
        id: row.id,
        name: row.name || "İsimsiz kullanıcı",
        roleLabel: ROLE_LABELS[row.role] ?? row.role,
        lastLoginAt: row.lastLoginAt.toISOString(),
      });
    }

    return {
      success: true,
      data: { logins },
      message: "Son girişler yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export async function getRecentDataEntries(): Promise<
  AdminActionResult<{ entries: RecentDataEntry[] }>
> {
  const ctx = await getAdminUserId();
  if (ctx.ok === false) {
    return { success: false, status: "UNAUTHORIZED", message: ctx.message };
  }

  try {
    const rows = await db
      .select({
        id: dailyQuestionEntries.id,
        studentName: users.name,
        examType: dailyQuestionEntries.examType,
        subjectName: curriculumTopics.subjectName,
        totalSolved: sql<number>`${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}`,
        createdAt: dailyQuestionEntries.createdAt,
      })
      .from(dailyQuestionEntries)
      .innerJoin(users, eq(dailyQuestionEntries.studentId, users.id))
      .innerJoin(
        curriculumTopics,
        eq(curriculumTopics.id, dailyQuestionEntries.topicId),
      )
      .orderBy(desc(dailyQuestionEntries.createdAt))
      .limit(20);

    const entries: RecentDataEntry[] = rows.map((row) => ({
      id: row.id,
      studentName: row.studentName || "İsimsiz öğrenci",
      examType: row.examType,
      subjectName: row.subjectName,
      totalSolved: Number(row.totalSolved),
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: { entries },
      message: "Son veri girişleri yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}