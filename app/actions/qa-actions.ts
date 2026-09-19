"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { qaThreads, teacherStudents } from "@/db/schema";

export type QaActionResult<T> =
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

export interface QaThreadSummary {
  id: number;
  questionImageUrl: string;
  studentNote: string;
  teacherReplyText: string | null;
  teacherReplyAudioUrl: string | null;
  teacherReplyImageUrl: string | null;
  status: "bekliyor" | "cevaplandı";
  createdAt: string;
  studentId: string;
}

const urlField = z
  .string()
  .min(1, "Dosya adresi gerekli")
  .max(2000, "Dosya adresi çok uzun")
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
    "Dosya adresi http ile başlamalı veya / yolunda olmalı",
  );

const askQuestionSchema = z.object({
  questionImageUrl: urlField,
  studentNote: z
    .string()
    .trim()
    .max(1000, "Not en fazla 1000 karakter olabilir")
    .optional()
    .default(""),
});

export type AskQuestionInput = z.infer<typeof askQuestionSchema>;

export async function askQuestion(
  input: unknown,
): Promise<QaActionResult<QaThreadSummary>> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = askQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  try {
    const teacherRows = await db
      .select({ teacherId: teacherStudents.teacherId })
      .from(teacherStudents)
      .where(eq(teacherStudents.studentId, ctx.studentId))
      .limit(1);
    const values = {
      studentId: ctx.studentId,
      teacherId: teacherRows[0]?.teacherId ?? null,
      questionImageUrl: parsed.data.questionImageUrl,
      studentNote: parsed.data.studentNote,
    };
    const [row] = await db
      .insert(qaThreads)
      .values(values)
      .returning({
        id: qaThreads.id,
        questionImageUrl: qaThreads.questionImageUrl,
        studentNote: qaThreads.studentNote,
        teacherReplyText: qaThreads.teacherReplyText,
        teacherReplyAudioUrl: qaThreads.teacherReplyAudioUrl,
        teacherReplyImageUrl: qaThreads.teacherReplyImageUrl,
        status: qaThreads.status,
        createdAt: qaThreads.createdAt,
        studentId: qaThreads.studentId,
      });

    return {
      success: true,
      data: {
        ...row,
        createdAt: row.createdAt.toJSON(),
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

export async function listMyQuestions(): Promise<
  QaActionResult<QaThreadSummary[]>
> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const rows = await db
      .select()
      .from(qaThreads)
      .where(eq(qaThreads.studentId, ctx.studentId))
      .orderBy(desc(qaThreads.createdAt));

    return {
      success: true,
      data: rows.map(toSummary),
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

export async function listStudentThreads(
  studentId: string,
): Promise<QaActionResult<QaThreadSummary[]>> {
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

    const rows = await db
      .select()
      .from(qaThreads)
      .where(eq(qaThreads.studentId, studentId))
      .orderBy(desc(qaThreads.createdAt));

    return {
      success: true,
      data: rows.map(toSummary),
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

const answerQuestionSchema = z
  .object({
    threadId: z.number().int().positive(),
    teacherReplyText: z
      .string()
      .trim()
      .max(4000, "Yanıt en fazla 4000 karakter olabilir")
      .optional()
      .default(""),
    teacherReplyImageUrl: urlField.optional(),
    teacherReplyAudioUrl: urlField.optional(),
  })
  .refine(
    (data) =>
      data.teacherReplyText.length > 0 ||
      Boolean(data.teacherReplyImageUrl) ||
      Boolean(data.teacherReplyAudioUrl),
    {
      message: "Yanıt olarak en az metin, görsel veya ses ekleyin.",
      path: ["teacherReplyText"],
    },
  );

export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;

export async function answerQuestion(
  input: unknown,
): Promise<QaActionResult<QaThreadSummary>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = answerQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const { threadId, teacherReplyText, teacherReplyImageUrl, teacherReplyAudioUrl } =
    parsed.data;

  try {
    const threadRows = await db
      .select({ studentId: qaThreads.studentId })
      .from(qaThreads)
      .where(eq(qaThreads.id, threadId))
      .limit(1);

    const thread = threadRows[0];
    if (!thread) {
      return {
        success: false,
        status: "DATABASE_ERROR",
        message: "Soru bulunamadı.",
      };
    }

    if (!(await isAssigned(ctx.teacherId, thread.studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const setValues = {
      teacherId: ctx.teacherId,
      teacherReplyText: teacherReplyText || null,
      teacherReplyImageUrl: teacherReplyImageUrl ?? null,
      teacherReplyAudioUrl: teacherReplyAudioUrl ?? null,
      status: "cevaplandı",
    } as {
      questionImageUrl?: string;
      studentId?: string;
      teacherId: string;
      teacherReplyText: string | null;
      teacherReplyImageUrl: string | null;
      teacherReplyAudioUrl: string | null;
      status: "bekliyor" | "cevaplandı";
    };
    const [row] = await db
      .update(qaThreads)
      .set(setValues)
      .where(eq(qaThreads.id, threadId))
      .returning({
        id: qaThreads.id,
        questionImageUrl: qaThreads.questionImageUrl,
        studentNote: qaThreads.studentNote,
        teacherReplyText: qaThreads.teacherReplyText,
        teacherReplyAudioUrl: qaThreads.teacherReplyAudioUrl,
        teacherReplyImageUrl: qaThreads.teacherReplyImageUrl,
        status: qaThreads.status,
        createdAt: qaThreads.createdAt,
        studentId: qaThreads.studentId,
      });

    if (!row) {
      return {
        success: false,
        status: "DATABASE_ERROR",
        message: "Soru bulunamadı.",
      };
    }

    return {
      success: true,
      data: {
        ...row,
        createdAt: row.createdAt.toJSON(),
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

function toSummary(row: {
  id: number;
  questionImageUrl: string;
  studentNote: string;
  teacherReplyText: string | null;
  teacherReplyAudioUrl: string | null;
  teacherReplyImageUrl: string | null;
  status: "bekliyor" | "cevaplandı";
  studentId: string;
  createdAt: Date;
}): QaThreadSummary {
  return {
    id: row.id,
    questionImageUrl: row.questionImageUrl,
    studentNote: row.studentNote,
    teacherReplyText: row.teacherReplyText,
    teacherReplyAudioUrl: row.teacherReplyAudioUrl,
    teacherReplyImageUrl: row.teacherReplyImageUrl,
    status: row.status,
    studentId: row.studentId,
    createdAt: row.createdAt.toJSON(),
  };
}