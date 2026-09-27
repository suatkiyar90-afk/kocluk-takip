"use server";

import { z } from "zod";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  coachingFeedbacks,
  curriculumTopics,
  dailyQuestionEntries,
  teacherStudents,
  weeklyTargets,
} from "@/db/schema";
import { parseMonday } from "@/lib/week-utils";
import { sendPushNotification } from "@/lib/web-push-helper";

export type WeeklyTargetActionResult<T> =
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

export interface WeeklyTargetView {
  id: number;
  subjectId: string;
  subjectName: string;
  examType: "TYT" | "AYT";
  targetQuestionCount: number;
  solvedCount: number;
  targetTopics: Array<{
    topicId: number;
    topicName: string;
    solved: boolean;
  }>;
}

async function getTeacherId(): Promise<
  | { ok: true; teacherId: string }
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
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu işlem için öğretmen yetkisi gerekli.",
    };
  }
  return { ok: true, teacherId: session.user.id };
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

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function buildTargetViews(
  studentId: string,
  weekStart: string,
): Promise<WeeklyTargetView[]> {
  const targets = await db
    .select()
    .from(weeklyTargets)
    .where(
      and(
        eq(weeklyTargets.studentId, studentId),
        eq(weeklyTargets.weekStartDate, weekStart),
      ),
    )
    .orderBy(weeklyTargets.subjectId);

  if (targets.length === 0) {
    return [];
  }

  const subjectIds = [...new Set(targets.map((t) => t.subjectId))];
  const weekEnd = addDaysISO(weekStart, 6);

  const [topicRows, dailyRows] = await Promise.all([
    db
      .select()
      .from(curriculumTopics)
      .where(inArray(curriculumTopics.subjectId, subjectIds)),
    db
      .select({
        subjectId: dailyQuestionEntries.subjectId,
        topicId: dailyQuestionEntries.topicId,
        correct: dailyQuestionEntries.correct,
        wrong: dailyQuestionEntries.wrong,
        blank: dailyQuestionEntries.blank,
      })
      .from(dailyQuestionEntries)
      .where(
        and(
          eq(dailyQuestionEntries.studentId, studentId),
          gte(dailyQuestionEntries.date, weekStart),
          lte(dailyQuestionEntries.date, weekEnd),
        ),
      ),
  ]);

  const subjectInfoById = new Map<
    string,
    { name: string; examType: "TYT" | "AYT" }
  >();
  const topicNameById = new Map<number, string>();
  for (const t of topicRows) {
    topicNameById.set(t.id, t.topicName);
    if (!subjectInfoById.has(t.subjectId)) {
      subjectInfoById.set(t.subjectId, {
        name: t.subjectName,
        examType: t.examType,
      });
    }
  }

  const solvedBySubject = new Map<string, number>();
  const solvedTopicsBySubject = new Map<string, Set<number>>();
  for (const d of dailyRows) {
    solvedBySubject.set(
      d.subjectId,
      (solvedBySubject.get(d.subjectId) ?? 0) + d.correct + d.wrong + d.blank,
    );
    let set = solvedTopicsBySubject.get(d.subjectId);
    if (!set) {
      set = new Set<number>();
      solvedTopicsBySubject.set(d.subjectId, set);
    }
    set.add(d.topicId);
  }

  return targets.map((t) => {
    const info = subjectInfoById.get(t.subjectId);
    const solvedTopics = solvedTopicsBySubject.get(t.subjectId) ?? new Set<number>();
    return {
      id: t.id,
      subjectId: t.subjectId,
      subjectName: info?.name ?? t.subjectId,
      examType: info?.examType ?? "TYT",
      targetQuestionCount: t.targetQuestionCount,
      solvedCount: solvedBySubject.get(t.subjectId) ?? 0,
      targetTopics: t.targetTopics.map((topicId) => ({
        topicId,
        topicName: topicNameById.get(topicId) ?? `Konu #${topicId}`,
        solved: solvedTopics.has(topicId),
      })),
    };
  });
}

const saveWeeklyTargetSchema = z.object({
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Hafta başlangıcı geçersiz."),
  subjectId: z.string().trim().min(1, "Ders seçin.").max(50),
  targetQuestionCount: z
    .number()
    .int("Hedef soru sayısı tam sayı olmalı.")
    .min(1, "Hedef soru sayısı en az 1 olmalı.")
    .max(10000, "Hedef soru sayısı çok büyük."),
  targetTopics: z
    .array(z.number().int().positive())
    .max(500, "Çok fazla konu seçildi."),
});

export async function saveWeeklyTarget(
  input: unknown,
): Promise<WeeklyTargetActionResult<{ id: number }>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = saveWeeklyTargetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { studentId, subjectId, targetQuestionCount, targetTopics } = parsed.data;
  const weekStart = parseMonday(parsed.data.weekStart);

  try {
    if (!(await isAssigned(ctx.teacherId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const row = {
      studentId,
      teacherId: ctx.teacherId,
      weekStartDate: weekStart,
      subjectId,
      targetQuestionCount,
      targetTopics,
    };

    const updateSet = {
      teacherId: ctx.teacherId,
      targetQuestionCount,
      targetTopics,
    };

    const saved = await db
      .insert(weeklyTargets)
      .values(row)
      .onConflictDoUpdate({
        target: [
          weeklyTargets.studentId,
          weeklyTargets.weekStartDate,
          weeklyTargets.subjectId,
        ],
        set: updateSet,
      })
      .returning({ id: weeklyTargets.id });

    await sendPushNotification(
      studentId,
      "Yeni Haftalık Dönüt",
      "Koç öğretmenin bu hafta için sana yeni hedefler ve değerlendirmeler yazdı.",
      "/weekly-targets",
    );

    return { success: true, data: { id: saved[0].id } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

export async function listWeeklyTargets(
  studentId: string,
  weekStartArg?: string,
): Promise<WeeklyTargetActionResult<WeeklyTargetView[]>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    if (!(await isAssigned(ctx.teacherId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const views = await buildTargetViews(studentId, parseMonday(weekStartArg));
    return { success: true, data: views };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

export async function deleteWeeklyTarget(
  targetId: number,
): Promise<WeeklyTargetActionResult<{ id: number }>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const rows = await db
      .delete(weeklyTargets)
      .where(
        and(
          eq(weeklyTargets.id, targetId),
          eq(weeklyTargets.teacherId, ctx.teacherId),
        ),
      )
      .returning({ id: weeklyTargets.id });

    if (rows.length === 0) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Hedef bulunamadı veya silme yetkiniz yok.",
      };
    }

    return { success: true, data: { id: rows[0].id } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

export async function getMyWeeklyTargets(
  weekStartArg?: string,
): Promise<WeeklyTargetActionResult<WeeklyTargetView[]>> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const views = await buildTargetViews(ctx.studentId, parseMonday(weekStartArg));
    return { success: true, data: views };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

export async function getMyWeeklyFeedback(
  weekStartArg?: string,
): Promise<WeeklyTargetActionResult<{ comment: string | null }>> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const weekStart = parseMonday(weekStartArg);

  try {
    const rows = await db
      .select({ comment: coachingFeedbacks.comment })
      .from(coachingFeedbacks)
      .where(
        and(
          eq(coachingFeedbacks.studentId, ctx.studentId),
          eq(coachingFeedbacks.weekStart, weekStart),
        ),
      )
      .orderBy(desc(coachingFeedbacks.createdAt))
      .limit(1);

    return { success: true, data: { comment: rows[0]?.comment ?? null } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}
