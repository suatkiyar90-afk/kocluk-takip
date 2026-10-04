"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { and, asc, eq, gte, like, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  curriculumTopics,
  dailyQuestionEntries,
  mockExams,
  studentDailyNotes,
  users,
} from "@/db/schema";
import { actionErrorMessage } from "@/lib/action-error";
import { logActivity } from "@/lib/activity-log";
import { assertCanViewStudentReport } from "@/lib/report-access";
import {
  buildDayRows,
  buildSubjectBreakdown,
  buildSummary,
  dayCountInclusive,
  filterMocksInRange,
  validateReportRange,
  withMockDiffs,
  type ReportDayRow,
  type ReportEntryRow,
  type ReportSubject,
  type ReportSummary,
} from "@/lib/report-utils";

const UNAUTHORIZED_MESSAGE = "Oturum açmanız gerekiyor.";
const NOT_ADMIN_MESSAGE = "Bu işlem için yönetici yetkisi gerekli.";

type AdminGuard =
  | { ok: true; adminId: string }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string };

async function requireAdmin(): Promise<AdminGuard> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, status: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE };
  }
  if (session.user.role !== "admin") {
    return { ok: false, status: "FORBIDDEN", message: NOT_ADMIN_MESSAGE };
  }
  return { ok: true, adminId: session.user.id };
}

export type ReportActionResult<T> =
  | { success: true; data: T; message: string }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_FAILED" | "DATABASE_ERROR";
      message: string;
    };

export interface ReportStudentOption {
  id: string;
  name: string;
  studentNumber: string | null;
}

const studentQuerySchema = z
  .string()
  .trim()
  .min(1, "Arama metni zorunludur.")
  .max(50, "Arama metni en fazla 50 karakter olabilir.");

export async function searchStudentsForReport(
  query: string,
): Promise<ReportActionResult<{ students: ReportStudentOption[] }>> {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  const parsedQuery = studentQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsedQuery.error.issues[0]?.message ?? "Geçersiz arama metni.",
    };
  }

  try {
    const pattern = `%${parsedQuery.data}%`;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        studentNumber: users.studentNumber,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "student"),
          or(like(users.name, pattern), like(users.studentNumber, pattern)),
        ),
      )
      .orderBy(asc(users.name))
      .limit(20);

    return {
      success: true,
      data: { students: rows },
      message: "Öğrenciler yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

const reportInputSchema = z.object({
  studentId: z.string().uuid("Geçersiz öğrenci kimliği."),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz başlangıç tarihi."),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz bitiş tarihi."),
  includeDailyDetail: z.boolean().optional().default(false),
  includeNotes: z.boolean().optional().default(false),
});

export type StudentRangeReportInput = z.input<typeof reportInputSchema>;

export interface MockExamNets {
  turkce: number;
  tarih: number;
  cografya: number;
  felsefe: number;
  din: number;
  matematik: number;
  geometri: number;
  fizik: number;
  kimya: number;
  biyoloji: number;
}

export interface MockExamReportRow {
  id: number;
  examName: string;
  examDate: string;
  toplamNet: number;
  tytPuani: number;
  nets: MockExamNets;
  netDiff: number | null;
}

export interface StudentRangeReportData {
  student: { id: string; name: string; studentNumber: string | null };
  range: { from: string; to: string };
  generatedAt: string;
  summary: ReportSummary;
  subjects: ReportSubject[];
  days: ReportDayRow[];
  notes: { date: string; note: string }[];
  mocks: MockExamReportRow[];
}

export async function getStudentRangeReport(
  input: StudentRangeReportInput,
): Promise<ReportActionResult<{ report: StudentRangeReportData }>> {
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message:
        parsed.error.issues[0]?.message ?? "Girdiler geçerli değil.",
    };
  }

  try {
    const access = await assertCanViewStudentReport(
      await auth(),
      parsed.data.studentId,
    );
    if (access.ok === false) {
      return { success: false, status: access.status, message: access.message };
    }

    const range = validateReportRange(parsed.data.from, parsed.data.to);
    if (range.ok === false) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: range.message,
      };
    }

    const studentRows = await db
      .select({
        id: users.id,
        name: users.name,
        studentNumber: users.studentNumber,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, parsed.data.studentId))
      .limit(1);

    if (studentRows.length === 0 || studentRows[0].role !== "student") {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Öğrenci bulunamadı.",
      };
    }

    const dateFilter = and(
      gte(dailyQuestionEntries.date, range.from),
      lte(dailyQuestionEntries.date, range.to),
    );

    const [dailyRows, noteRows, mockRows] = await Promise.all([
      db
        .select({
          topicId: dailyQuestionEntries.topicId,
          date: dailyQuestionEntries.date,
          examType: dailyQuestionEntries.examType,
          subjectId: dailyQuestionEntries.subjectId,
          subjectName: curriculumTopics.subjectName,
          topicName: curriculumTopics.topicName,
          sortOrder: curriculumTopics.sortOrder,
          correct: dailyQuestionEntries.correct,
          wrong: dailyQuestionEntries.wrong,
          blank: dailyQuestionEntries.blank,
        })
        .from(dailyQuestionEntries)
        .innerJoin(
          curriculumTopics,
          eq(curriculumTopics.id, dailyQuestionEntries.topicId),
        )
        .where(
          and(
            eq(dailyQuestionEntries.studentId, parsed.data.studentId),
            dateFilter,
          ),
        )
        .orderBy(asc(dailyQuestionEntries.date)),
      parsed.data.includeNotes
        ? db
            .select({
              date: studentDailyNotes.date,
              note: studentDailyNotes.note,
            })
            .from(studentDailyNotes)
            .where(
              and(
                eq(studentDailyNotes.studentId, parsed.data.studentId),
                gte(studentDailyNotes.date, range.from),
                lte(studentDailyNotes.date, range.to),
              ),
            )
            .orderBy(asc(studentDailyNotes.date))
        : Promise.resolve([]),
      db
        .select({
          id: mockExams.id,
          examName: mockExams.examName,
          examDate: mockExams.examDate,
          toplamNet: mockExams.toplamNet,
          tytPuani: mockExams.tytPuani,
          turkceNet: mockExams.turkceNet,
          tarihNet: mockExams.tarihNet,
          cografyaNet: mockExams.cografyaNet,
          felsefeNet: mockExams.felsefeNet,
          dinNet: mockExams.dinNet,
          matematikNet: mockExams.matematikNet,
          geometriNet: mockExams.geometriNet,
          fizikNet: mockExams.fizikNet,
          kimyaNet: mockExams.kimyaNet,
          biyolojiNet: mockExams.biyolojiNet,
        })
        .from(mockExams)
        .where(
          and(
            eq(mockExams.studentId, parsed.data.studentId),
            gte(mockExams.examDate, range.from),
            lte(mockExams.examDate, range.to),
          ),
        )
        .orderBy(asc(mockExams.examDate), asc(mockExams.id)),
    ]);

    const entryRows: ReportEntryRow[] = dailyRows.map((row) => ({
      topicId: row.topicId,
      date: row.date,
      examType: row.examType,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      topicName: row.topicName,
      sortOrder: row.sortOrder,
      correct: row.correct,
      wrong: row.wrong,
      blank: row.blank,
    }));

    const totalDays = dayCountInclusive(range.from, range.to);

    const summary = buildSummary(entryRows, totalDays);
    const subjects = buildSubjectBreakdown(entryRows);
    const days = parsed.data.includeDailyDetail ? buildDayRows(entryRows) : [];

    const inRangeMocks = filterMocksInRange(
      mockRows,
      range.from,
      range.to,
    );
    const mocksWithDiffs = withMockDiffs(inRangeMocks);
    const mocks: MockExamReportRow[] = mocksWithDiffs.map((row) => ({
      id: row.id,
      examName: row.examName,
      examDate: row.examDate,
      toplamNet: row.toplamNet,
      tytPuani: row.tytPuani,
      netDiff: row.netDiff,
      nets: {
        turkce: row.turkceNet,
        tarih: row.tarihNet,
        cografya: row.cografyaNet,
        felsefe: row.felsefeNet,
        din: row.dinNet,
        matematik: row.matematikNet,
        geometri: row.geometriNet,
        fizik: row.fizikNet,
        kimya: row.kimyaNet,
        biyoloji: row.biyolojiNet,
      },
    }));

    const report: StudentRangeReportData = {
      student: {
        id: studentRows[0].id,
        name: studentRows[0].name,
        studentNumber: studentRows[0].studentNumber,
      },
      range: { from: range.from, to: range.to },
      generatedAt: new Date().toISOString(),
      summary,
      subjects,
      days,
      notes: noteRows.map((row) => ({ date: row.date, note: row.note })),
      mocks,
    };

    await logActivity({
      actorId: access.actorId,
      action: "report_viewed",
      studentId: studentRows[0].id,
    });

    return {
      success: true,
      data: { report },
      message: "Rapor oluşturuldu.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}
