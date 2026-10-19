"use server";

import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { logActivity } from "@/lib/activity-log";
import {
  coachingFeedbacks,
  curriculumTopics,
  dailyQuestionEntries,
  studentDenemeAttempts,
  studentTopicProgress,
  teacherStudents,
  users,
  weeklyDenemeTargets,
  weeklyTargets,
} from "@/db/schema";
import {
  addDaysISO,
  parseMonday,
  todayInIstanbul,
} from "@/lib/week-utils";
import {
  MAX_DENEME_TARGET_ROWS,
  computeDenemeProgress,
  denemeTargetRowSchema,
  getDenemeLabel,
  mergeDenemeTargetRows,
} from "@/lib/deneme";
import {
  ALLOWED_SUBJECTS_BY_FIELD,
  STUDY_FIELD_LABELS,
  netScore,
  studyFields,
  type ExamType,
  type StudyField,
} from "@/components/quiz-entry/weekly-quiz-schema";
import { sendPushNotification } from "@/lib/web-push-helper";
import { isAllowedUploadUrl } from "@/lib/url-guard";
import { actionErrorMessage } from "@/lib/action-error";

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
  examType: ExamType;
  targetQuestionCount: number;
  solvedCount: number;
  scheduleFileUrl: string | null;
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
    { name: string; examType: ExamType }
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
      scheduleFileUrl: t.scheduleFileUrl,
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
      "Danışman öğretmenin bu hafta için sana yeni hedefler ve değerlendirmeler yazdı.",
      "/weekly-targets",
    );

    await logActivity({
      actorId: ctx.teacherId,
      action: "target_saved",
      studentId,
    });

    return { success: true, data: { id: saved[0].id } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
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
        actionErrorMessage(err),
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
        actionErrorMessage(err),
    };
  }
}

export type TopicStatus = "baslamadi" | "calisiliyor" | "bitti";

export type SmartTargetScenario =
  | "unfinished"
  | "next_guarantee"
  | "low_accuracy"
  | "spaced_repetition";

export interface SmartTargetRecommendation {
  topicId: number;
  topicName: string;
  subjectId: string;
  subjectName: string;
  examType: ExamType;
  scenario: SmartTargetScenario;
  suggestedQuestions: number;
  priorityScore: number;
  reason: string;
}

export interface SmartTargetTopicStat {
  topicId: number;
  status: TopicStatus;
  totalSolved: number;
  correct: number;
  wrong: number;
  accuracy: number | null;
  lastSolvedDate: string | null;
}

export interface SmartTargetRecommendationBundle {
  studyField: StudyField;
  studyFieldSelected: boolean;
  weekStart: string;
  allowedSubjectIds: string[];
  recommendations: SmartTargetRecommendation[];
  topicStats: SmartTargetTopicStat[];
}

const studyFieldSchema = z.object({
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
  studyField: z.enum(studyFields),
});

export async function teacherUpdateStudentField(
  input: unknown,
): Promise<
  WeeklyTargetActionResult<{ studyField: StudyField; label: string }>
> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = studyFieldSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { studentId, studyField } = parsed.data;

  try {
    if (!(await isAssigned(ctx.teacherId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    await db
      .update(users)
      .set({ studyField })
      .where(eq(users.id, studentId));

    return {
      success: true,
      data: { studyField, label: STUDY_FIELD_LABELS[studyField] },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.floor(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

interface ScenarioCandidate {
  scenario: SmartTargetScenario;
  score: number;
  suggested: number;
  reason: string;
}

export async function getSmartTargetRecommendations(
  studentId: string,
  weekStartArg?: string,
): Promise<WeeklyTargetActionResult<SmartTargetRecommendationBundle>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsedId = z
    .string()
    .uuid("Geçerli bir öğrenci seçin.")
    .safeParse(studentId);
  if (!parsedId.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message:
        parsedId.error.issues[0]?.message ?? "Geçerli bir öğrenci seçin.",
    };
  }
  const student = parsedId.data;
  const weekStart = parseMonday(weekStartArg);

  try {
    if (!(await isAssigned(ctx.teacherId, student))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const [profileRows, progressRows, solvedRows, targetRows] =
      await Promise.all([
        db
          .select({ studyField: users.studyField })
          .from(users)
          .where(eq(users.id, student))
          .limit(1),
        db
          .select({
            topicId: studentTopicProgress.topicId,
            status: studentTopicProgress.status,
          })
          .from(studentTopicProgress)
          .where(eq(studentTopicProgress.studentId, student)),
        db
          .select({
            topicId: dailyQuestionEntries.topicId,
            correct: sql<number>`coalesce(sum(${dailyQuestionEntries.correct}), 0)::int`,
            wrong: sql<number>`coalesce(sum(${dailyQuestionEntries.wrong}), 0)::int`,
            blank: sql<number>`coalesce(sum(${dailyQuestionEntries.blank}), 0)::int`,
            lastSolvedDate: sql<string | null>`max(${dailyQuestionEntries.date})`,
          })
          .from(dailyQuestionEntries)
          .where(eq(dailyQuestionEntries.studentId, student))
          .groupBy(dailyQuestionEntries.topicId),
        db
          .select({ targetTopics: weeklyTargets.targetTopics })
          .from(weeklyTargets)
          .where(
            and(
              eq(weeklyTargets.studentId, student),
              eq(weeklyTargets.weekStartDate, weekStart),
            ),
          ),
      ]);

    if (profileRows.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Öğrenci bulunamadı.",
      };
    }

    const rawField = profileRows[0].studyField;
    const studyField: StudyField = rawField ?? "SAY";
    const allowedSubjectIds = ALLOWED_SUBJECTS_BY_FIELD[studyField];

    const topicRows = await db
      .select({
        id: curriculumTopics.id,
        examType: curriculumTopics.examType,
        subjectId: curriculumTopics.subjectId,
        subjectName: curriculumTopics.subjectName,
        topicName: curriculumTopics.topicName,
        sortOrder: curriculumTopics.sortOrder,
        avgRecentQuestions: curriculumTopics.avgRecentQuestions,
      })
      .from(curriculumTopics)
      .where(
        and(
          inArray(curriculumTopics.subjectId, allowedSubjectIds),
          eq(curriculumTopics.isActive, true),
        ),
      )
      .orderBy(
        asc(curriculumTopics.subjectId),
        asc(curriculumTopics.sortOrder),
        asc(curriculumTopics.id),
      );

    const statusByTopic = new Map<number, TopicStatus>();
    for (const row of progressRows) {
      statusByTopic.set(row.topicId, row.status);
    }

    const solvedByTopic = new Map<
      number,
      { correct: number; wrong: number; blank: number; lastSolvedDate: string | null }
    >();
    for (const row of solvedRows) {
      solvedByTopic.set(row.topicId, row);
    }

    const assignedTopicIds = new Set<number>();
    for (const row of targetRows) {
      for (const topicId of row.targetTopics) {
        assignedTopicIds.add(topicId);
      }
    }

    const nextUnstartedIds = new Set<number>();
    const unstartedBySubject = new Map<string, number>();
    for (const topic of topicRows) {
      const status = statusByTopic.get(topic.id) ?? "baslamadi";
      if (status !== "baslamadi") {
        continue;
      }
      const count = unstartedBySubject.get(topic.subjectId) ?? 0;
      if (count >= 3) {
        continue;
      }
      nextUnstartedIds.add(topic.id);
      unstartedBySubject.set(topic.subjectId, count + 1);
    }

    const today = todayInIstanbul();
    const recommendations: SmartTargetRecommendation[] = [];
    const topicStats: SmartTargetTopicStat[] = [];

    for (const topic of topicRows) {
      const status = statusByTopic.get(topic.id) ?? "baslamadi";
      const solved = solvedByTopic.get(topic.id);
      const correct = solved?.correct ?? 0;
      const wrong = solved?.wrong ?? 0;
      const blank = solved?.blank ?? 0;
      const totalSolved = correct + wrong + blank;
      const answered = correct + wrong;
      const accuracy = answered > 0 ? correct / answered : null;
      const lastSolvedDate = solved?.lastSolvedDate ?? null;

      topicStats.push({
        topicId: topic.id,
        status,
        totalSolved,
        correct,
        wrong,
        accuracy,
        lastSolvedDate,
      });

      if (assignedTopicIds.has(topic.id)) {
        continue;
      }

      const candidates: ScenarioCandidate[] = [];

      if (status === "calisiliyor" && totalSolved < 100) {
        candidates.push({
          scenario: "unfinished",
          score: 40 + topic.avgRecentQuestions * 25,
          suggested: Math.max(
            50,
            Math.ceil((100 - totalSolved) / 10) * 10,
          ),
          reason: `Çalışılıyor işaretli • Şimdiye kadar ${totalSolved} soru çözüldü`,
        });
      }

      if (totalSolved >= 30 && accuracy !== null && accuracy < 0.65) {
        candidates.push({
          scenario: "low_accuracy",
          score:
            35 +
            topic.avgRecentQuestions * 25 +
            (0.65 - accuracy) * 30,
          suggested: 80,
          reason: `%${Math.round(accuracy * 100)} doğru oranı (${totalSolved} soru) • Telafi gerekli`,
        });
      }

      if (
        status === "baslamadi" &&
        nextUnstartedIds.has(topic.id) &&
        topic.avgRecentQuestions >= 0.8
      ) {
        candidates.push({
          scenario: "next_guarantee",
          score: 30 + topic.avgRecentQuestions * 25,
          suggested: topic.avgRecentQuestions >= 2 ? 120 : 80,
          reason: `Sıradaki konu • ÖSYM son 5 yıl ort. ${topic.avgRecentQuestions.toFixed(1)} soru`,
        });
      }

      if (status === "bitti" && topic.avgRecentQuestions >= 0.8) {
        const days =
          lastSolvedDate === null
            ? null
            : daysBetweenISO(lastSolvedDate, today);
        if (days === null || days > 21) {
          candidates.push({
            scenario: "spaced_repetition",
            score: 25 + topic.avgRecentQuestions * 20,
            suggested: 50,
            reason:
              days === null
                ? "Konu bitti • Hiç test kaydı yok"
                : `Konu bitti • ${days} gündür soru çözülmedi`,
          });
        }
      }

      if (candidates.length === 0) {
        continue;
      }
      const best = candidates.reduce((a, b) =>
        b.score > a.score ? b : a,
      );

      recommendations.push({
        topicId: topic.id,
        topicName: topic.topicName,
        subjectId: topic.subjectId,
        subjectName: topic.subjectName,
        examType: topic.examType,
        scenario: best.scenario,
        suggestedQuestions: best.suggested,
        priorityScore: Math.round(best.score * 100) / 100,
        reason: best.reason,
      });
    }

    recommendations.sort((a, b) => b.priorityScore - a.priorityScore);

    const perSubject = new Map<string, number>();
    const limited: SmartTargetRecommendation[] = [];
    for (const rec of recommendations) {
      const count = perSubject.get(rec.subjectId) ?? 0;
      if (count >= 2) {
        continue;
      }
      perSubject.set(rec.subjectId, count + 1);
      limited.push(rec);
      if (limited.length >= 8) {
        break;
      }
    }

    return {
      success: true,
      data: {
        studyField,
        studyFieldSelected: rawField !== null,
        weekStart,
        allowedSubjectIds,
        recommendations: limited,
        topicStats,
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
        actionErrorMessage(err),
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
        actionErrorMessage(err),
    };
  }
}

const scheduleUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    isAllowedUploadUrl,
    "Yalnızca UploadThing dosya adresleri kabul edilir (utfs.io / *.ufs.sh).",
  );

export async function saveWeeklyScheduleFile(
  studentId: string,
  weekStartArg: string,
  fileUrl: string,
): Promise<WeeklyTargetActionResult<{ updated: number }>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const url = scheduleUrlSchema.safeParse(fileUrl);
  if (!url.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: url.error.issues.map((i) => i.message).join(", "),
    };
  }

  const weekStart = parseMonday(weekStartArg);

  try {
    if (!(await isAssigned(ctx.teacherId, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const result = await db.execute(
      sql`UPDATE weekly_targets SET schedule_file_url = ${url.data}, is_schedule_approved = false WHERE student_id = ${studentId} AND week_start_date = ${weekStart}`,
    );

    const updated = result.rowCount ?? 0;
    if (updated === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message:
          "Bu hafta için henüz hedef girilmemiş. Önce haftalık hedef belirleyin.",
      };
    }

    return { success: true, data: { updated } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}

export async function getMyWeeklySchedule(
  weekStartArg?: string,
): Promise<
  WeeklyTargetActionResult<{ fileUrl: string | null; isApproved: boolean }>
> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const weekStart = parseMonday(weekStartArg);

  try {
    const rows = await db
      .select({
        fileUrl: weeklyTargets.scheduleFileUrl,
        isApproved: weeklyTargets.isScheduleApproved,
      })
      .from(weeklyTargets)
      .where(
        and(
          eq(weeklyTargets.studentId, ctx.studentId),
          eq(weeklyTargets.weekStartDate, weekStart),
          isNotNull(weeklyTargets.scheduleFileUrl),
        ),
      )
      .limit(1);

    return {
      success: true,
      data: {
        fileUrl: rows[0]?.fileUrl ?? null,
        isApproved: rows[0]?.isApproved ?? false,
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

export interface DenemeTargetProgress {
  denemeKey: string;
  label: string;
  targetCount: number;
  solvedCount: number;
  reached: boolean;
}

export interface DenemeAttemptView {
  id: number;
  date: string;
  denemeKey: string;
  label: string;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
}

export interface WeeklyDenemeBundle {
  targets: DenemeTargetProgress[];
  attempts: DenemeAttemptView[];
}

async function loadWeeklyDenemeBundle(
  studentId: string,
  weekStart: string,
): Promise<WeeklyDenemeBundle> {
  const weekEnd = addDaysISO(weekStart, 6);
  const [targetRows, attemptRows] = await Promise.all([
    db
      .select({
        denemeKey: weeklyDenemeTargets.denemeKey,
        targetCount: weeklyDenemeTargets.targetCount,
      })
      .from(weeklyDenemeTargets)
      .where(
        and(
          eq(weeklyDenemeTargets.studentId, studentId),
          eq(weeklyDenemeTargets.weekStartDate, weekStart),
        ),
      ),
    db
      .select({
        id: studentDenemeAttempts.id,
        date: studentDenemeAttempts.date,
        denemeKey: studentDenemeAttempts.denemeKey,
        correct: studentDenemeAttempts.correct,
        wrong: studentDenemeAttempts.wrong,
        blank: studentDenemeAttempts.blank,
      })
      .from(studentDenemeAttempts)
      .where(
        and(
          eq(studentDenemeAttempts.studentId, studentId),
          gte(studentDenemeAttempts.date, weekStart),
          lte(studentDenemeAttempts.date, weekEnd),
        ),
      )
      .orderBy(asc(studentDenemeAttempts.date), asc(studentDenemeAttempts.id)),
  ]);

  const progress = computeDenemeProgress(
    weekStart,
    targetRows.map((row) => ({
      denemeKey: row.denemeKey,
      targetCount: row.targetCount,
    })),
    attemptRows.map((row) => ({
      date: row.date,
      denemeKey: row.denemeKey,
    })),
  );

  const targets: DenemeTargetProgress[] = progress.map((row) => ({
    denemeKey: row.denemeKey,
    label: getDenemeLabel(row.denemeKey) ?? row.denemeKey,
    targetCount: row.targetCount,
    solvedCount: row.solvedCount,
    reached: row.reached,
  }));

  const attempts: DenemeAttemptView[] = attemptRows.map((row) => ({
    id: row.id,
    date: row.date,
    denemeKey: row.denemeKey,
    label: getDenemeLabel(row.denemeKey) ?? row.denemeKey,
    correct: row.correct,
    wrong: row.wrong,
    blank: row.blank,
    net: Math.round(netScore(row.correct, row.wrong) * 100) / 100,
  }));

  return { targets, attempts };
}

const saveWeeklyDenemeTargetsSchema = z.object({
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Hafta başlangıcı geçersiz."),
  items: z
    .array(denemeTargetRowSchema)
    .max(
      MAX_DENEME_TARGET_ROWS,
      `En fazla ${MAX_DENEME_TARGET_ROWS} deneme hedefi girilebilir.`,
    ),
});

export async function saveWeeklyDenemeTargets(
  input: unknown,
): Promise<WeeklyTargetActionResult<{ saved: number }>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = saveWeeklyDenemeTargetsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const weekStart = parseMonday(parsed.data.weekStart);
  const merged = mergeDenemeTargetRows(parsed.data.items);
  if (merged.error !== null) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: merged.error,
    };
  }

  try {
    if (!(await isAssigned(ctx.teacherId, parsed.data.studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(weeklyDenemeTargets)
        .where(
          and(
            eq(weeklyDenemeTargets.studentId, parsed.data.studentId),
            eq(weeklyDenemeTargets.weekStartDate, weekStart),
          ),
        );
      if (merged.rows.length > 0) {
        await tx.insert(weeklyDenemeTargets).values(
          merged.rows.map((row) => ({
            studentId: parsed.data.studentId,
            teacherId: ctx.teacherId,
            weekStartDate: weekStart,
            denemeKey: row.denemeKey,
            targetCount: row.targetCount,
          })),
        );
      }
    });

    await sendPushNotification(
      parsed.data.studentId,
      "Yeni Haftalık Dönüt",
      "Danışman öğretmenin bu hafta için sana yeni hedefler ve değerlendirmeler yazdı.",
      "/weekly-targets",
    );

    await logActivity({
      actorId: ctx.teacherId,
      action: "target_saved",
      studentId: parsed.data.studentId,
    });

    return { success: true, data: { saved: merged.rows.length } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export type WeeklyDenemeBundleResult =
  | { success: true; data: WeeklyDenemeBundle }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export async function getWeeklyDenemeBundle(
  studentId: string,
  weekStartArg?: string,
): Promise<WeeklyDenemeBundleResult> {
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

    const bundle = await loadWeeklyDenemeBundle(
      studentId,
      parseMonday(weekStartArg),
    );
    return { success: true, data: bundle };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export async function getMyWeeklyDenemeBundle(
  weekStartArg?: string,
): Promise<WeeklyDenemeBundleResult> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    const bundle = await loadWeeklyDenemeBundle(
      ctx.studentId,
      parseMonday(weekStartArg),
    );
    return { success: true, data: bundle };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export async function approveWeeklySchedule(
  weekStartArg?: string,
): Promise<WeeklyTargetActionResult<{ approved: boolean }>> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const weekStart = parseMonday(weekStartArg);

  try {
    const result = await db.execute(
      sql`UPDATE weekly_targets SET is_schedule_approved = true WHERE student_id = ${ctx.studentId} AND week_start_date = ${weekStart} AND schedule_file_url IS NOT NULL`,
    );

    const updated = result.rowCount ?? 0;
    if (updated === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Onaylanacak bir çizelge bulunamadı.",
      };
    }

    return { success: true, data: { approved: true } };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}
