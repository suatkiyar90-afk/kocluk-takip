import bcrypt from "bcryptjs";
import { db } from "./db";
import { teacherStudents, users } from "./db/schema";
import { eq } from "drizzle-orm";

const TEACHER_ID = "11111111-2222-3333-4444-555555555555";
const TEACHER_NAME = "Test Öğretmen";
const STUDENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const STUDENT_NAME = "Test Öğrenci";
const ADMIN_ID = "99999999-8888-7777-6666-555555555555";
const ADMIN_NAME = "Test Yönetici";

const PASSWORD = "test123";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

async function main() {
  await db
    .insert(users)
    .values({
      id: TEACHER_ID,
      name: TEACHER_NAME,
      email: "teacher",
      role: "teacher",
      passwordHash: PASSWORD_HASH,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: TEACHER_NAME,
        email: "teacher",
        role: "teacher",
        passwordHash: PASSWORD_HASH,
      },
    });

  await db
    .insert(users)
    .values({
      id: STUDENT_ID,
      name: STUDENT_NAME,
      email: "student",
      role: "student",
      passwordHash: PASSWORD_HASH,
      weeklyTarget: 0,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: STUDENT_NAME,
        email: "student",
        role: "student",
        passwordHash: PASSWORD_HASH,
      },
    });

  await db
    .insert(users)
    .values({
      id: ADMIN_ID,
      name: ADMIN_NAME,
      email: "admin",
      role: "admin",
      passwordHash: PASSWORD_HASH,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: ADMIN_NAME,
        email: "admin",
        role: "admin",
        passwordHash: PASSWORD_HASH,
      },
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
  const adminRows = await db
    .select()
    .from(users)
    .where(eq(users.id, ADMIN_ID));
  const linkRows = await db
    .select()
    .from(teacherStudents)
    .where(eq(teacherStudents.teacherId, TEACHER_ID));

  console.log("Seed tamamlandı.");
  console.log("Kullanıcılar:", teacherRows.length + studentRows.length + adminRows.length);
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
  console.log(
    "Yönetici:",
    adminRows[0]?.name,
    `(${adminRows[0]?.role})`,
  );
  console.log("Atanmış öğrenci satırı:", linkRows.length);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed hatası:", err);
    process.exit(1);
  });