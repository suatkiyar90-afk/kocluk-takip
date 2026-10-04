import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  usersRows: [] as unknown[],
  teacherStudentsRows: [] as unknown[],
  selectFrom: [] as unknown[],
}));

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  const rowsFor = (table: unknown): unknown[] => {
    if (table === schema.users) return dbState.usersRows;
    if (table === schema.teacherStudents) return dbState.teacherStudentsRows;
    return [];
  };
  const chain = (table: unknown) => {
    const node = {
      where: () => node,
      innerJoin: () => node,
      orderBy: () => node,
      limit: (): Promise<unknown[]> => Promise.resolve(rowsFor(table)),
      groupBy: (): Promise<unknown[]> => Promise.resolve(rowsFor(table)),
      then: (
        onfulfilled: (value: unknown[]) => unknown,
        onrejected: (reason: unknown) => unknown,
      ): Promise<unknown[]> =>
        Promise.resolve(rowsFor(table)).then(
          onfulfilled,
          onrejected,
        ) as unknown as Promise<unknown[]>,
    };
    return node;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          dbState.selectFrom.push(table);
          return chain(table);
        },
      }),
      insert: () => ({ values: () => Promise.resolve([]) }),
      execute: () => Promise.resolve([]),
    },
  };
});

import {
  REPORT_ACCESS_DENIED_MESSAGE,
  REPORT_UNAUTHORIZED_MESSAGE,
  assertCanViewStudentReport,
} from "./report-access";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";

function resetDbState() {
  dbState.usersRows = [];
  dbState.teacherStudentsRows = [];
  dbState.selectFrom = [];
}

beforeEach(() => {
  resetDbState();
});

describe("assertCanViewStudentReport", () => {
  it("oturumsuz kullanıcıyı UNAUTHORIZED ile reddeder", async () => {
    const result = await assertCanViewStudentReport(null, STUDENT_ID);
    expect(result).toEqual({
      ok: false,
      status: "UNAUTHORIZED",
      message: REPORT_UNAUTHORIZED_MESSAGE,
    });
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("kullanıcısı olmayan oturumu reddeder", async () => {
    const result = await assertCanViewStudentReport(
      { user: { id: "", role: "admin" } },
      STUDENT_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("öğrenci rolünü genel mesajla reddeder ve sorgu yapmaz", async () => {
    const result = await assertCanViewStudentReport(
      { user: { id: STUDENT_ID, role: "student" } },
      STUDENT_ID,
    );
    expect(result).toEqual({
      ok: false,
      status: "FORBIDDEN",
      message: REPORT_ACCESS_DENIED_MESSAGE,
    });
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("admin herhangi bir öğrenci için başarılıdır", async () => {
    const result = await assertCanViewStudentReport(
      { user: { id: "33333333-3333-4333-8333-333333333333", role: "admin" } },
      STUDENT_ID,
    );
    expect(result).toEqual({
      ok: true,
      actorId: "33333333-3333-4333-8333-333333333333",
      actorRole: "admin",
    });
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("atanmış öğrenci için öğretmeni başarılıdır", async () => {
    dbState.usersRows = [{ role: "student" }];
    dbState.teacherStudentsRows = [{ studentId: STUDENT_ID }];
    const result = await assertCanViewStudentReport(
      { user: { id: TEACHER_ID, role: "teacher" } },
      STUDENT_ID,
    );
    expect(result).toEqual({
      ok: true,
      actorId: TEACHER_ID,
      actorRole: "teacher",
    });
    expect(dbState.selectFrom).toHaveLength(2);
  });

  it("atanmamış öğrenci için öğretmeni genel mesajla reddeder", async () => {
    dbState.usersRows = [{ role: "student" }];
    dbState.teacherStudentsRows = [];
    const result = await assertCanViewStudentReport(
      { user: { id: TEACHER_ID, role: "teacher" } },
      STUDENT_ID,
    );
    expect(result).toEqual({
      ok: false,
      status: "FORBIDDEN",
      message: REPORT_ACCESS_DENIED_MESSAGE,
    });
  });

  it("var olmayan öğrenci ile atanmamış aynı genel mesajı verir (sızdırmaz)", async () => {
    dbState.usersRows = [];
    const missing = await assertCanViewStudentReport(
      { user: { id: TEACHER_ID, role: "teacher" } },
      STUDENT_ID,
    );
    dbState.teacherStudentsRows = [];
    dbState.usersRows = [{ role: "student" }];
    const unassigned = await assertCanViewStudentReport(
      { user: { id: TEACHER_ID, role: "teacher" } },
      "44444444-4444-4444-8444-444444444444",
    );
    expect(missing.ok).toBe(false);
    expect(unassigned.ok).toBe(false);
    if (missing.ok === false && unassigned.ok === false) {
      expect(missing.message).toBe(unassigned.message);
      expect(missing.message).toBe(REPORT_ACCESS_DENIED_MESSAGE);
    }
  });

  it("öğrenci rolünde olmayan hedefi öğretmenin erişimine kapatır", async () => {
    dbState.usersRows = [{ role: "teacher" }];
    const result = await assertCanViewStudentReport(
      { user: { id: TEACHER_ID, role: "teacher" } },
      STUDENT_ID,
    );
    expect(result).toEqual({
      ok: false,
      status: "FORBIDDEN",
      message: REPORT_ACCESS_DENIED_MESSAGE,
    });
    expect(dbState.selectFrom).toHaveLength(1);
  });
});
