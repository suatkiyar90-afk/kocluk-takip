"use server";

import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { logActivity } from "@/lib/activity-log";
import {
  curriculumTopics,
  dailyQuestionEntries,
  mockExams,
  studentTopicProgress,
  users,
  weeklyStudyPlans,
  weeklyTargets,
  type StudyPlanSlot,
  type StudyPlanTaskType,
} from "@/db/schema";
import { addDaysISO, parseMonday, todayInIstanbul } from "@/lib/week-utils";
import {
  ALLOWED_SUBJECTS_BY_FIELD,
  type ExamType,
  type StudyField,
} from "@/components/quiz-entry/weekly-quiz-schema";
import { OSYM_GUARANTEED_AVG, OSYM_REGULAR_AVG } from "@/lib/osym-frequency";
import { buildAnalysisTopicNote } from "@/lib/exam-analysis";
import {
  loadLatestAnalysisPlan,
  type AnalysisPlanItem,
} from "@/lib/exam-analysis-plan";
import {
  fieldPriorityLabel,
  resolveFieldPriority,
} from "@/lib/study-field-priority";
import {
  INTENSITY_PROFILES,
  buildCategoryPlan,
  pickQuestionCount,
  topicShareForFocus,
  workloadToIntensity,
  type FocusMode,
  type IntensityTier,
} from "@/lib/study-plan-intensity";
import { sendPushNotification } from "@/lib/web-push-helper";
import { actionErrorMessage } from "@/lib/action-error";
import {
  canStaffAccessStudent,
  type StaffRole,
} from "@/lib/student-access";

export type StudyPlanActionResult<T> =
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

export interface DenemeSubjectAnalysis {
  subjectId: string;
  label: string;
  avgNet: number;
  maxNet: number;
  ratio: number;
  trendDown: boolean;
  isPriority: boolean;
  reason: string;
}

export interface StudyPlanSummary {
  totalQuestions: number;
  blockCount: number;
  subjectCount: number;
  byTaskType: Record<StudyPlanTaskType, number>;
  bySubject: Array<{
    subjectId: string;
    subjectName: string;
    questions: number;
    blocks: number;
  }>;
}

export interface GeneratedStudyPlan {
  weekStart: string;
  studyField: StudyField;
  studyFieldSelected: boolean;
  intensity: IntensityTier;
  focusMode: FocusMode;
  mockExamDayIndex: number | null;
  slots: StudyPlanSlot[];
  summary: StudyPlanSummary;
  denemeAnalysis: DenemeSubjectAnalysis[];
  warnings: string[];
}

export interface WorkloadRecommendation {
  avgWeeklyQuestions: number;
  totalQuestions: number;
  sampleWeeks: number;
  recommendedIntensity: IntensityTier;
}

export interface WeeklyStudyPlanView {
  weekStart: string;
  slots: StudyPlanSlot[];
  teacherNote: string;
  isApproved: boolean;
  updatedAt: string | null;
}

export interface SavedStudyPlanResult {
  weekStart: string;
  slotCount: number;
  subjectCount: number;
  totalQuestions: number;
}

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat biçimi geçersiz (Örn. 18:00).");

const generatePlanSchema = z.object({
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Hafta başlangıcı geçersiz.")
    .optional(),
  weekdayStart: timeSchema.optional(),
  weekdayEnd: timeSchema.optional(),
  weekendStart: timeSchema.optional(),
  weekendEnd: timeSchema.optional(),
  includeDailyRoutine: z.boolean().optional(),
  intensity: z.enum(["low", "medium", "high"]).optional(),
  focusMode: z
    .enum(["topic_heavy", "balanced", "question_heavy"])
    .optional(),
  mockExamDayIndex: z.number().int().min(0).max(6).nullable().optional(),
});

const slotSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    dayIndex: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
    taskType: z.enum(["konu", "soru", "tekrar", "rutin", "deneme"]),
    examType: z.enum(["TYT", "AYT", "YDT"]),
    subjectId: z.string().trim().min(1).max(60),
    subjectName: z.string().trim().min(1).max(120),
    topicId: z.number().int().positive().nullable(),
    topicName: z.string().trim().max(300).nullable(),
    questionCount: z.number().int().min(0).max(500),
    note: z.string().max(400),
    recommendationReason: z.string().max(400).optional(),
  })
  .transform(
    (raw): StudyPlanSlot => ({
      id: raw.id,
      dayIndex: raw.dayIndex,
      startTime: raw.startTime,
      endTime: raw.endTime,
      taskType: raw.taskType,
      examType: raw.examType,
      subjectId: raw.subjectId,
      subjectName: raw.subjectName,
      topicId: raw.topicId,
      topicName: raw.topicName,
      questionCount: raw.questionCount,
      note: raw.note,
      recommendationReason: raw.recommendationReason,
    }),
  );

const savePlanSchema = z.object({
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Hafta başlangıcı geçersiz.")
    .optional(),
  teacherNote: z.string().max(2000).optional(),
  slots: z
    .array(slotSchema)
    .max(200, "Bir hafta için en fazla 200 etüt eklenebilir."),
});

async function getTeacherId(): Promise<
  | { ok: true; teacherId: string; role: StaffRole }
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
  return {
    ok: true,
    teacherId: session.user.id,
    role: session.user.role === "admin" ? "admin" : "teacher",
  };
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

function parseTime(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface TimeBlock {
  startTime: string;
  endTime: string;
}

function buildTimeBlocks(
  startTime: string,
  endTime: string,
  desiredCount: number,
): TimeBlock[] {
  const startMin = parseTime(startTime);
  const endMin = parseTime(endTime);
  const total = endMin - startMin;
  if (total < 30) return [];

  const breakMin = 15;
  const minBlock = 30;
  const maxCount = Math.max(
    1,
    Math.floor((total + breakMin) / (minBlock + breakMin)),
  );
  const count = Math.max(1, Math.min(desiredCount, maxCount));
  let blockMin =
    Math.floor((total - (count - 1) * breakMin) / count / 5) * 5;
  if (blockMin < minBlock) blockMin = minBlock;

  const blocks: TimeBlock[] = [];
  let cursor = startMin;
  for (let i = 0; i < count; i += 1) {
    const isLast = i === count - 1;
    const blockEnd = isLast ? endMin : Math.min(cursor + blockMin, endMin);
    if (blockEnd <= cursor) break;
    blocks.push({
      startTime: formatTime(cursor),
      endTime: formatTime(blockEnd),
    });
    cursor = blockEnd + breakMin;
    if (cursor >= endMin) break;
  }
  return blocks;
}

const MOCK_SUBJECT_MAP = [
  { key: "turkceNet", subjectId: "turkce", label: "Türkçe", maxNet: 40 },
  {
    key: "matematikNet",
    subjectId: "matematik",
    label: "Temel Matematik",
    maxNet: 40,
  },
  { key: "geometriNet", subjectId: "geometri", label: "Geometri", maxNet: 10 },
  { key: "fizikNet", subjectId: "tyt-fizik", label: "Fizik", maxNet: 7 },
  { key: "kimyaNet", subjectId: "tyt-kimya", label: "Kimya", maxNet: 7 },
  {
    key: "biyolojiNet",
    subjectId: "tyt-biyoloji",
    label: "Biyoloji",
    maxNet: 6,
  },
  { key: "tarihNet", subjectId: "tyt-tarih", label: "Tarih", maxNet: 5 },
  {
    key: "cografyaNet",
    subjectId: "tyt-cografya",
    label: "Coğrafya",
    maxNet: 5,
  },
  {
    key: "felsefeNet",
    subjectId: "tyt-felsefe",
    label: "Felsefe",
    maxNet: 5,
  },
  { key: "dinNet", subjectId: "tyt-din", label: "Din Kültürü", maxNet: 5 },
] as const;

type MockExamRow = typeof mockExams.$inferSelect;

function analyseDeneme(exams: MockExamRow[]): DenemeSubjectAnalysis[] {
  if (exams.length === 0) return [];
  const latest = exams[0];
  const previous = exams.slice(1);

  const analyses = MOCK_SUBJECT_MAP.map((entry) => {
    const nets = exams.map((exam) => Number(exam[entry.key] ?? 0));
    const avgNet = nets.reduce((sum, net) => sum + net, 0) / nets.length;
    const previousNets = previous.map((exam) =>
      Number(exam[entry.key] ?? 0),
    );
    const previousAvg =
      previousNets.length > 0
        ? previousNets.reduce((sum, net) => sum + net, 0) /
          previousNets.length
        : null;
    const latestNet = Number(latest[entry.key] ?? 0);
    const ratio = Math.max(
      0,
      Math.min(1, avgNet / Math.max(1, entry.maxNet)),
    );
    const trendDown =
      previousAvg !== null && latestNet < previousAvg - entry.maxNet * 0.1;

    return {
      subjectId: entry.subjectId,
      label: entry.label,
      avgNet,
      maxNet: entry.maxNet,
      ratio,
      trendDown,
      isPriority: false,
      reason: "",
    };
  });

  const priority = [...analyses].sort((a, b) => a.ratio - b.ratio)[0];
  for (const item of analyses) {
    item.isPriority =
      item === priority && (item.ratio < 0.5 || item.trendDown);
    if (item.isPriority) {
      item.reason = `📉 Deneme Analizi: Öncelikli Branş • Son ${exams.length} denemede ort. ${item.avgNet.toFixed(1)} / ${item.maxNet} net`;
    } else if (item.ratio < 0.5 || item.trendDown) {
      item.reason = item.trendDown
        ? `📉 Son denemede düşüş • Ort. ${item.avgNet.toFixed(1)} net`
        : `📉 Son denemelerde ort. ${item.avgNet.toFixed(1)} net`;
    }
  }
  return analyses;
}

interface TopicRow {
  id: number;
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  topicName: string;
  avgRecentQuestions: number;
}

interface TaskCandidate {
  key: string;
  taskType: StudyPlanTaskType;
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  topicId: number | null;
  topicName: string | null;
  questionCount: number;
  note: string;
  recommendationReason?: string;
  score: number;
  dayConstraint?: number;
  sequence: number;
  topicStatus: string;
  carryover?: boolean;
}

interface BuildTasksInput {
  topics: TopicRow[];
  statusByTopic: Map<number, string>;
  solvedByTopic: Map<
    number,
    {
      correct: number;
      wrong: number;
      blank: number;
      lastSolvedDate: string | null;
    }
  >;
  weakTopicIds: Set<number>;
  denemeBySubject: Map<string, DenemeSubjectAnalysis>;
  analysisByTopicId: Map<number, AnalysisPlanItem>;
  analysisPeriodTitle: string | null;
  intensity: IntensityTier;
  focusMode: FocusMode;
  carriedTopicIds: Set<number>;
  /** Öğrencinin aktif alanı; alan önceliği puanlamasında kullanılır. */
  studyField: StudyField;
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.floor(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

function validateTimeRange(start: string, end: string): boolean {
  return parseTime(start) < parseTime(end);
}

function focusScoreBoost(
  focusMode: FocusMode,
  taskType: StudyPlanTaskType,
): number {
  if (focusMode === "topic_heavy" && taskType === "konu") return 16;
  if (
    focusMode === "question_heavy" &&
    (taskType === "soru" || taskType === "tekrar")
  ) {
    return 16;
  }
  return 0;
}

function buildTaskCandidates(input: BuildTasksInput): TaskCandidate[] {
  const today = todayInIstanbul();
  const tasks: TaskCandidate[] = [];
  let sequence = 0;

  for (const topic of input.topics) {
    const status = input.statusByTopic.get(topic.id) ?? "baslamadi";
    const solved = input.solvedByTopic.get(topic.id);
    const correct = solved?.correct ?? 0;
    const wrong = solved?.wrong ?? 0;
    const blank = solved?.blank ?? 0;
    const totalSolved = correct + wrong + blank;
    const answered = correct + wrong;
    const accuracy = answered > 0 ? correct / answered : null;
    const lastSolvedDate = solved?.lastSolvedDate ?? null;
    const daysSince = lastSolvedDate
      ? daysBetweenISO(lastSolvedDate, today)
      : null;
    const avg = topic.avgRecentQuestions;
    const isWeakTopic = input.weakTopicIds.has(topic.id);
    const isCarryover = input.carriedTopicIds.has(topic.id);
    const deneme = input.denemeBySubject.get(topic.subjectId);
    const denemeBoost = deneme?.isPriority
      ? 30
      : deneme && (deneme.ratio < 0.5 || deneme.trendDown)
        ? 12
        : 0;
    const analysis = input.analysisByTopicId.get(topic.id);
    const analysisPriority = analysis?.isPriority === true;
    const fieldInfo = resolveFieldPriority({
      field: input.studyField,
      subjectId: topic.subjectId,
      examType: topic.examType,
      priorityLevel: analysis?.priorityLevel ?? null,
      statusLabel: analysis?.statusLabel ?? null,
      avgRecentQuestions: avg,
    });

    // EA alanında garanti olmayan TYT Fen konuları plana hiç girmez.
    if (!fieldInfo.allowed) continue;

    let taskType: StudyPlanTaskType | null = null;
    let questionCount = 0;
    let reason = "";
    let score = avg * 10 + denemeBoost + fieldInfo.boost;
    let highPriority = isWeakTopic || isCarryover;

    if (isWeakTopic) {
      if (status === "baslamadi") {
        taskType = "konu";
        reason = "🎯 Deneme Analizi: Zayıf Konu • Önce konu, sonra soru";
      } else {
        taskType = "soru";
        highPriority = true;
        reason =
          accuracy === null
            ? "🎯 Deneme Analizi: Zayıf Konu • Bol soru"
            : `🎯 Deneme Analizi: Zayıf Konu • %${Math.round(accuracy * 100)} doğruluk`;
      }
      score += 45;
    } else if (status === "baslamadi") {
      if (avg >= OSYM_GUARANTEED_AVG) {
        taskType = "konu";
        reason = `🔥 Garanti Konu • ÖSYM son 5 yıl ort. ${avg.toFixed(1)} soru`;
        score += 25;
      } else if (avg >= OSYM_REGULAR_AVG) {
        taskType = "konu";
        reason = `ÖSYM düzenli konu • Ort. ${avg.toFixed(1)} soru`;
        score += 8;
      } else {
        score -= 20;
      }
    } else if (status === "calisiliyor") {
      taskType = "soru";
      reason =
        totalSolved > 0
          ? `Devam eden konu • ${totalSolved} soru çözüldü`
          : "Çalışılıyor işaretli • Soru pratiği";
      score += 20;
      if (accuracy !== null && accuracy < 0.65) {
        highPriority = true;
        reason += ` • %${Math.round(accuracy * 100)} doğruluk, telafi gerekli`;
        score += 15;
      }
    } else if (status === "bitti") {
      const overdue = daysSince === null || daysSince > 21;
      if (overdue && avg >= OSYM_GUARANTEED_AVG) {
        taskType = "tekrar";
        reason =
          daysSince === null
            ? "🔄 Konu bitti • Hiç test kaydı yok"
            : `🔄 Konu bitti • ${daysSince} gündür soru çözülmedi`;
        score += 18;
      } else if (accuracy !== null && accuracy < 0.65 && totalSolved >= 30) {
        taskType = "soru";
        highPriority = true;
        reason = `📉 %${Math.round(accuracy * 100)} doğruluk • Telafi soruları`;
        score += 14;
      } else {
        score -= 30;
      }
    }

    if (analysisPriority && analysis) {
      highPriority = true;
      if (taskType === null) {
        taskType =
          status === "baslamadi"
            ? "konu"
            : status === "bitti"
              ? "tekrar"
              : "soru";
      }
      score += (analysis.priorityLevel === 1 ? 70 : 45) + analysis.lostPoints;
    }

    if (taskType === null && isCarryover) {
      taskType =
        status === "baslamadi"
          ? "konu"
          : status === "bitti"
            ? "tekrar"
            : "soru";
      highPriority = true;
      reason = "Geçen haftadan devreden hedef";
    }

    if (taskType === null) continue;

    questionCount = pickQuestionCount(input.intensity, taskType, highPriority);
    score += focusScoreBoost(input.focusMode, taskType);
    if (isCarryover) {
      score += 80;
      reason = `↪️ Geçen Haftadan DevredenHedef • ${reason}`;
    }
    if (deneme?.isPriority) {
      reason = `${reason} • ${deneme.reason}`;
    }
    if (analysisPriority && analysis && input.analysisPeriodTitle) {
      const analysisNote = buildAnalysisTopicNote({
        periodTitle: input.analysisPeriodTitle,
        priorityLevel: analysis.priorityLevel,
        lostPoints: analysis.lostPoints,
        outcomes: analysis.outcomes,
      });
      reason = reason ? `${analysisNote} • ${reason}` : analysisNote;
    }

    const fieldPrefix = fieldInfo.isCore
      ? fieldPriorityLabel(input.studyField)
      : fieldInfo.boost < 0
        ? `🔻 ${fieldInfo.label}`
        : `⚖️ ${fieldInfo.label}`;
    reason = reason ? `${fieldPrefix} • ${reason}` : fieldPrefix;

    tasks.push({
      key: `${topic.subjectId}:${topic.id}`,
      taskType,
      examType: topic.examType,
      subjectId: topic.subjectId,
      subjectName: topic.subjectName,
      topicId: topic.id,
      topicName: topic.topicName,
      questionCount,
      note: isCarryover ? "Geçen haftadan devreden hedef" : "",
      recommendationReason: reason,
      score,
      sequence: sequence++,
      topicStatus: status,
    });
  }

  return tasks;
}

function summarize(slots: StudyPlanSlot[]): StudyPlanSummary {
  const byTaskType: Record<StudyPlanTaskType, number> = {
    konu: 0,
    soru: 0,
    tekrar: 0,
    rutin: 0,
    deneme: 0,
  };
  const subjectMap = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      questions: number;
      blocks: number;
    }
  >();
  let totalQuestions = 0;

  for (const slot of slots) {
    totalQuestions += slot.questionCount;
    byTaskType[slot.taskType] += 1;
    const existing = subjectMap.get(slot.subjectId);
    if (existing) {
      existing.questions += slot.questionCount;
      existing.blocks += 1;
    } else {
      subjectMap.set(slot.subjectId, {
        subjectId: slot.subjectId,
        subjectName: slot.subjectName,
        questions: slot.questionCount,
        blocks: 1,
      });
    }
  }

  return {
    totalQuestions,
    blockCount: slots.length,
    subjectCount: subjectMap.size,
    byTaskType,
    bySubject: [...subjectMap.values()].sort(
      (a, b) => b.questions - a.questions,
    ),
  };
}

export async function generateAutoStudyPlan(
  input: unknown,
): Promise<StudyPlanActionResult<GeneratedStudyPlan>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = generatePlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const {
    studentId,
    includeDailyRoutine = true,
    intensity = "medium",
    focusMode = "balanced",
    mockExamDayIndex = null,
  } = parsed.data;
  const weekStart = parseMonday(parsed.data.weekStart);
  const profile = INTENSITY_PROFILES[intensity];
  const previousWeekStart = addDaysISO(weekStart, -7);
  const defaultWeekdayStart = profile.weekdayBlocks[0].startTime;
  const defaultWeekdayEnd =
    profile.weekdayBlocks[profile.weekdayBlocks.length - 1].endTime;
  const defaultWeekendStart = profile.weekendBlocks[0].startTime;
  const defaultWeekendEnd =
    profile.weekendBlocks[profile.weekendBlocks.length - 1].endTime;
  const weekdayStart = parsed.data.weekdayStart ?? defaultWeekdayStart;
  const weekdayEnd = parsed.data.weekdayEnd ?? defaultWeekdayEnd;
  const weekendStart = parsed.data.weekendStart ?? defaultWeekendStart;
  const weekendEnd = parsed.data.weekendEnd ?? defaultWeekendEnd;

  if (!validateTimeRange(weekdayStart, weekdayEnd)) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Hafta içi bitiş saati başlangıçtan sonra olmalı.",
    };
  }
  if (!validateTimeRange(weekendStart, weekendEnd)) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Hafta sonu bitiş saati başlangıçtan sonra olmalı.",
    };
  }

  try {
    if (!(await canStaffAccessStudent(ctx, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const [
      profileRows,
      progressRows,
      solvedRows,
      examRows,
      previousTargetRows,
      previousEntryRows,
      analysisPlan,
    ] = await Promise.all([
        db
          .select({ studyField: users.studyField })
          .from(users)
          .where(eq(users.id, studentId))
          .limit(1),
        db
          .select({
            topicId: studentTopicProgress.topicId,
            status: studentTopicProgress.status,
          })
          .from(studentTopicProgress)
          .where(eq(studentTopicProgress.studentId, studentId)),
        db
          .select({
            topicId: dailyQuestionEntries.topicId,
            correct: sql<number>`coalesce(sum(${dailyQuestionEntries.correct}), 0)::int`,
            wrong: sql<number>`coalesce(sum(${dailyQuestionEntries.wrong}), 0)::int`,
            blank: sql<number>`coalesce(sum(${dailyQuestionEntries.blank}), 0)::int`,
            lastSolvedDate: sql<string | null>`max(${dailyQuestionEntries.date})`,
          })
          .from(dailyQuestionEntries)
          .where(eq(dailyQuestionEntries.studentId, studentId))
          .groupBy(dailyQuestionEntries.topicId),
        db
          .select()
          .from(mockExams)
          .where(eq(mockExams.studentId, studentId))
          .orderBy(desc(mockExams.examDate), desc(mockExams.createdAt))
          .limit(3),
        db
          .select({ topicIds: weeklyTargets.targetTopics })
          .from(weeklyTargets)
          .where(
            and(
              eq(weeklyTargets.studentId, studentId),
              eq(weeklyTargets.weekStartDate, previousWeekStart),
            ),
          ),
        db
          .select({ topicId: dailyQuestionEntries.topicId })
          .from(dailyQuestionEntries)
          .where(
            and(
              eq(dailyQuestionEntries.studentId, studentId),
              gte(dailyQuestionEntries.date, previousWeekStart),
              lt(dailyQuestionEntries.date, weekStart),
            ),
          )
          .groupBy(dailyQuestionEntries.topicId)
          .having(
            sql`coalesce(sum(${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}), 0) > 0`,
          ),
        loadLatestAnalysisPlan(studentId),
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
    const warnings: string[] = [];
    if (rawField === null) {
      warnings.push(
        "Öğrencinin alanı seçilmemiş; Sayısal alana göre plan hazırlandı.",
      );
    }

    const topicRows = await db
      .select({
        id: curriculumTopics.id,
        examType: curriculumTopics.examType,
        subjectId: curriculumTopics.subjectId,
        subjectName: curriculumTopics.subjectName,
        topicName: curriculumTopics.topicName,
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

    if (topicRows.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Bu alan için müfredat konusu bulunamadı.",
      };
    }

    const statusByTopic = new Map<number, string>();
    for (const row of progressRows) {
      statusByTopic.set(row.topicId, row.status);
    }
    const solvedByTopic = new Map<
      number,
      {
        correct: number;
        wrong: number;
        blank: number;
        lastSolvedDate: string | null;
      }
    >();
    for (const row of solvedRows) {
      solvedByTopic.set(row.topicId, row);
    }

    const denemeAnalysis = analyseDeneme(examRows);
    const denemeBySubject = new Map<string, DenemeSubjectAnalysis>();
    for (const item of denemeAnalysis) {
      denemeBySubject.set(item.subjectId, item);
    }

    const weakTopicIds = new Set<number>();
    for (const exam of examRows) {
      for (const id of exam.weakTopicIds ?? []) {
        weakTopicIds.add(id);
      }
    }

    const previousTargetTopicIds = new Set<number>();
    for (const row of previousTargetRows) {
      for (const id of row.topicIds ?? []) {
        previousTargetTopicIds.add(id);
      }
    }
    const solvedPreviousWeek = new Set<number>();
    for (const row of previousEntryRows) {
      solvedPreviousWeek.add(row.topicId);
    }
    const carriedTopicIds = new Set<number>();
    for (const topicId of previousTargetTopicIds) {
      if (!solvedPreviousWeek.has(topicId)) carriedTopicIds.add(topicId);
    }

    const candidates = buildTaskCandidates({
      topics: topicRows as TopicRow[],
      statusByTopic,
      solvedByTopic,
      weakTopicIds,
      denemeBySubject,
      analysisByTopicId: analysisPlan?.byTopicId ?? new Map(),
      analysisPeriodTitle: analysisPlan?.periodTitle ?? null,
      intensity,
      focusMode,
      carriedTopicIds,
      studyField,
    });

    if (candidates.length === 0) {
      warnings.push(
        "Müfredat verisi yetersiz; plan yalnızca günlük rutinlerden oluştu.",
      );
    }

    const carriedTasks = candidates
      .filter(
        (task) =>
          task.topicId !== null && carriedTopicIds.has(task.topicId),
      )
      .sort((a, b) => b.score - a.score);
    carriedTasks.forEach((task, index) => {
      task.carryover = true;
      if (index < 2) task.dayConstraint = 0;
      else if (index < 4) task.dayConstraint = 1;
    });

    const weekdayBlocks =
      weekdayStart === defaultWeekdayStart && weekdayEnd === defaultWeekdayEnd
        ? profile.weekdayBlocks.map((block) => ({ ...block }))
        : buildTimeBlocks(weekdayStart, weekdayEnd, profile.weekdayCount);
    const weekendBlocks =
      weekendStart === defaultWeekendStart && weekendEnd === defaultWeekendEnd
        ? profile.weekendBlocks.map((block) => ({ ...block }))
        : buildTimeBlocks(weekendStart, weekendEnd, profile.weekendCount);
    const blocksByDay = Array.from({ length: 7 }, (_, dayIndex) =>
      dayIndex >= 5 ? weekendBlocks : weekdayBlocks,
    );

    type FixedSeed = Omit<
      StudyPlanSlot,
      "id" | "dayIndex" | "startTime" | "endTime"
    >;
    const fixedByDay = new Map<number, Map<number, FixedSeed>>();
    const setFixed = (dayIndex: number, blockIndex: number, seed: FixedSeed) => {
      if (blockIndex < 0 || blockIndex >= blocksByDay[dayIndex].length) return;
      const existing = fixedByDay.get(dayIndex) ?? new Map<number, FixedSeed>();
      existing.set(blockIndex, seed);
      fixedByDay.set(dayIndex, existing);
    };

    if (includeDailyRoutine) {
      const routineQuestions = pickQuestionCount(intensity, "rutin");
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        setFixed(dayIndex, 0, {
          taskType: "rutin",
          examType: "TYT",
          subjectId: "turkce",
          subjectName: "Paragraf + Problem",
          topicId: null,
          topicName: "Paragraf + Problem",
          questionCount: routineQuestions,
          note: `${routineQuestions} soru • paragraf + problem`,
          recommendationReason:
            "🧭 Günlük rutin • Paragraf ve problem refleksini koru",
        });
      }
    }

    const denemeAnalysisSeed: FixedSeed = {
      taskType: "deneme",
      examType: "TYT",
      subjectId: "deneme-analizi",
      subjectName: "Deneme Analizi",
      topicId: null,
      topicName: "Deneme Sınavı Yanlışlarının Analizi ve Eksik Tespiti",
      questionCount: 0,
      note: "Okuldaki denemede boş ve yanlış bırakılan soruların video/öğretmen çözümlerini incele.",
      recommendationReason:
        "🔍 Deneme Sınavı Yanlışlarının Analizi ve Eksik Tespiti",
    };
    const telafiSeed: FixedSeed = {
      taskType: "tekrar",
      examType: "TYT",
      subjectId: "haftalik-telafi",
      subjectName: "Haftalık Telafi",
      topicId: null,
      topicName: "Haftalık Telafi ve Eksik Tamamlama",
      questionCount: 0,
      note: "Haftanın eksik kalan konularını tamamla",
      recommendationReason: "🧩 Haftalık Telafi ve Eksik Tamamlama",
    };

    if (mockExamDayIndex !== null && blocksByDay[mockExamDayIndex].length > 0) {
      setFixed(mockExamDayIndex, 0, denemeAnalysisSeed);
    }

    const questionHeavyDenemeDay = 5;
    if (focusMode === "question_heavy") {
      const blockCount = blocksByDay[questionHeavyDenemeDay].length;
      const targetIndex = blockCount > 1 ? 1 : 0;
      if (blockCount > 0 && mockExamDayIndex !== questionHeavyDenemeDay) {
        setFixed(questionHeavyDenemeDay, targetIndex, {
          taskType: "deneme",
          examType: "TYT",
          subjectId: "brans-denemesi",
          subjectName: "Branş Denemesi",
          topicId: null,
          topicName: "Branş Denemesi",
          questionCount: 0,
          note: "Soru kampı • branş denemesi",
          recommendationReason:
            "🎯 Odak: Soru Kampı • Branş Denemesi (haftalık)",
        });
      }
    }

    if (blocksByDay[6].length > 0) {
      const lastSundayIndex = blocksByDay[6].length - 1;
      const sundayAnalysisOnly =
        mockExamDayIndex === 6 && blocksByDay[6].length === 1;
      if (!sundayAnalysisOnly) {
        setFixed(6, lastSundayIndex, telafiSeed);
      }
    }

    const isFixed = (dayIndex: number, blockIndex: number): boolean =>
      fixedByDay.get(dayIndex)?.has(blockIndex) === true;

    let academicCapacity = 0;
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      for (
        let blockIndex = 0;
        blockIndex < blocksByDay[dayIndex].length;
        blockIndex += 1
      ) {
        if (!isFixed(dayIndex, blockIndex)) academicCapacity += 1;
      }
    }
    const categoryPlan =
      focusMode === "balanced"
        ? []
        : buildCategoryPlan(academicCapacity, topicShareForFocus(focusMode));

    const used = new Set<string>();
    const usedBySubject = new Map<string, number>();
    const aytCountByDay = new Array<number>(7).fill(0);
    const slots: StudyPlanSlot[] = [];
    let slotSequence = 0;
    let academicPlanIndex = 0;

    const nextSlotId = (dayIndex: number): string => {
      slotSequence += 1;
      return `slot-${dayIndex}-${slotSequence}`;
    };

    const pickTask = (
      dayIndex: number,
      previousSubjectId: string | null,
      desiredCategory?: "topic" | "question",
    ): TaskCandidate | null => {
      const available = candidates.filter((task) => {
        if (used.has(task.key)) return false;
        if (task.dayConstraint === undefined) return true;
        if (task.carryover === true) return task.dayConstraint <= dayIndex;
        return task.dayConstraint === dayIndex;
      });
      if (available.length === 0) return null;

      const forced = available.filter(
        (task) => task.dayConstraint === dayIndex,
      );
      let pool = forced.length > 0 ? forced : available;

      if (desiredCategory !== undefined) {
        const categoryMatches = pool.filter((task) => {
          if (desiredCategory === "topic") {
            return (
              task.taskType === "konu" &&
              (task.topicStatus === "baslamadi" ||
                task.topicStatus === "calisiliyor")
            );
          }
          return (
            task.taskType === "soru" ||
            task.taskType === "tekrar" ||
            task.taskType === "deneme"
          );
        });
        if (categoryMatches.length > 0) pool = categoryMatches;
      }

      const nonAyt = pool.filter((task) => task.examType !== "AYT");
      if (aytCountByDay[dayIndex] >= 1 && nonAyt.length > 0) {
        pool = nonAyt;
      }

      const varied = pool.filter(
        (task) => task.subjectId !== previousSubjectId,
      );
      if (varied.length > 0) {
        pool = varied;
      }

      let best: TaskCandidate | null = null;
      let bestScore = -Infinity;
      for (const task of pool) {
        const subjectUse = usedBySubject.get(task.subjectId) ?? 0;
        let score =
          task.score +
          (task.dayConstraint === dayIndex ? 40 : 0) -
          subjectUse * 9 -
          (task.subjectId === previousSubjectId ? 15 : 0);
        if (subjectUse >= 4) score -= 25;
        score -= task.sequence * 0.01;
        if (score > bestScore) {
          bestScore = score;
          best = task;
        }
      }
      return best;
    };

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const blocks = blocksByDay[dayIndex];
      let previousSubjectId: string | null = null;

      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
        const block = blocks[blockIndex];
        const fixedSeed = fixedByDay.get(dayIndex)?.get(blockIndex);

        if (fixedSeed) {
          slots.push({
            id: nextSlotId(dayIndex),
            dayIndex,
            startTime: block.startTime,
            endTime: block.endTime,
            ...fixedSeed,
          });
          previousSubjectId = fixedSeed.subjectId;
          continue;
        }

        const desiredCategory =
          categoryPlan.length > 0
            ? categoryPlan[academicPlanIndex]
            : undefined;
        academicPlanIndex += 1;

        const task = pickTask(dayIndex, previousSubjectId, desiredCategory);
        if (!task) continue;

        used.add(task.key);
        usedBySubject.set(
          task.subjectId,
          (usedBySubject.get(task.subjectId) ?? 0) + 1,
        );
        if (task.examType === "AYT") {
          aytCountByDay[dayIndex] += 1;
        }

        let taskType = task.taskType;
        let questionCount = task.questionCount;
        let recommendationReason = task.recommendationReason ?? "";
        if (desiredCategory === "topic" && taskType !== "konu") {
          taskType = "konu";
          questionCount = pickQuestionCount(intensity, "konu", true);
          recommendationReason = `📖 Odak: Konu Ağırlıklı • ${recommendationReason}`;
        } else if (desiredCategory === "question" && taskType === "konu") {
          taskType = "soru";
          questionCount = pickQuestionCount(intensity, "soru", true);
          recommendationReason = `🎯 Odak: Soru Kampı • ${recommendationReason}`;
        }

        slots.push({
          id: nextSlotId(dayIndex),
          dayIndex,
          startTime: block.startTime,
          endTime: block.endTime,
          taskType,
          examType: task.examType,
          subjectId: task.subjectId,
          subjectName: task.subjectName,
          topicId: task.topicId,
          topicName: task.topicName,
          questionCount,
          note: task.note,
          recommendationReason,
        });
        previousSubjectId = task.subjectId;

        if (
          taskType === "konu" &&
          task.topicId !== null &&
          task.dayConstraint === undefined
        ) {
          const followUpDay = dayIndex + 2;
          if (followUpDay < 7) {
            const followUpKey = `${task.key}:follow-up`;
            if (!used.has(followUpKey)) {
              candidates.push({
                key: followUpKey,
                taskType: "soru",
                examType: task.examType,
                subjectId: task.subjectId,
                subjectName: task.subjectName,
                topicId: task.topicId,
                topicName: task.topicName,
                questionCount: pickQuestionCount(intensity, "soru", true),
                note: "Konu pekiştirme",
                recommendationReason:
                  "🔁 Konu tekrarı • 2 gün sonra pekiştirme soruları",
                score: task.score + 20,
                dayConstraint: followUpDay,
                sequence: 10000 + slotSequence,
                topicStatus: task.topicStatus,
              });
            }
          }
        }
      }
    }

    slots.sort(
      (a, b) =>
        a.dayIndex - b.dayIndex ||
        parseTime(a.startTime) - parseTime(b.startTime),
    );

    if (slots.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Seçilen saat aralıklarında etüt oluşturulamadı.",
      };
    }

    const summary = summarize(slots);
    if (summary.totalQuestions < profile.minQuestions) {
      warnings.push(
        `Oluşturulan planda ${summary.totalQuestions} soru var; ${profile.label} seviye alt sınırı ${profile.minQuestions} soru. Daha uygun bir yoğunluk seçebilir veya etüt ekleyebilirsin.`,
      );
    }
    if (carriedTopicIds.size > 0) {
      warnings.push(
        `${carriedTopicIds.size} konu geçen haftadan devredildi ve planın ilk günlerine öncelikli yerleştirildi.`,
      );
    }

    return {
      success: true,
      data: {
        weekStart,
        studyField,
        studyFieldSelected: rawField !== null,
        intensity,
        focusMode,
        mockExamDayIndex,
        slots,
        summary,
        denemeAnalysis,
        warnings,
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

async function loadStudyPlan(
  studentId: string,
  weekStart: string,
): Promise<WeeklyStudyPlanView | null> {
  const rows = await db
    .select({
      slots: weeklyStudyPlans.slots,
      teacherNote: weeklyStudyPlans.teacherNote,
      isApproved: weeklyStudyPlans.isApproved,
      updatedAt: weeklyStudyPlans.updatedAt,
    })
    .from(weeklyStudyPlans)
    .where(
      and(
        eq(weeklyStudyPlans.studentId, studentId),
        eq(weeklyStudyPlans.weekStartDate, weekStart),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    weekStart,
    slots: Array.isArray(row.slots) ? row.slots : [],
    teacherNote: row.teacherNote,
    isApproved: row.isApproved,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export async function getWeeklyStudyPlan(
  studentId: string,
  weekStartArg?: string,
): Promise<StudyPlanActionResult<WeeklyStudyPlanView | null>> {
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

  try {
    if (!(await canStaffAccessStudent(ctx, parsedId.data))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }
    return {
      success: true,
      data: await loadStudyPlan(parsedId.data, parseMonday(weekStartArg)),
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export async function getMyWeeklyStudyPlan(
  weekStartArg?: string,
): Promise<StudyPlanActionResult<WeeklyStudyPlanView | null>> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  try {
    return {
      success: true,
      data: await loadStudyPlan(ctx.studentId, parseMonday(weekStartArg)),
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export interface StudyPlanCompletionSummary {
  completedCount: number;
  totalCount: number;
}

const toggleCompletionSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Hafta başlangıcı geçersiz."),
  slotId: z.string().trim().min(1).max(80),
  completed: z.boolean(),
});

export async function toggleStudyPlanSlotCompletion(
  input: unknown,
): Promise<StudyPlanActionResult<StudyPlanCompletionSummary>> {
  const ctx = await getStudentId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = toggleCompletionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const weekStart = parseMonday(parsed.data.weekStart);

  try {
    const rows = await db
      .select({ slots: weeklyStudyPlans.slots })
      .from(weeklyStudyPlans)
      .where(
        and(
          eq(weeklyStudyPlans.studentId, ctx.studentId),
          eq(weeklyStudyPlans.weekStartDate, weekStart),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Bu hafta için yayınlanmış bir program bulunamadı.",
      };
    }

    const slots = Array.isArray(row.slots) ? row.slots : [];
    if (!slots.some((slot) => slot.id === parsed.data.slotId)) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Etüt bulunamadı.",
      };
    }

    const completedAt = parsed.data.completed
      ? new Date().toISOString()
      : null;
    const updatedSlots: StudyPlanSlot[] = slots.map((slot) =>
      slot.id === parsed.data.slotId
        ? {
            ...slot,
            isCompleted: parsed.data.completed,
            completedAt,
          }
        : slot,
    );

    await db.execute(
      sql`UPDATE weekly_study_plans
          SET slots = ${JSON.stringify(updatedSlots)}::jsonb, updated_at = now()
          WHERE student_id = ${ctx.studentId}
            AND week_start_date = ${weekStart}`,
    );

    return {
      success: true,
      data: {
        completedCount: updatedSlots.filter((slot) => slot.isCompleted).length,
        totalCount: updatedSlots.length,
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

export async function getStudentWorkloadRecommendation(  studentId: string,
): Promise<StudyPlanActionResult<WorkloadRecommendation>> {
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

  try {
    if (!(await canStaffAccessStudent(ctx, parsedId.data))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const today = todayInIstanbul();
    const start = addDaysISO(today, -20);
    const endExclusive = addDaysISO(today, 1);
    const rows = await db
      .select({
        total: sql<number>`coalesce(sum(${dailyQuestionEntries.correct} + ${dailyQuestionEntries.wrong} + ${dailyQuestionEntries.blank}), 0)::int`,
      })
      .from(dailyQuestionEntries)
      .where(
        and(
          eq(dailyQuestionEntries.studentId, parsedId.data),
          gte(dailyQuestionEntries.date, start),
          lt(dailyQuestionEntries.date, endExclusive),
        ),
      );

    const totalQuestions = Number(rows[0]?.total ?? 0);
    const avgWeeklyQuestions = Math.round(totalQuestions / 3);

    return {
      success: true,
      data: {
        avgWeeklyQuestions,
        totalQuestions,
        sampleWeeks: 3,
        recommendedIntensity: workloadToIntensity(avgWeeklyQuestions),
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

export async function saveWeeklyStudyPlan(
  input: unknown,
): Promise<StudyPlanActionResult<SavedStudyPlanResult>> {
  const ctx = await getTeacherId();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }

  const parsed = savePlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { studentId } = parsed.data;
  const weekStart = parseMonday(parsed.data.weekStart);
  const teacherNote = parsed.data.teacherNote?.trim() ?? "";
  const slots: StudyPlanSlot[] = [...parsed.data.slots].sort(
    (a, b) =>
      a.dayIndex - b.dayIndex ||
      parseTime(a.startTime) - parseTime(b.startTime),
  );

  for (const slot of slots) {
    if (parseTime(slot.startTime) >= parseTime(slot.endTime)) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: `"${slot.startTime} - ${slot.endTime}" saat aralığı geçersiz.`,
      };
    }
  }

  const bySubject = new Map<
    string,
    { questions: number; topicIds: Set<number> }
  >();
  for (const slot of slots) {
    if (slot.questionCount <= 0) continue;
    const entry = bySubject.get(slot.subjectId) ?? {
      questions: 0,
      topicIds: new Set<number>(),
    };
    entry.questions += slot.questionCount;
    if (slot.topicId !== null) entry.topicIds.add(slot.topicId);
    bySubject.set(slot.subjectId, entry);
  }

  try {
    if (!(await canStaffAccessStudent(ctx, studentId))) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO weekly_study_plans (student_id, teacher_id, week_start_date, slots, teacher_note, is_approved, updated_at)
            VALUES (${studentId}, ${ctx.teacherId}, ${weekStart}, ${JSON.stringify(slots)}::jsonb, ${teacherNote}, false, now())
            ON CONFLICT (student_id, week_start_date)
            DO UPDATE SET teacher_id = EXCLUDED.teacher_id, slots = EXCLUDED.slots, teacher_note = EXCLUDED.teacher_note, is_approved = false, updated_at = now()`,
      );

      for (const [subjectId, entry] of bySubject) {
        const topicArray =
          entry.topicIds.size > 0
            ? `ARRAY[${[...entry.topicIds].join(",")}]::int[]`
            : "ARRAY[]::int[]";
        await tx.execute(
          sql`INSERT INTO weekly_targets (student_id, teacher_id, week_start_date, subject_id, target_question_count, target_topics, is_schedule_approved)
              VALUES (${studentId}, ${ctx.teacherId}, ${weekStart}, ${subjectId}, ${entry.questions}, ${sql.raw(topicArray)}, false)
              ON CONFLICT (student_id, week_start_date, subject_id)
              DO UPDATE SET teacher_id = EXCLUDED.teacher_id, target_question_count = EXCLUDED.target_question_count, target_topics = EXCLUDED.target_topics, is_schedule_approved = false`,
        );
      }
    });

    await sendPushNotification(
      studentId,
      "Haftalık Çalışma Programı Yayınlandı",
      "Danışman öğretmenin bu hafta için ders çalışma programını yayınladı. Hemen incele.",
      "/weekly-targets",
    );

    await logActivity({
      actorId: ctx.teacherId,
      action: "study_plan_saved",
      studentId,
    });

    return {
      success: true,
      data: {
        weekStart,
        slotCount: slots.length,
        subjectCount: bySubject.size,
        totalQuestions: slots.reduce(
          (sum, slot) => sum + slot.questionCount,
          0,
        ),
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
