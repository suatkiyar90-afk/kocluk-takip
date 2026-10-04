import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { teacherStudents, users } from "@/db/schema";

export const REPORT_UNAUTHORIZED_MESSAGE = "Oturum açmanız gerekiyor.";
export const REPORT_ACCESS_DENIED_MESSAGE =
  "Bu öğrencinin raporuna erişim yetkiniz yok.";

export interface ReportSession {
  user?: {
    id?: string;
    role?: string;
  } | null;
}

export type ReportAccessResult =
  | { ok: true; actorId: string; actorRole: "admin" | "teacher" }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string };

export async function assertCanViewStudentReport(
  session: ReportSession | null | undefined,
  studentId: string,
): Promise<ReportAccessResult> {
  const actorId = session?.user?.id;
  if (actorId === undefined || actorId === "") {
    return {
      ok: false,
      status: "UNAUTHORIZED",
      message: REPORT_UNAUTHORIZED_MESSAGE,
    };
  }

  const actorRole = session?.user?.role;
  if (actorRole === "admin") {
    return { ok: true, actorId, actorRole: "admin" };
  }
  if (actorRole !== "teacher") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: REPORT_ACCESS_DENIED_MESSAGE,
    };
  }

  const targetRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (targetRows.length !== 1 || targetRows[0].role !== "student") {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: REPORT_ACCESS_DENIED_MESSAGE,
    };
  }

  const assignedRows = await db
    .select({ studentId: teacherStudents.studentId })
    .from(teacherStudents)
    .where(
      and(
        eq(teacherStudents.teacherId, actorId),
        eq(teacherStudents.studentId, studentId),
      ),
    )
    .limit(1);
  if (assignedRows.length !== 1) {
    return {
      ok: false,
      status: "FORBIDDEN",
      message: REPORT_ACCESS_DENIED_MESSAGE,
    };
  }

  return { ok: true, actorId, actorRole: "teacher" };
}
