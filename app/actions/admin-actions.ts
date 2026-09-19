"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { and, eq, or } from "drizzle-orm";
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
  weeklyTarget: number;
}

export type AdminActionResult<T> =
  | { success: true; data: T; message: string }
  | {
      success: false;
      status: "UNAUTHORIZED" | "VALIDATION_FAILED" | "CONFLICT" | "DATABASE_ERROR";
      message: string;
    };

async function getAdminUserId(): Promise<
  | { ok: true; adminId: string }
  | { ok: false; message: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Oturum aÃ§manÄ±z gerekiyor." };
  }
  if (session.user.role !== "admin") {
    return {
      ok: false,
      message: "Bu iÅŸlem iÃ§in yÃ¶netici yetkisi gerekli.",
    };
  }
  return { ok: true, adminId: session.user.id };
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Ad boÅŸ olamaz.").max(100),
  email: z.string().trim().toLowerCase().email("GeÃ§erli bir e-posta girin."),
  password: z.string().min(6, "Åifre en az 6 karakter olmalÄ±.").max(200),
  role: z.enum(["teacher", "student"]),
  weeklyTarget: z.coerce
    .number()
    .int()
    .min(0)
    .max(1000)
    .default(0),
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
  const { name, email, password, role, weeklyTarget } = parsed.data;

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
        message: "Bu e-posta ile kayÄ±tlÄ± bir kullanÄ±cÄ± zaten var.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await db
      .insert(users)
      .values({
        name,
        email,
        role,
        passwordHash,
        weeklyTarget: role === "student" ? weeklyTarget : 0,
      })
      .returning({ id: users.id });

    const roleLabel = role === "teacher" ? "Ã–ÄŸretmen" : "Ã–ÄŸrenci";
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
        err instanceof Error ? err.message : "Bilinmeyen veritabanÄ± hatasÄ±.",
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
        weeklyTarget: users.weeklyTarget,
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
        weeklyTarget: r.weeklyTarget,
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
        err instanceof Error ? err.message : "Bilinmeyen veritabanÄ± hatasÄ±.",
    };
  }
}

const assignTeacherSchema = z.object({
  teacherId: z.string().uuid("GeÃ§erli bir Ã¶ÄŸretmen seÃ§in."),
  studentId: z.string().uuid("GeÃ§erli bir Ã¶ÄŸrenci seÃ§in."),
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
        message: "SeÃ§ilen Ã¶ÄŸretmen bulunamadÄ±.",
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
        message: "SeÃ§ilen Ã¶ÄŸrenci bulunamadÄ±.",
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
        message: "Bu Ã¶ÄŸrenci zaten seÃ§ilen Ã¶ÄŸretmene atanmÄ±ÅŸ.",
      };
    }

    await db
      .insert(teacherStudents)
      .values({ teacherId, studentId })
      .onConflictDoNothing();

    return {
      success: true,
      data: { assigned: true },
      message: "Ã–ÄŸrenci Ã¶ÄŸretmene atandÄ±.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanÄ± hatasÄ±.",
    };
  }
}