import { db } from "./db";
import { teacherStudents, users } from "./db/schema";
import { eq } from "drizzle-orm";

const TEACHER_ID = "11111111-2222-3333-4444-555555555555";
const TEACHER_NAME = "Test Öğretmen";
const STUDENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const STUDENT_NAME = "Test Öğrenci";

async function main() {
  await db
    .insert(users)
    .values({ id: TEACHER_ID, name: TEACHER_NAME, role: "teacher" })
    .onConflictDoUpdate({
      target: users.id,
      set: { name: TEACHER_NAME, role: "teacher" },
    });

  await db
    .insert(users)
    .values({ id: STUDENT_ID, name: STUDENT_NAME, role: "student" })
    .onConflictDoUpdate({
      target: users.id,
      set: { name: STUDENT_NAME, role: "student" },
    });

  await db
    .insert(teacherStudents)
    .values({ teacherId: TEACHER_ID, studentId: STUDENT_ID })
    .onConflictDoNothing();

  const teacherRows = await db
    .select()
    .from(users)
    .where(eq(users.id, TEACHER_ID));
  const studentRows = await db
    .select()
    .from(users)
    .where(eq(users.id, STUDENT_ID));
  const linkRows = await db
    .select()
    .from(teacherStudents)
    .where(eq(teacherStudents.teacherId, TEACHER_ID));

  console.log("Seed tamamlandı.");
  console.log("Kullanıcılar:", teacherRows.length + studentRows.length);
  console.log(
    "Öğretmen:",
    teacherRows[0]?.name,
    `(${teacherRows[0]?.role})`,
  );
  console.log(
    "Öğrenci:",
    studentRows[0]?.name,
    `(${studentRows[0]?.role})`,
  );
  console.log("Atanmış öğrenci satırı:", linkRows.length);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed hatası:", err);
    process.exit(1);
  });