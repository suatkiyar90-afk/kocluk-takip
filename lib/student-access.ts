import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { teacherStudents, users } from "@/db/schema";

export type StaffRole = "admin" | "teacher";

export interface StaffActor {
  teacherId: string;
  role: StaffRole;
}

/**
 * Öğretmenin öğrenciye danışman olarak atanmış olup olmadığını kontrol eder.
 */
export async function isStudentAssignedToTeacher(
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

/**
 * Öğretmen/admin personelinin bir öğrencinin koçluk ekranına erişip
 * erişemeyeceğini belirler. Admin, atama aranmaksızın tüm öğrencilere
 * erişebilir; öğretmen yalnızca danışmanı olduğu öğrencilere erişebilir.
 */
export async function canStaffAccessStudent(
  actor: StaffActor,
  studentId: string,
): Promise<boolean> {
  if (actor.role === "admin") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, "student")))
      .limit(1);
    return rows.length === 1;
  }
  return isStudentAssignedToTeacher(actor.teacherId, studentId);
}
