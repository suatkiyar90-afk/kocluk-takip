import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import {
  getStudentRangeReport,
  type StudentRangeReportData,
} from "@/app/actions/report-actions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { assertCanViewStudentReport } from "@/lib/report-access";
import { reportFileName, validateReportRange } from "@/lib/report-utils";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih formatı.");

const flagSchema = z.enum(["0", "1"]).optional().default("0");

export const printReportParamsSchema = z.object({
  student: z.string().uuid("Geçersiz öğrenci kimliği."),
  from: isoDateSchema,
  to: isoDateSchema,
  detail: flagSchema,
  notes: flagSchema,
});

export interface PrintReportParams {
  studentId: string;
  from: string;
  to: string;
  detail: boolean;
  notes: boolean;
}

export type PrintReportParamsResult =
  | { ok: true; params: PrintReportParams }
  | { ok: false; error: "PARAMS" | "RANGE" };

export function firstSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parsePrintReportParams(
  raw: Record<string, string | string[] | undefined>,
): PrintReportParamsResult {
  const parsed = printReportParamsSchema.safeParse({
    student: firstSearchValue(raw.student),
    from: firstSearchValue(raw.from),
    to: firstSearchValue(raw.to),
    detail: firstSearchValue(raw.detail),
    notes: firstSearchValue(raw.notes),
  });
  if (!parsed.success) {
    return { ok: false, error: "PARAMS" };
  }

  const range = validateReportRange(parsed.data.from, parsed.data.to);
  if (range.ok === false) {
    return { ok: false, error: "RANGE" };
  }

  return {
    ok: true,
    params: {
      studentId: parsed.data.student,
      from: range.from,
      to: range.to,
      detail: parsed.data.detail === "1",
      notes: parsed.data.notes === "1",
    },
  };
}

export type PrintReportErrorCode = "PARAMS" | "RANGE" | "ACCESS" | "DATA";

export type PrintReportLoadResult =
  | { ok: true; report: StudentRangeReportData }
  | { ok: false; error: PrintReportErrorCode };

export async function loadPrintReport(
  raw: Record<string, string | string[] | undefined>,
): Promise<PrintReportLoadResult> {
  const parsed = parsePrintReportParams(raw);
  if (parsed.ok === false) {
    return parsed;
  }

  const result = await getStudentRangeReport({
    studentId: parsed.params.studentId,
    from: parsed.params.from,
    to: parsed.params.to,
    includeDailyDetail: parsed.params.detail,
    includeNotes: parsed.params.notes,
  });

  if (result.success === false) {
    if (result.status === "UNAUTHORIZED" || result.status === "FORBIDDEN") {
      return { ok: false, error: "ACCESS" };
    }
    if (result.status === "VALIDATION_FAILED") {
      return { ok: false, error: "RANGE" };
    }
    return { ok: false, error: "DATA" };
  }

  return { ok: true, report: result.data.report };
}

export async function resolvePrintTitle(
  raw: Record<string, string | string[] | undefined>,
): Promise<string> {
  const parsed = parsePrintReportParams(raw);
  if (parsed.ok === false) {
    return "rapor";
  }

  const access = await assertCanViewStudentReport(
    await auth(),
    parsed.params.studentId,
  );
  if (access.ok === false) {
    return "rapor";
  }

  try {
    const rows = await db
      .select({ studentNumber: users.studentNumber })
      .from(users)
      .where(
        and(eq(users.id, parsed.params.studentId), eq(users.role, "student")),
      )
      .limit(1);
    if (rows.length !== 1) {
      return "rapor";
    }
    return reportFileName(
      rows[0].studentNumber,
      parsed.params.from,
      parsed.params.to,
    );
  } catch {
    return "rapor";
  }
}
