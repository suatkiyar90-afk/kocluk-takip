"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  curriculumTopics,
  examAnalysisPeriods,
  studentPeriodExams,
  studentPeriodTopicAnalyses,
  users,
  weeklyTargets,
  type ExamAnalysisOutcome,
} from "@/db/schema";
import { actionErrorDetail } from "@/lib/action-error";
import { chunkRows } from "@/lib/chunk-rows";
import {
  ExamAnalysisParseError,
  canonicalSubjectFor,
  cleanExamName,
  findCurriculumTopicId,
  normalizePersonName,
  normalizeStudentNumber,
  normalizeTrName,
  parseExamAnalysisWorkbooks,
  type AnalysisSubjectName,
  type ExamAnalysisParseCounts,
  type ParsedStudentAnalysis,
} from "@/lib/exam-analysis";
import { parseMonday } from "@/lib/week-utils";
import {
  canStaffAccessStudent,
  isStudentAssignedToTeacher,
} from "@/lib/student-access";

export type ExamAnalysisActionResult<T> =
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

export interface ExamAnalysisPeriodView {
  id: number;
  title: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExamAnalysisPeriodSummary extends ExamAnalysisPeriodView {
  studentCount: number;
  topicCount: number;
  examCount: number;
}

export interface ExamAnalysisExamView {
  id: number;
  examName: string;
  examDate: string | null;
  totalNet: number;
}

export interface ExamAnalysisTopicView {
  id: number;
  subjectGroup: string;
  subjectName: string;
  topicName: string;
  matchedTopicId: number | null;
  totalQuestions: number;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  successPct: number;
  statusLabel: string;
  priorityLevel: number | null;
  priorityOrder: number | null;
  lostPoints: number;
  outcomes: ExamAnalysisOutcome[];
}

export interface ExamAnalysisOverview {
  periods: ExamAnalysisPeriodView[];
  period: ExamAnalysisPeriodView | null;
  exams: ExamAnalysisExamView[];
  topics: ExamAnalysisTopicView[];
  summary: {
    totalLostPoints: number;
    priorityOneCount: number;
    urgentCount: number;
    topicCount: number;
    outcomeCount: number;
    totalQuestions: number;
  };
}

export interface ExamAnalysisUnmatchedStudent {
  name: string;
  studentNumber: string | null;
}

export interface ExamAnalysisPreview {
  counts: ExamAnalysisParseCounts;
  matchedStudents: number;
  unmatched: ExamAnalysisUnmatchedStudent[];
  matchedTopics: number;
  warnings: string[];
}

export interface ExamAnalysisSaveResult extends ExamAnalysisPreview {
  periodId: number;
  title: string;
}

export interface AddAnalysisTopicResult {
  subjectId: string;
  subjectName: string;
  topicId: number;
  topicName: string;
  targetQuestionCount: number;
}

type GuardResult =
  | { ok: true; userId: string; role: "student" | "teacher" | "admin" }
  | {
      ok: false;
      status: "UNAUTHORIZED" | "FORBIDDEN";
      message: string;
    };

async function getSessionUser(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      status: "UNAUTHORIZED",
      message: "Oturum açmanız gerekiyor.",
    };
  }
  const role = session.user.role;
  if (role !== "student" && role !== "teacher" && role !== "admin") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu işlem için yetkiniz yok.",
    };
  }
  return { ok: true, userId: session.user.id, role };
}

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string }
> {
  const ctx = await getSessionUser();
  if (ctx.ok === false) return ctx;
  if (ctx.role !== "admin") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu işlem için yönetici yetkisi gerekli.",
    };
  }
  return { ok: true, userId: ctx.userId };
}

async function requireTeacher(): Promise<
  | { ok: true; userId: string; role: "teacher" | "admin" }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string }
> {
  const ctx = await getSessionUser();
  if (ctx.ok === false) return ctx;
  if (ctx.role !== "teacher" && ctx.role !== "admin") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu işlem için öğretmen yetkisi gerekli.",
    };
  }
  return {
    ok: true,
    userId: ctx.userId,
    role: ctx.role === "admin" ? "admin" : "teacher",
  };
}

/**
 * Haftalık hedef ekleme yalnızca danışman öğretmen ve yöneticiye açıktır.
 * Öğrenci hesapları analiz kartından hedef ekleyemez; bu kontrol butonun
 * gizlenmesinden bağımsız olarak sunucu tarafında da uygulanır.
 */
async function requireCoach(): Promise<
  | { ok: true; userId: string; role: "teacher" | "admin" }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string }
> {
  const access = await requireTeacher();
  if (access.ok === false) {
    return {
      ok: false,
      status: access.status,
      message:
        access.status === "FORBIDDEN"
          ? "Sadece danışman öğretmen haftalık hedef ekleyebilir."
          : access.message,
    };
  }
  return access;
}

async function requireAssignedStudent(
  studentId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string }
> {
  const ctx = await getSessionUser();
  if (ctx.ok === false) return ctx;
  if (ctx.role === "student") {
    if (ctx.userId !== studentId) {
      return {
        ok: false,
        status: "FORBIDDEN",
        message: "Yalnızca kendi analizinizi görüntüleyebilirsiniz.",
      };
    }
    return { ok: true, userId: ctx.userId };
  }
  if (ctx.role === "admin") return { ok: true, userId: ctx.userId };
  if (!(await isStudentAssignedToTeacher(ctx.userId, studentId))) {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: "Bu öğrenci size atanmamış.",
    };
  }
  return { ok: true, userId: ctx.userId };
}

const fileInputSchema = z.object({
  consolidatedBase64: z
    .string()
    .min(20, "Birleştirilmiş Karne dosyası seçin.")
    .max(30_000_000, "Birleştirilmiş Karne dosyası çok büyük."),
  priorityBase64: z
    .string()
    .min(20, "Öncelikli Konu Listesi dosyası seçin.")
    .max(30_000_000, "Öncelikli Konu Listesi dosyası çok büyük."),
});

const savePeriodSchema = fileInputSchema.extend({
  title: z
    .string()
    .trim()
    .min(3, "Dönem adı en az 3 karakter olmalı.")
    .max(120, "Dönem adı çok uzun."),
  periodId: z.number().int().positive().optional(),
});

const overviewSchema = z.object({
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
  periodId: z.number().int().positive().optional(),
});

const addTopicSchema = z.object({
  studentId: z.string().uuid("Geçerli bir öğrenci seçin."),
  analysisId: z.number().int().positive(),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Hafta başlangıcı geçersiz."),
});

interface ResolvedStudent {
  student: ParsedStudentAnalysis;
  userId: string;
}

interface MatchingContext {
  resolved: ResolvedStudent[];
  unmatched: ExamAnalysisUnmatchedStudent[];
  curriculumRows: Array<{
    id: number;
    subjectId: string;
    topicName: string;
  }>;
  matchedTopicCount: number;
}

function studentNumberVariants(value: string | null): string[] {
  const normalized = normalizeStudentNumber(value);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (/^\d+$/.test(normalized)) {
    variants.add(String(Number.parseInt(normalized, 10)));
  }
  return [...variants];
}

async function resolveMatchingContext(
  parsedStudents: ParsedStudentAnalysis[],
): Promise<MatchingContext> {
  const [studentRows, curriculumRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        studentNumber: users.studentNumber,
      })
      .from(users)
      .where(eq(users.role, "student")),
    db
      .select({
        id: curriculumTopics.id,
        subjectId: curriculumTopics.subjectId,
        topicName: curriculumTopics.topicName,
      })
      .from(curriculumTopics)
      .where(
        and(
          eq(curriculumTopics.examType, "TYT"),
          eq(curriculumTopics.isActive, true),
        ),
      ),
  ]);

  const byName = new Map<string, (typeof studentRows)[number]>();
  const byNumber = new Map<string, (typeof studentRows)[number]>();
  for (const student of studentRows) {
    const nameKey = normalizeTrName(student.name);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, student);
    for (const variant of studentNumberVariants(student.studentNumber)) {
      if (!byNumber.has(variant)) byNumber.set(variant, student);
    }
  }

  const resolved: ResolvedStudent[] = [];
  const unmatched: ExamAnalysisUnmatchedStudent[] = [];
  const seenUnmatched = new Set<string>();
  let matchedTopicCount = 0;

  for (const student of parsedStudents) {
    let user = null;
    for (const number of studentNumberVariants(student.studentNumber)) {
      const byNumberMatch = byNumber.get(number);
      if (byNumberMatch) {
        user = byNumberMatch;
        break;
      }
    }
    if (!user) {
      user = byName.get(normalizeTrName(student.name)) ?? null;
    }
    if (!user) {
      const unmatchedKey = `${normalizeTrName(student.name)}|${
        student.studentNumber ?? ""
      }`;
      if (!seenUnmatched.has(unmatchedKey)) {
        seenUnmatched.add(unmatchedKey);
        unmatched.push({
          name: student.name,
          studentNumber: student.studentNumber,
        });
      }
      continue;
    }
    resolved.push({ student, userId: user.id });
    for (const topic of student.topics) {
      if (
        findCurriculumTopicId(
          topic.topicName,
          topic.subjectName,
          curriculumRows,
        ) !== null
      ) {
        matchedTopicCount += 1;
      }
    }
  }

  return { resolved, unmatched, curriculumRows, matchedTopicCount };
}

function parseFiles(
  consolidatedBase64: string,
  priorityBase64: string,
): ReturnType<typeof parseExamAnalysisWorkbooks> {
  try {
    return parseExamAnalysisWorkbooks(consolidatedBase64, priorityBase64);
  } catch (error) {
    if (error instanceof ExamAnalysisParseError) throw error;
    throw new ExamAnalysisParseError(
      "Excel dosyaları okunurken bilinmeyen bir hata oluştu.",
    );
  }
}

export async function previewExamAnalysisPeriod(
  input: unknown,
): Promise<ExamAnalysisActionResult<ExamAnalysisPreview>> {
  const admin = await requireAdmin();
  if (admin.ok === false) {
    return { success: false, status: admin.status, message: admin.message };
  }
  const parsed = fileInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  try {
    const result = parseFiles(
      parsed.data.consolidatedBase64,
      parsed.data.priorityBase64,
    );
    const context = await resolveMatchingContext(result.students);
    return {
      success: true,
      data: {
        counts: result.counts,
        matchedStudents: context.resolved.length,
        unmatched: context.unmatched,
        matchedTopics: context.matchedTopicCount,
        warnings: result.warnings,
      },
    };
  } catch (error) {
    if (error instanceof ExamAnalysisParseError) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: error.message,
      };
    }
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorDetail(error),
    };
  }
}

export async function saveExamAnalysisPeriod(
  input: unknown,
): Promise<ExamAnalysisActionResult<ExamAnalysisSaveResult>> {
  const admin = await requireAdmin();
  if (admin.ok === false) {
    return { success: false, status: admin.status, message: admin.message };
  }
  const parsedInput = savePeriodSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsedInput.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  try {
    const parsed = parseFiles(
      parsedInput.data.consolidatedBase64,
      parsedInput.data.priorityBase64,
    );
    const context = await resolveMatchingContext(parsed.students);
    if (context.resolved.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message:
          "Dosyalardaki öğrenciler kullanıcı hesaplarıyla eşleşmedi. Öğrenci adı veya numarasını kontrol edin.",
      };
    }

    const savedPeriodId = await db.transaction(async (tx) => {
      let periodId = parsedInput.data.periodId;
      if (periodId !== undefined) {
        const existing = await tx
          .select({ id: examAnalysisPeriods.id })
          .from(examAnalysisPeriods)
          .where(eq(examAnalysisPeriods.id, periodId))
          .limit(1);
        if (existing.length === 0) {
          throw new ExamAnalysisParseError("Güncellenecek analiz dönemi bulunamadı.");
        }
        const periodUpdate = {
          title: parsedInput.data.title,
          isActive: true,
          updatedAt: new Date(),
        };
        await tx
          .update(examAnalysisPeriods)
          .set(periodUpdate)
          .where(eq(examAnalysisPeriods.id, periodId));
      } else {
        const periodInsert = {
          title: parsedInput.data.title,
          isActive: true,
        };
        const inserted = await tx
          .insert(examAnalysisPeriods)
          .values(periodInsert)
          .returning({ id: examAnalysisPeriods.id });
        periodId = inserted[0]?.id;
      }
      if (!periodId) {
        throw new ExamAnalysisParseError("Analiz dönemi oluşturulamadı.");
      }

      const existingExams = await tx
        .select({
          id: studentPeriodExams.id,
          studentId: studentPeriodExams.studentId,
          examName: studentPeriodExams.examName,
          examDate: studentPeriodExams.examDate,
        })
        .from(studentPeriodExams)
        .where(eq(studentPeriodExams.periodId, periodId));
      const existingExamByKey = new Map(
        existingExams.map((exam) => [
          `${exam.studentId}|${normalizePersonName(exam.examName)}|${exam.examDate ?? ""}`,
          exam.id,
        ]),
      );
      const newExams: Array<{
        periodId: number;
        studentId: string;
        examName: string;
        examDate: string | null;
        totalNet: number;
      }> = [];
      const seenNewExamKeys = new Set<string>();
      const topicIndexByKey = new Map<string, number>();
      const topicRows: Array<{
        periodId: number;
        studentId: string;
        subjectGroup: string;
        subjectName: string;
        topicName: string;
        matchedTopicId: number | null;
        totalQuestions: number;
        correct: number;
        wrong: number;
        blank: number;
        net: number;
        successPct: number;
        statusLabel: string;
        priorityLevel: number | null;
        priorityOrder: number | null;
        lostPoints: number;
        outcomes: ExamAnalysisOutcome[];
      }> = [];

      for (const { student, userId } of context.resolved) {
        for (const exam of student.exams) {
          const key = `${userId}|${normalizePersonName(exam.examName)}|${exam.examDate ?? ""}`;
          const existingId = existingExamByKey.get(key);
          if (existingId !== undefined) {
            const examUpdate = {
              totalNet: exam.totalNet,
              examDate: exam.examDate,
            };
            await tx
              .update(studentPeriodExams)
              .set(
                examUpdate as unknown as PgUpdateSetSource<
                  typeof studentPeriodExams
                >,
              )
              .where(eq(studentPeriodExams.id, existingId));
          } else {
            if (seenNewExamKeys.has(key)) continue;
            seenNewExamKeys.add(key);
            newExams.push({
              periodId,
              studentId: userId,
              examName: exam.examName,
              examDate: exam.examDate,
              totalNet: exam.totalNet,
            });
          }
        }

        for (const topic of student.topics) {
          const topicKey = `${userId}|${topic.subjectName}|${topic.topicName}`;
          const existingIndex = topicIndexByKey.get(topicKey);
          if (existingIndex !== undefined) {
            continue;
          }
          topicIndexByKey.set(topicKey, topicRows.length);
          topicRows.push({
            periodId,
            studentId: userId,
            subjectGroup: topic.subjectGroup,
            subjectName: topic.subjectName,
            topicName: topic.topicName,
            matchedTopicId: findCurriculumTopicId(
              topic.topicName,
              topic.subjectName as AnalysisSubjectName,
              context.curriculumRows,
            ),
            totalQuestions: topic.totalQuestions,
            correct: topic.correct,
            wrong: topic.wrong,
            blank: topic.blank,
            net: topic.net,
            successPct: topic.successPct,
            statusLabel: topic.statusLabel,
            priorityLevel: topic.priorityLevel,
            priorityOrder: topic.priorityOrder,
            lostPoints: topic.lostPoints,
            outcomes: topic.outcomes,
          });
        }
      }

      // PostgreSQL tek sorguda en fazla 65.535 parametre kabul eder. Konu
      // tablosunda satır başına 17 parametre olduğu için tüm diziyi tek
      // sorguda göndermek 4.000 satırdan sonra bu sınırı aşar.
      for (const chunk of chunkRows(newExams)) {
        await tx.insert(studentPeriodExams).values(chunk);
      }

      if (topicRows.length > 0) {
        const topicUpdateSet = {
          subjectGroup: sql`excluded.subject_group`,
          matchedTopicId: sql`excluded.matched_topic_id`,
          totalQuestions: sql`excluded.total_questions`,
          correct: sql`excluded.correct`,
          wrong: sql`excluded.wrong`,
          blank: sql`excluded.blank`,
          net: sql`excluded.net`,
          successPct: sql`excluded.success_pct`,
          statusLabel: sql`excluded.status_label`,
          priorityLevel: sql`excluded.priority_level`,
          priorityOrder: sql`excluded.priority_order`,
          lostPoints: sql`excluded.lost_points`,
          outcomes: sql`excluded.outcomes`,
        };
        for (const chunk of chunkRows(topicRows)) {
          await tx
            .insert(studentPeriodTopicAnalyses)
            .values(chunk)
            .onConflictDoUpdate({
              target: [
                studentPeriodTopicAnalyses.periodId,
                studentPeriodTopicAnalyses.studentId,
                studentPeriodTopicAnalyses.subjectName,
                studentPeriodTopicAnalyses.topicName,
              ],
              set: topicUpdateSet as unknown as PgUpdateSetSource<
                typeof studentPeriodTopicAnalyses
              >,
            });
        }
      }

      return periodId;
    });

    return {
      success: true,
      data: {
        periodId: savedPeriodId,
        title: parsedInput.data.title,
        counts: parsed.counts,
        matchedStudents: context.resolved.length,
        unmatched: context.unmatched,
        matchedTopics: context.matchedTopicCount,
        warnings: parsed.warnings,
      },
    };
  } catch (error) {
    if (error instanceof ExamAnalysisParseError) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: error.message,
      };
    }
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorDetail(error),
    };
  }
}

export async function listExamAnalysisPeriodsAdmin(): Promise<
  ExamAnalysisActionResult<ExamAnalysisPeriodSummary[]>
> {
  const admin = await requireAdmin();
  if (admin.ok === false) {
    return { success: false, status: admin.status, message: admin.message };
  }
  try {
    const periods = await db
      .select()
      .from(examAnalysisPeriods)
      .orderBy(desc(examAnalysisPeriods.createdAt), desc(examAnalysisPeriods.id));
    const summaries = await Promise.all(
      periods.map(async (period) => {
        const [topicCount, examCount, studentCount] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(studentPeriodTopicAnalyses)
            .where(eq(studentPeriodTopicAnalyses.periodId, period.id)),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(studentPeriodExams)
            .where(eq(studentPeriodExams.periodId, period.id)),
          db
            .select({
              count: sql<number>`count(distinct ${studentPeriodTopicAnalyses.studentId})::int`,
            })
            .from(studentPeriodTopicAnalyses)
            .where(eq(studentPeriodTopicAnalyses.periodId, period.id)),
        ]);
        return {
          id: period.id,
          title: period.title,
          isActive: period.isActive,
          createdAt: period.createdAt.toISOString(),
          updatedAt: period.updatedAt.toISOString(),
          topicCount: topicCount[0]?.count ?? 0,
          examCount: examCount[0]?.count ?? 0,
          studentCount: studentCount[0]?.count ?? 0,
        };
      }),
    );
    return { success: true, data: summaries };
  } catch (error) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorDetail(error),
    };
  }
}

async function loadOverview(
  studentId: string,
  periodId?: number,
): Promise<ExamAnalysisOverview> {
  const periods = await db
    .select()
    .from(examAnalysisPeriods)
    .where(eq(examAnalysisPeriods.isActive, true))
    .orderBy(desc(examAnalysisPeriods.createdAt), desc(examAnalysisPeriods.id));

  const periodViews: ExamAnalysisPeriodView[] = periods.map((period) => ({
    id: period.id,
    title: period.title,
    isActive: period.isActive,
    createdAt: period.createdAt.toISOString(),
    updatedAt: period.updatedAt.toISOString(),
  }));
  const selected =
    periodId === undefined
      ? periods[0] ?? null
      : periods.find((period) => period.id === periodId) ?? null;

  if (!selected) {
    return {
      periods: periodViews,
      period: null,
      exams: [],
      topics: [],
      summary: {
        totalLostPoints: 0,
        priorityOneCount: 0,
        urgentCount: 0,
        topicCount: 0,
        outcomeCount: 0,
        totalQuestions: 0,
      },
    };
  }

  const [examRows, topicRows] = await Promise.all([
    db
      .select({
        id: studentPeriodExams.id,
        examName: studentPeriodExams.examName,
        examDate: studentPeriodExams.examDate,
        totalNet: studentPeriodExams.totalNet,
      })
      .from(studentPeriodExams)
      .where(
        and(
          eq(studentPeriodExams.periodId, selected.id),
          eq(studentPeriodExams.studentId, studentId),
        ),
      )
      .orderBy(desc(studentPeriodExams.examDate), desc(studentPeriodExams.id)),
    db
      .select()
      .from(studentPeriodTopicAnalyses)
      .where(
        and(
          eq(studentPeriodTopicAnalyses.periodId, selected.id),
          eq(studentPeriodTopicAnalyses.studentId, studentId),
        ),
      )
      .orderBy(
        asc(studentPeriodTopicAnalyses.priorityLevel),
        asc(studentPeriodTopicAnalyses.priorityOrder),
        desc(studentPeriodTopicAnalyses.lostPoints),
        asc(studentPeriodTopicAnalyses.subjectName),
        asc(studentPeriodTopicAnalyses.topicName),
      ),
  ]);

  let outcomeCount = 0;
  let totalLostPoints = 0;
  let priorityOneCount = 0;
  let urgentCount = 0;
  let totalQuestions = 0;
  for (const topic of topicRows) {
    outcomeCount += topic.outcomes.length;
    totalLostPoints += topic.lostPoints;
    totalQuestions += topic.totalQuestions;
    if (topic.priorityLevel === 1) priorityOneCount += 1;
    if (topic.statusLabel === "🔴 Acil Çalış") urgentCount += 1;
  }

  return {
    periods: periodViews,
    period: {
      id: selected.id,
      title: selected.title,
      isActive: selected.isActive,
      createdAt: selected.createdAt.toISOString(),
      updatedAt: selected.updatedAt.toISOString(),
    },
    exams: examRows.map((exam) => ({
      ...exam,
      // Eski kayıtlarda Excel'den iki kez tekrarlı gelen adlar olabilir
      // ("... TYT ... TYT (T1226)"); kartlarda tek kez gösterilir.
      examName: cleanExamName(exam.examName),
    })),
    topics: topicRows.map((topic) => ({
      id: topic.id,
      subjectGroup: topic.subjectGroup,
      subjectName: topic.subjectName,
      topicName: topic.topicName,
      matchedTopicId: topic.matchedTopicId,
      totalQuestions: topic.totalQuestions,
      correct: topic.correct,
      wrong: topic.wrong,
      blank: topic.blank,
      net: topic.net,
      successPct: topic.successPct,
      statusLabel: topic.statusLabel,
      priorityLevel: topic.priorityLevel,
      priorityOrder: topic.priorityOrder,
      lostPoints: topic.lostPoints,
      outcomes: topic.outcomes,
    })),
    summary: {
      totalLostPoints: Math.round(totalLostPoints * 100) / 100,
      priorityOneCount,
      urgentCount,
      topicCount: topicRows.length,
      outcomeCount,
      totalQuestions,
    },
  };
}

export async function getMyExamAnalysisOverview(
  periodId?: number,
): Promise<ExamAnalysisActionResult<ExamAnalysisOverview>> {
  const ctx = await getSessionUser();
  if (ctx.ok === false) {
    return { success: false, status: ctx.status, message: ctx.message };
  }
  if (ctx.role !== "student") {
    return {
      success: false,
      status: "FORBIDDEN",
      message: "Bu ekran öğrenci analizleri için kullanılır.",
    };
  }
  try {
    return { success: true, data: await loadOverview(ctx.userId, periodId) };
  } catch (error) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorDetail(error),
    };
  }
}

export async function getStudentExamAnalysisOverview(
  studentId: string,
  periodId?: number,
): Promise<ExamAnalysisActionResult<ExamAnalysisOverview>> {
  const parsed = overviewSchema.safeParse({ studentId, periodId });
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  const assigned = await requireAssignedStudent(parsed.data.studentId);
  if (assigned.ok === false) {
    return { success: false, status: assigned.status, message: assigned.message };
  }
  try {
    return {
      success: true,
      data: await loadOverview(parsed.data.studentId, parsed.data.periodId),
    };
  } catch (error) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorDetail(error),
    };
  }
}

async function upsertAnalysisTopicTarget(input: {
  studentId: string;
  teacherId: string;
  weekStart: string;
  subjectId: string;
  matchedTopicId: number;
  priorityLevel: number | null;
}): Promise<number> {
  const existingRows = await db
    .select({
      targetQuestionCount: weeklyTargets.targetQuestionCount,
      targetTopics: weeklyTargets.targetTopics,
    })
    .from(weeklyTargets)
    .where(
      and(
        eq(weeklyTargets.studentId, input.studentId),
        eq(weeklyTargets.weekStartDate, input.weekStart),
        eq(weeklyTargets.subjectId, input.subjectId),
      ),
    )
    .limit(1);
  const existing = existingRows[0];
  const topicIds = [
    ...new Set([...(existing?.targetTopics ?? []), input.matchedTopicId]),
  ];
  const suggested = input.priorityLevel === 1 ? 100 : 80;
  const targetQuestionCount = Math.max(
    1,
    (existing?.targetQuestionCount ?? 0) + suggested,
  );
  const insertRow = {
    studentId: input.studentId,
    teacherId: input.teacherId,
    weekStartDate: input.weekStart,
    subjectId: input.subjectId,
    targetQuestionCount,
    targetTopics: topicIds,
  };
  const updateSet = {
    teacherId: input.teacherId,
    targetQuestionCount,
    targetTopics: topicIds,
  };

  await db
    .insert(weeklyTargets)
    .values(insertRow)
    .onConflictDoUpdate({
      target: [
        weeklyTargets.studentId,
        weeklyTargets.weekStartDate,
        weeklyTargets.subjectId,
      ],
      set: updateSet,
    });
  return targetQuestionCount;
}

export async function addAnalysisTopicToWeeklyTarget(
  input: unknown,
): Promise<ExamAnalysisActionResult<AddAnalysisTopicResult>> {
  const teacher = await requireCoach();
  if (teacher.ok === false) {
    return { success: false, status: teacher.status, message: teacher.message };
  }
  const parsed = addTopicSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  if (parsed.data.weekStart !== parseMonday(parsed.data.weekStart)) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Hafta başlangıcı Pazartesi olmalı.",
    };
  }

  try {
    if (
      !(await canStaffAccessStudent(
        { teacherId: teacher.userId, role: teacher.role },
        parsed.data.studentId,
      ))
    ) {
      return {
        success: false,
        status: "FORBIDDEN",
        message: "Bu öğrenci size atanmamış.",
      };
    }

    const rows = await db
      .select({
        analysisId: studentPeriodTopicAnalyses.id,
        matchedTopicId: studentPeriodTopicAnalyses.matchedTopicId,
        priorityLevel: studentPeriodTopicAnalyses.priorityLevel,
        topicName: studentPeriodTopicAnalyses.topicName,
        subjectId: curriculumTopics.subjectId,
        subjectName: curriculumTopics.subjectName,
      })
      .from(studentPeriodTopicAnalyses)
      .innerJoin(
        curriculumTopics,
        eq(studentPeriodTopicAnalyses.matchedTopicId, curriculumTopics.id),
      )
      .where(
        and(
          eq(studentPeriodTopicAnalyses.id, parsed.data.analysisId),
          eq(studentPeriodTopicAnalyses.studentId, parsed.data.studentId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row || row.matchedTopicId === null) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message:
          "Bu konu müfredatla eşleşmediği için haftalık hedefe eklenemedi.",
      };
    }

    const targetQuestionCount = await upsertAnalysisTopicTarget({
      studentId: parsed.data.studentId,
      teacherId: teacher.userId,
      weekStart: parsed.data.weekStart,
      subjectId: row.subjectId,
      matchedTopicId: row.matchedTopicId,
      priorityLevel: row.priorityLevel,
    });

    return {
      success: true,
      data: {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        topicId: row.matchedTopicId,
        topicName: row.topicName,
        targetQuestionCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorDetail(error),
    };
  }
}

export async function addAnalysisTopicForAdmin(
  input: unknown,
): Promise<ExamAnalysisActionResult<AddAnalysisTopicResult>> {
  const admin = await requireAdmin();
  if (admin.ok === false) {
    return { success: false, status: admin.status, message: admin.message };
  }
  const parsed = addTopicSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }
  try {
    const rows = await db
      .select({
        matchedTopicId: studentPeriodTopicAnalyses.matchedTopicId,
        topicName: studentPeriodTopicAnalyses.topicName,
        subjectId: curriculumTopics.subjectId,
        subjectName: curriculumTopics.subjectName,
        priorityLevel: studentPeriodTopicAnalyses.priorityLevel,
      })
      .from(studentPeriodTopicAnalyses)
      .innerJoin(
        curriculumTopics,
        eq(studentPeriodTopicAnalyses.matchedTopicId, curriculumTopics.id),
      )
      .where(
        and(
          eq(studentPeriodTopicAnalyses.id, parsed.data.analysisId),
          eq(studentPeriodTopicAnalyses.studentId, parsed.data.studentId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row || row.matchedTopicId === null) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Bu konu müfredatla eşleşmedi.",
      };
    }
    const targetQuestionCount = await upsertAnalysisTopicTarget({
      studentId: parsed.data.studentId,
      teacherId: admin.userId,
      weekStart: parsed.data.weekStart,
      subjectId: row.subjectId,
      matchedTopicId: row.matchedTopicId,
      priorityLevel: row.priorityLevel,
    });
    return {
      success: true,
      data: {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        topicId: row.matchedTopicId,
        topicName: row.topicName,
        targetQuestionCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorDetail(error),
    };
  }
}
