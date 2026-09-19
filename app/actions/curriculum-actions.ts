"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  curriculumTopics,
  studentTopicProgress,
  teacherStudents,
} from "@/db/schema";
import { ALL_SUBJECTS } from "@/components/quiz-entry/weekly-quiz-schema";

export type TopicStatus = "baslamadi" | "calisiliyor" | "bitti";

export interface CurriculumTopicRow {
  topicId: number;
  topicName: string;
  status: TopicStatus;
}

export interface CurriculumSubjectGroup {
  subjectId: string;
  subjectName: string;
  totalTopics: number;
  doneTopics: number;
  inProgressTopics: number;
  topics: CurriculumTopicRow[];
}

export interface CurriculumSnapshot {
  tyt: CurriculumSubjectGroup[];
  ayt: CurriculumSubjectGroup[];
  totalTopics: number;
  doneTopics: number;
  inProgressTopics: number;
  notStartedTopics: number;
}

export type CurriculumActionResult<T> =
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

async function loadSnapshot(studentId: string): Promise<CurriculumSnapshot> {
  const [topicRows, progressRows] = await Promise.all([
    db
      .select()
      .from(curriculumTopics)
      .orderBy(
        curriculumTopics.examType,
        curriculumTopics.subjectId,
        curriculumTopics.sortOrder,
      ),
    db
      .select()
      .from(studentTopicProgress)
      .where(eq(studentTopicProgress.studentId, studentId)),
  ]);

  const statusById = new Map<number, TopicStatus>(
    progressRows.map((p) => [p.topicId, p.status]),
  );

  const groups = new Map<string, CurriculumSubjectGroup>();
  for (const t of topicRows) {
    const subject = ALL_SUBJECTS[t.examType].find(
      (s) => s.id === t.subjectId,
    );
    if (!subject) continue;
    const key = `${t.examType}:${t.subjectId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        subjectId: t.subjectId,
        subjectName: t.subjectName,
        totalTopics: 0,
        doneTopics: 0,
        inProgressTopics: 0,
        topics: [],
      };
      groups.set(key, group);
    }
    group.topics.push({
      topicId: t.id,
      topicName: t.topicName,
      status: statusById.get(t.id) ?? "baslamadi",
    });
  }

  const rankMap = new Map<string, number>();
  (["TYT", "AYT"] as const).forEach((examType) => {
    ALL_SUBJECTS[examType].forEach((s, index) => {
      rankMap.set(`${examType}:${s.id}`, index);
    });
  });

  const sorted = [...groups.values()].sort((a, b) => {
    const aRank = rankMap.get(`TYT:${a.subjectId}`) ?? 99;
    const bRank = rankMap.get(`TYT:${b.subjectId}`) ?? 99;
    return aRank - bRank;
  });

  const tyt: CurriculumSubjectGroup[] = [];
  const ayt: CurriculumSubjectGroup[] = [];

  let doneTopics = 0;
  let inProgressTopics = 0;

  for (const group of sorted) {
    group.totalTopics = group.topics.length;
    group.doneTopics = group.topics.filter((t) => t.status === "bitti").length;
    group.inProgressTopics = group.topics.filter(
      (t) => t.status === "calisiliyor",
    ).length;
    doneTopics += group.doneTopics;
    inProgressTopics += group.inProgressTopics;

    if (rankMap.has(`TYT:${group.subjectId}`)) {
      tyt.push(group);
    } else {
      ayt.push(group);
    }
  }

  return {
    tyt,
    ayt,
    totalTopics:
      tyt.reduce((s, g) => s + g.totalTopics, 0) +
      ayt.reduce((s, g) => s + g.totalTopics, 0),
    doneTopics,
    inProgressTopics,
    notStartedTopics: 0,
  };
}

export async function getMyCurriculum(): Promise<
  CurriculumActionResult<CurriculumSnapshot>
> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const snapshot = await loadSnapshot(ctx.studentId);
    snapshot.notStartedTopics =
      snapshot.totalTopics - snapshot.doneTopics - snapshot.inProgressTopics;
    return { success: true, data: snapshot };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

export async function getStudentCurriculumProgress(
  studentId: string,
): Promise<CurriculumActionResult<CurriculumSnapshot>> {
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
    const snapshot = await loadSnapshot(studentId);
    snapshot.notStartedTopics =
      snapshot.totalTopics - snapshot.doneTopics - snapshot.inProgressTopics;
    return { success: true, data: snapshot };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        err instanceof Error ? err.message : "Bilinmeyen veritabanı hatası.",
    };
  }
}

const topicStatusSchema = z.object({
  topicId: z.number().int().positive(),
  status: z.enum(["baslamadi", "calisiliyor", "bitti"]),
});

export type UpdateTopicStatusResult = CurriculumActionResult<{
  topicId: number;
  status: TopicStatus;
}>;

export async function updateTopicStatus(
  input: unknown,
): Promise<UpdateTopicStatusResult> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = topicStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const values = {
    studentId: ctx.studentId,
    topicId: parsed.data.topicId,
    status: parsed.data.status,
  };

  try {
    await db
      .insert(studentTopicProgress)
      .values(values)
      .onConflictDoUpdate({
        target: [studentTopicProgress.studentId, studentTopicProgress.topicId],
        set: {
          status: parsed.data.status,
          updatedAt: sql`now()`,
        } as {
          studentId?: string;
          topicId?: number;
          status: TopicStatus;
          updatedAt?: unknown;
        },
      });

    return {
      success: true,
      data: {
        topicId: parsed.data.topicId,
        status: parsed.data.status,
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