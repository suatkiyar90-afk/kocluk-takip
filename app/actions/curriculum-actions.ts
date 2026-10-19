"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  curriculumTopics,
  dailyQuestionEntries,
  studentTopicProgress,
  teacherStudents,
  weeklyTargets,
} from "@/db/schema";
import { ALL_SUBJECTS, examTypes, type ExamType } from "@/components/quiz-entry/weekly-quiz-schema";
import { actionErrorMessage } from "@/lib/action-error";
import { onlyActiveTopics } from "@/lib/topic-activity";
import {
  computeRecentAverage,
  sanitizeYearlyCounts,
  weightedMastery,
} from "@/lib/osym-frequency";

export type TopicStatus = "baslamadi" | "calisiliyor" | "bitti";

export interface CurriculumTopicRow {
  topicId: number;
  topicName: string;
  status: TopicStatus;
  avgRecentQuestions: number;
  yearlyQuestionCounts: Record<string, number> | null;
  totalSolved: number;
  accuracy: number | null;
}

export interface CurriculumSubjectGroup {
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  totalTopics: number;
  doneTopics: number;
  inProgressTopics: number;
  weightedDone: number;
  weightedTotal: number;
  weightedPercent: number | null;
  topics: CurriculumTopicRow[];
}

export interface CurriculumSnapshot {
  tyt: CurriculumSubjectGroup[];
  ayt: CurriculumSubjectGroup[];
  ydt: CurriculumSubjectGroup[];
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
  const [topicRows, progressRows, statRows] = await Promise.all([
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
    db
      .select({
        topicId: dailyQuestionEntries.topicId,
        totalSolved:
          sql<number>`coalesce(sum(${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}), 0)::int`,
        correctCount:
          sql<number>`coalesce(sum(${dailyQuestionEntries.correct}), 0)::int`,
      })
      .from(dailyQuestionEntries)
      .where(eq(dailyQuestionEntries.studentId, studentId))
      .groupBy(dailyQuestionEntries.topicId),
  ]);

  const statusById = new Map<number, TopicStatus>(
    progressRows.map((p) => [p.topicId, p.status]),
  );
  const statByTopic = new Map<
    number,
    { totalSolved: number; accuracy: number | null }
  >(
    statRows.map((row) => [
      row.topicId,
      {
        totalSolved: row.totalSolved,
        accuracy:
          row.totalSolved > 0
            ? Math.round((row.correctCount / row.totalSolved) * 100)
            : null,
      },
    ]),
  );

  const groups = new Map<string, CurriculumSubjectGroup>();
  for (const t of onlyActiveTopics(topicRows)) {
    const key = `${t.examType}:${t.subjectId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        examType: t.examType,
        subjectId: t.subjectId,
        subjectName: t.subjectName,
        totalTopics: 0,
        doneTopics: 0,
        inProgressTopics: 0,
        weightedDone: 0,
        weightedTotal: 0,
        weightedPercent: null,
        topics: [],
      };
      groups.set(key, group);
    }
    group.topics.push({
      topicId: t.id,
      topicName: t.topicName,
      status: statusById.get(t.id) ?? "baslamadi",
      avgRecentQuestions: t.avgRecentQuestions,
      yearlyQuestionCounts: t.yearlyQuestionCounts ?? null,
      totalSolved: statByTopic.get(t.id)?.totalSolved ?? 0,
      accuracy: statByTopic.get(t.id)?.accuracy ?? null,
    });
  }

  const rankMap = new Map<string, number>();
  examTypes.forEach((examType) => {
    ALL_SUBJECTS[examType].forEach((s, index) => {
      rankMap.set(`${examType}:${s.id}`, index);
    });
  });

  const examRank = new Map<string, number>();
  examTypes.forEach((examType, index) => {
    examRank.set(examType, index);
  });

  const sorted = [...groups.values()].sort((a, b) => {
    const ea = examRank.get(a.examType) ?? 99;
    const eb = examRank.get(b.examType) ?? 99;
    if (ea !== eb) return ea - eb;
    const aRank = rankMap.get(`${a.examType}:${a.subjectId}`) ?? 99;
    const bRank = rankMap.get(`${b.examType}:${b.subjectId}`) ?? 99;
    return aRank - bRank;
  });

  const tyt: CurriculumSubjectGroup[] = [];
  const ayt: CurriculumSubjectGroup[] = [];
  const ydt: CurriculumSubjectGroup[] = [];

  let doneTopics = 0;
  let inProgressTopics = 0;

  for (const group of sorted) {
    group.totalTopics = group.topics.length;
    group.doneTopics = group.topics.filter((t) => t.status === "bitti").length;
    group.inProgressTopics = group.topics.filter(
      (t) => t.status === "calisiliyor",
    ).length;

    const mastery = weightedMastery(
      group.topics.map((t) => ({
        status: t.status,
        avgRecentQuestions: t.avgRecentQuestions,
      })),
    );
    group.weightedDone = mastery.weightedDone;
    group.weightedTotal = mastery.weightedTotal;
    group.weightedPercent = mastery.percent;

    doneTopics += group.doneTopics;
    inProgressTopics += group.inProgressTopics;

    if (group.examType === "TYT") {
      tyt.push(group);
    } else if (group.examType === "AYT") {
      ayt.push(group);
    } else {
      ydt.push(group);
    }
  }

  return {
    tyt,
    ayt,
    ydt,
    totalTopics:
      tyt.reduce((s, g) => s + g.totalTopics, 0) +
      ayt.reduce((s, g) => s + g.totalTopics, 0) +
      ydt.reduce((s, g) => s + g.totalTopics, 0),
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
        actionErrorMessage(err),
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
        actionErrorMessage(err),
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
        actionErrorMessage(err),
    };
  }
}
const ADMIN_SESSION_MESSAGE = "Oturum açmanız gerekiyor.";
const ADMIN_ROLE_MESSAGE = "Bu işlem için yönetici yetkisi gerekli.";

async function getAdminId(): Promise<
  | { ok: true; adminId: string }
  | { ok: false; status: "UNAUTHORIZED"; message: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      status: "UNAUTHORIZED",
      message: ADMIN_SESSION_MESSAGE,
    };
  }
  if (session.user.role !== "admin") {
    return { ok: false, status: "UNAUTHORIZED", message: ADMIN_ROLE_MESSAGE };
  }
  return { ok: true, adminId: session.user.id };
}

const examTypeSchema = z.string().refine(
  (value): value is ExamType =>
    (examTypes as readonly string[]).includes(value),
  { message: "Geçerli bir sınav türü seçin." },
);

function subjectNameOf(
  examType: ExamType,
  subjectId: string,
): string | null {
  return ALL_SUBJECTS[examType].find((s) => s.id === subjectId)?.name ?? null;
}

async function subjectOptions(
  examType: ExamType,
): Promise<AdminCurriculumSubjectOption[]> {
  const storedRows = await db
    .selectDistinct({
      subjectId: curriculumTopics.subjectId,
      subjectName: curriculumTopics.subjectName,
    })
    .from(curriculumTopics)
    .where(eq(curriculumTopics.examType, examType))
    .orderBy(asc(curriculumTopics.subjectId));

  const staticIds = new Set(ALL_SUBJECTS[examType].map((s) => s.id));
  return [
    ...ALL_SUBJECTS[examType].map((s) => ({ id: s.id, name: s.name })),
    ...storedRows
      .filter((row) => !staticIds.has(row.subjectId))
      .map((row) => ({ id: row.subjectId, name: row.subjectName })),
  ];
}

async function resolveSubject(
  examType: ExamType,
  subjectId: string,
): Promise<string | null> {
  const staticName = subjectNameOf(examType, subjectId);
  if (staticName !== null) {
    return staticName;
  }
  const rows = await db
    .select({ subjectName: curriculumTopics.subjectName })
    .from(curriculumTopics)
    .where(
      and(
        eq(curriculumTopics.examType, examType),
        eq(curriculumTopics.subjectId, subjectId),
      ),
    )
    .limit(1);
  return rows[0]?.subjectName ?? null;
}

function executeRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result !== null && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }
  return [];
}

function numberOf(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface AdminCurriculumSubjectOption {
  id: string;
  name: string;
}

export interface AdminCurriculumTopicRow {
  id: number;
  topicName: string;
  sortOrder: number;
  isActive: boolean;
  avgRecentQuestions: number;
  yearlyQuestionCounts: Record<string, number> | null;
  entryCount: number;
  questionCount: number;
  progressCount: number;
  weeklyTargetCount: number;
}

export interface AdminCurriculumTopicList {
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  subjects: AdminCurriculumSubjectOption[];
  topics: AdminCurriculumTopicRow[];
}

const curriculumScopeSchema = z.object({
  examType: examTypeSchema,
  subjectId: z.string().min(1, "Ders seçilmedi."),
});

export async function adminListCurriculumTopics(
  input: unknown,
): Promise<CurriculumActionResult<AdminCurriculumTopicList>> {
  const ctx = await getAdminId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = curriculumScopeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  const { examType, subjectId } = parsed.data;
  const subjectName = await resolveSubject(examType, subjectId);
  if (subjectName === null) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Seçilen ders bu sınav türüne ait değil.",
    };
  }

  try {
    const subjects = await subjectOptions(examType);

    const topicRows = await db
      .select({
        id: curriculumTopics.id,
        topicName: curriculumTopics.topicName,
        sortOrder: curriculumTopics.sortOrder,
        isActive: curriculumTopics.isActive,
        avgRecentQuestions: curriculumTopics.avgRecentQuestions,
        yearlyQuestionCounts: curriculumTopics.yearlyQuestionCounts,
      })
      .from(curriculumTopics)
      .where(
        and(
          eq(curriculumTopics.examType, examType),
          eq(curriculumTopics.subjectId, subjectId),
        ),
      )
      .orderBy(asc(curriculumTopics.sortOrder), asc(curriculumTopics.id));

    const entryCounts = new Map<
      number,
      { entries: number; questions: number }
    >();
    const progressCounts = new Map<number, number>();
    const weeklyCounts = new Map<number, number>();

    if (topicRows.length > 0) {
      const entryRows = await db
        .select({
          topicId: dailyQuestionEntries.topicId,
          entries: sql<number>`count(*)::int`,
          questions: sql<number>`coalesce(sum(${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}), 0)::int`,
        })
        .from(dailyQuestionEntries)
        .innerJoin(
          curriculumTopics,
          eq(curriculumTopics.id, dailyQuestionEntries.topicId),
        )
        .where(
          and(
            eq(curriculumTopics.examType, examType),
            eq(curriculumTopics.subjectId, subjectId),
          ),
        )
        .groupBy(dailyQuestionEntries.topicId);
      for (const row of entryRows) {
        entryCounts.set(row.topicId, {
          entries: numberOf(row.entries),
          questions: numberOf(row.questions),
        });
      }

      const progressRows = await db
        .select({
          topicId: studentTopicProgress.topicId,
          total: sql<number>`count(*)::int`,
        })
        .from(studentTopicProgress)
        .innerJoin(
          curriculumTopics,
          eq(curriculumTopics.id, studentTopicProgress.topicId),
        )
        .where(
          and(
            eq(curriculumTopics.examType, examType),
            eq(curriculumTopics.subjectId, subjectId),
          ),
        )
        .groupBy(studentTopicProgress.topicId);
      for (const row of progressRows) {
        progressCounts.set(row.topicId, numberOf(row.total));
      }

      const weeklyResult = await db.execute(sql`
        select t.id as topic_id, count(w.id)::int as total
        from curriculum_topics t
        left join weekly_targets w
          on w.target_topics @> array[t.id] and w.subject_id = t.subject_id
        where t.exam_type = ${examType}::exam_type
          and t.subject_id = ${subjectId}
        group by t.id
      `);
      for (const row of executeRows(weeklyResult)) {
        weeklyCounts.set(numberOf(row.topic_id), numberOf(row.total));
      }
    }

    return {
      success: true,
      data: {
        examType,
        subjectId,
        subjectName,
        subjects,
        topics: topicRows.map((topic) => ({
          ...topic,
          entryCount: entryCounts.get(topic.id)?.entries ?? 0,
          questionCount: entryCounts.get(topic.id)?.questions ?? 0,
          progressCount: progressCounts.get(topic.id) ?? 0,
          weeklyTargetCount: weeklyCounts.get(topic.id) ?? 0,
        })),
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

const topicNameSchema = z
  .string()
  .trim()
  .min(2, "Konu adı en az 2 karakter olmalı.")
  .max(120, "Konu adı en fazla 120 karakter olabilir.");

const sortOrderSchema = z.coerce
  .number()
  .int("Sıra numarası tam sayı olmalı.")
  .min(0, "Sıra numarası negatif olamaz.")
  .max(100000, "Sıra numarası çok büyük.");

const addTopicSchema = z.object({
  examType: examTypeSchema,
  subjectId: z.string().min(1, "Ders seçilmedi."),
  topicName: topicNameSchema,
  sortOrder: sortOrderSchema,
});

export interface AdminTopicData {
  topicId: number;
  topicName: string;
  sortOrder: number;
  subjectId: string;
  subjectName: string;
}

export async function adminAddTopic(
  input: unknown,
): Promise<CurriculumActionResult<AdminTopicData>> {
  const ctx = await getAdminId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = addTopicSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  const { examType, subjectId, topicName, sortOrder } = parsed.data;
  const subjectName = await resolveSubject(examType, subjectId);
  if (subjectName === null) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Seçilen ders bu sınav türüne ait değil.",
    };
  }

  try {
    const existing = await db
      .select({ id: curriculumTopics.id })
      .from(curriculumTopics)
      .where(
        and(
          eq(curriculumTopics.examType, examType),
          eq(curriculumTopics.subjectId, subjectId),
          eq(curriculumTopics.topicName, topicName),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: `"${topicName}" konusu bu derste zaten var.`,
      };
    }

    const insertValues = {
      examType,
      subjectId,
      subjectName,
      topicName,
      sortOrder,
      isActive: true,
    };

    const inserted = await db
      .insert(curriculumTopics)
      .values(insertValues)
      .returning({ id: curriculumTopics.id });

    const topicId = inserted[0]?.id;
    if (typeof topicId !== "number") {
      return {
        success: false,
        status: "DATABASE_ERROR",
        message: "Konu kaydedilemedi.",
      };
    }

    revalidatePath("/admin/curriculum");
    revalidatePath("/mufredat");

    return { success: true, data: { topicId, topicName, sortOrder, subjectId, subjectName } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

const yearlyCountsSchema = z
  .record(
    z.string(),
    z.coerce
      .number()
      .int("Soru sayısı tam sayı olmalı.")
      .min(0, "Soru sayısı negatif olamaz.")
      .max(500, "Soru sayısı çok büyük."),
  )
  .optional();

const updateTopicSchema = z.object({
  topicId: z.coerce.number().int().positive("Geçerli bir konu seçin."),
  topicName: topicNameSchema,
  sortOrder: sortOrderSchema,
  subjectId: z.string().min(1, "Ders seçilmedi.").optional(),
  yearlyQuestionCounts: yearlyCountsSchema,
});

export async function adminUpdateTopic(
  input: unknown,
): Promise<CurriculumActionResult<AdminTopicData>> {
  const ctx = await getAdminId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = updateTopicSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  const {
    topicId,
    topicName,
    sortOrder,
    subjectId: requestedSubjectId,
    yearlyQuestionCounts,
  } = parsed.data;

  try {
    const topicRows = await db
      .select({
        id: curriculumTopics.id,
        examType: curriculumTopics.examType,
        subjectId: curriculumTopics.subjectId,
        subjectName: curriculumTopics.subjectName,
      })
      .from(curriculumTopics)
      .where(eq(curriculumTopics.id, topicId))
      .limit(1);
    const topic = topicRows[0];
    if (!topic) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Konu bulunamadı.",
      };
    }

    const nextSubjectId = requestedSubjectId ?? topic.subjectId;
    let nextSubjectName = topic.subjectName;
    if (nextSubjectId !== topic.subjectId) {
      const resolved = await resolveSubject(topic.examType, nextSubjectId);
      if (resolved === null) {
        return {
          success: false,
          status: "VALIDATION_FAILED",
          message: "Seçilen ders bu sınav türüne ait değil.",
        };
      }
      nextSubjectName = resolved;
    }

    const sameName = await db
      .select({ id: curriculumTopics.id })
      .from(curriculumTopics)
      .where(
        and(
          eq(curriculumTopics.examType, topic.examType),
          eq(curriculumTopics.subjectId, nextSubjectId),
          eq(curriculumTopics.topicName, topicName),
        ),
      );
    if (sameName.some((row) => row.id !== topicId)) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: `"${topicName}" konusu bu derste zaten var.`,
      };
    }

    const osymValues =
      yearlyQuestionCounts === undefined
        ? {}
        : (() => {
            const sanitized = sanitizeYearlyCounts(yearlyQuestionCounts);
            return {
              yearlyQuestionCounts: sanitized,
              avgRecentQuestions: computeRecentAverage(sanitized),
            };
          })();

    const updateValues = {
      topicName,
      sortOrder,
      subjectId: nextSubjectId,
      subjectName: nextSubjectName,
      ...osymValues,
    };

    await db.transaction(async (tx) => {
      await tx
        .update(curriculumTopics)
        .set(updateValues)
        .where(eq(curriculumTopics.id, topicId));

      if (nextSubjectId !== topic.subjectId) {
        await tx.execute(sql`
          update daily_question_entries
             set subject_id = ${nextSubjectId}
           where topic_id = ${topicId}
             and subject_id <> ${nextSubjectId}
        `);
      }
    });

    revalidatePath("/admin/curriculum");
    revalidatePath("/mufredat");

    return {
      success: true,
      data: {
        topicId,
        topicName,
        sortOrder,
        subjectId: nextSubjectId,
        subjectName: nextSubjectName,
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

const mergeTopicSchema = z.object({
  sourceTopicId: z.coerce.number().int().positive("Geçerli bir konu seçin."),
  targetTopicId: z.coerce
    .number()
    .int()
    .positive("Geçerli bir hedef konu seçin.")
    .nullish(),
});

export interface TopicUsageCounts {
  entries: number;
  progress: number;
  weekly: number;
}

export interface MergeTopicSummary extends TopicUsageCounts {
  sourceTopicId: number;
  sourceTopicName: string;
  targetTopicId: number | null;
  targetTopicName: string | null;
  mergedDailyEntries: number;
  movedDailyEntries: number;
  mergedProgressRecords: number;
  movedProgressRecords: number;
  updatedWeeklyTargets: number;
}

async function countTopicUsage(topicId: number): Promise<TopicUsageCounts> {
  const [entryRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(dailyQuestionEntries)
    .where(eq(dailyQuestionEntries.topicId, topicId));
  const [progressRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(studentTopicProgress)
    .where(eq(studentTopicProgress.topicId, topicId));
  const [weeklyRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(weeklyTargets)
    .where(sql`${weeklyTargets.targetTopics} @> array[${topicId}::int]`);
  return {
    entries: numberOf(entryRow?.total),
    progress: numberOf(progressRow?.total),
    weekly: numberOf(weeklyRow?.total),
  };
}

export async function adminMergeAndDeleteTopic(
  input: unknown,
): Promise<CurriculumActionResult<MergeTopicSummary>> {
  const ctx = await getAdminId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = mergeTopicSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  const sourceTopicId = parsed.data.sourceTopicId;
  const targetTopicId = parsed.data.targetTopicId ?? null;

  if (targetTopicId !== null && targetTopicId === sourceTopicId) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Hedef konu, silinecek konu ile aynı olamaz.",
    };
  }

  try {
    const sourceRows = await db
      .select({
        id: curriculumTopics.id,
        topicName: curriculumTopics.topicName,
        examType: curriculumTopics.examType,
        subjectId: curriculumTopics.subjectId,
      })
      .from(curriculumTopics)
      .where(eq(curriculumTopics.id, sourceTopicId))
      .limit(1);
    const source = sourceRows[0];
    if (!source) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Silinecek konu bulunamadı.",
      };
    }

    let targetTopicName: string | null = null;
    if (targetTopicId !== null) {
      const targetRows = await db
        .select({
          id: curriculumTopics.id,
          topicName: curriculumTopics.topicName,
          examType: curriculumTopics.examType,
          subjectId: curriculumTopics.subjectId,
        })
        .from(curriculumTopics)
        .where(eq(curriculumTopics.id, targetTopicId))
        .limit(1);
      const target = targetRows[0];
      if (!target) {
        return {
          success: false,
          status: "VALIDATION_FAILED",
          message: "Hedef konu bulunamadı.",
        };
      }
      if (
        target.examType !== source.examType ||
        target.subjectId !== source.subjectId
      ) {
        return {
          success: false,
          status: "VALIDATION_FAILED",
          message: "Hedef konu aynı sınav türünde ve aynı ders içinde olmalıdır.",
        };
      }
      targetTopicName = target.topicName;
    }

    const usage = await countTopicUsage(sourceTopicId);
    const usageTotal = usage.entries + usage.progress + usage.weekly;
    if (usageTotal > 0 && targetTopicId === null) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message:
          `"${source.topicName}" konusuna bağlı ${usage.entries} soru kaydı, ` +
          `${usage.progress} konu ilerleme kaydı ve ${usage.weekly} haftalık hedef bulundu. ` +
          "Bu kayıtların aktarılacağı hedef konuyu seçin.",
      };
    }

    const summary: MergeTopicSummary = {
      sourceTopicId,
      sourceTopicName: source.topicName,
      targetTopicId,
      targetTopicName,
      entries: usage.entries,
      progress: usage.progress,
      weekly: usage.weekly,
      mergedDailyEntries: 0,
      movedDailyEntries: 0,
      mergedProgressRecords: 0,
      movedProgressRecords: 0,
      updatedWeeklyTargets: 0,
    };

    if (targetTopicId !== null) {
      await db.transaction(async (tx) => {
        const mergedDaily = executeRows(
          await tx.execute(sql`
            with updated as (
              update daily_question_entries as source
              set correct = source.correct + target.correct,
                  wrong = source.wrong + target.wrong,
                  blank = source.blank + target.blank
              from daily_question_entries as target
              where source.topic_id = ${sourceTopicId}::int
                and target.topic_id = ${targetTopicId}::int
                and target.student_id = source.student_id
                and target.date = source.date
                and target.exam_type = source.exam_type
                and target.subject_id = source.subject_id
              returning source.id
            )
            select count(*)::int as total from updated
          `),
        );
        summary.mergedDailyEntries = numberOf(mergedDaily[0]?.total);

        await tx.execute(sql`
          delete from daily_question_entries as source
          using daily_question_entries as target
          where source.topic_id = ${sourceTopicId}::int
            and target.topic_id = ${targetTopicId}::int
            and target.student_id = source.student_id
            and target.date = source.date
            and target.exam_type = source.exam_type
            and target.subject_id = source.subject_id
        `);

        const movedDaily = executeRows(
          await tx.execute(sql`
            with moved as (
              update daily_question_entries
              set topic_id = ${targetTopicId}::int
              where topic_id = ${sourceTopicId}::int
              returning id
            )
            select count(*)::int as total from moved
          `),
        );
        summary.movedDailyEntries = numberOf(movedDaily[0]?.total);

        const mergedProgress = executeRows(
          await tx.execute(sql`
            with deleted as (
              delete from student_topic_progress as source
              using student_topic_progress as target
              where source.topic_id = ${sourceTopicId}::int
                and target.topic_id = ${targetTopicId}::int
                and target.student_id = source.student_id
              returning source.id
            )
            select count(*)::int as total from deleted
          `),
        );
        summary.mergedProgressRecords = numberOf(mergedProgress[0]?.total);

        const movedProgress = executeRows(
          await tx.execute(sql`
            with moved as (
              update student_topic_progress
              set topic_id = ${targetTopicId}::int
              where topic_id = ${sourceTopicId}::int
              returning id
            )
            select count(*)::int as total from moved
          `),
        );
        summary.movedProgressRecords = numberOf(movedProgress[0]?.total);

        const updatedWeekly = executeRows(
          await tx.execute(sql`
            with updated as (
              update weekly_targets
              set target_topics = (
                select coalesce(array_agg(distinct item order by item), '{}'::int[])
                from unnest(
                  array_replace(
                    target_topics,
                    ${sourceTopicId}::int,
                    ${targetTopicId}::int
                  )
                ) as item
              )
              where target_topics @> array[${sourceTopicId}::int]
              returning id
            )
            select count(*)::int as total from updated
          `),
        );
        summary.updatedWeeklyTargets = numberOf(updatedWeekly[0]?.total);

        await tx
          .delete(curriculumTopics)
          .where(eq(curriculumTopics.id, sourceTopicId));
      });
    } else {
      await db
        .delete(curriculumTopics)
        .where(eq(curriculumTopics.id, sourceTopicId));
    }

    revalidatePath("/admin/curriculum");
    revalidatePath("/mufredat");

    return { success: true, data: summary };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

const createSubjectSchema = z.object({
  examType: examTypeSchema,
  subjectName: z
    .string()
    .trim()
    .min(2, "Ders adı en az 2 karakter olmalı.")
    .max(60, "Ders adı en fazla 60 karakter olabilir."),
  topicName: topicNameSchema,
  sortOrder: sortOrderSchema,
});

export interface AdminSubjectData {
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  topicId: number;
  topicName: string;
  sortOrder: number;
}

const SUBJECT_SLUG_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

function slugifySubjectName(name: string): string {
  const normalized = name
    .split("")
    .map((ch) => SUBJECT_SLUG_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return normalized.length > 0 ? normalized : "ders";
}

export async function adminCreateSubjectWithFirstTopic(
  input: unknown,
): Promise<CurriculumActionResult<AdminSubjectData>> {
  const ctx = await getAdminId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = createSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  const { examType, subjectName, topicName, sortOrder } = parsed.data;

  try {
    const storedRows = await db
      .selectDistinct({ subjectId: curriculumTopics.subjectId })
      .from(curriculumTopics)
      .where(eq(curriculumTopics.examType, examType));
    const takenIds = new Set([
      ...ALL_SUBJECTS[examType].map((s) => s.id),
      ...storedRows.map((row) => row.subjectId),
    ]);

    const baseId = `${examType.toLowerCase()}-${slugifySubjectName(subjectName)}`;
    let subjectId = baseId;
    let suffix = 2;
    while (takenIds.has(subjectId)) {
      subjectId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const insertValues = {
      examType,
      subjectId,
      subjectName,
      topicName,
      sortOrder,
    };

    const inserted = await db
      .insert(curriculumTopics)
      .values(insertValues)
      .returning({ id: curriculumTopics.id });
    const topicId = inserted[0]?.id;
    if (topicId === undefined) {
      return {
        success: false,
        status: "DATABASE_ERROR",
        message: "Ders oluşturulamadı.",
      };
    }

    revalidatePath("/admin/curriculum");
    revalidatePath("/mufredat");

    return {
      success: true,
      data: {
        examType,
        subjectId,
        subjectName,
        topicId,
        topicName,
        sortOrder,
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}
