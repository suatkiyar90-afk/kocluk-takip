import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  teacherStudentsRows: [] as unknown[],
  denemeRows: [] as unknown[],
  selectFrom: [] as unknown[],
}));

const authState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  const rowsFor = (table: unknown): unknown[] => {
    if (table === schema.teacherStudents) return dbState.teacherStudentsRows;
    if (table === schema.studentDenemeAttempts) return dbState.denemeRows;
    return [];
  };
  const chain = (table: unknown) => {
    const node = {
      where: () => node,
      orderBy: () => node,
      limit: (): Promise<unknown[]> => Promise.resolve(rowsFor(table)),
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
      insert: () => ({
        values: () => Promise.resolve([]),
      }),
      execute: () => Promise.resolve([]),
    },
  };
});

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(authState.session),
}));

import {
  getMyDenemeAttempts,
  getStudentDenemeAttempts,
} from "./quiz-actions";

const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "11111111-1111-4111-8111-111111111111";

function denemeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    studentId: STUDENT_ID,
    date: "2026-10-01",
    denemeKey: "tyt",
    correct: 30,
    wrong: 10,
    blank: 5,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  dbState.teacherStudentsRows = [];
  dbState.denemeRows = [];
  dbState.selectFrom = [];
  authState.session = null;
});

describe("getMyDenemeAttempts", () => {
  it("öğrenci kendi deneme girişlerini D/Y/B ve net alanlarıyla alır", async () => {
    authState.session = {
      user: { id: STUDENT_ID, role: "student", name: "Ayşe Yılmaz" },
    };
    dbState.denemeRows = [denemeRow()];

    const result = await getMyDenemeAttempts();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 7,
        date: "2026-10-01",
        correct: 30,
        wrong: 10,
        blank: 5,
        solved: 45,
        net: 27.5,
        type: "tyt",
      });
      expect(result.data[0].label.length).toBeGreaterThan(0);
    }
  });

  it("öğretmen rolü kendi denemelerini alamaz", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };

    const result = await getMyDenemeAttempts();

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("oturumsuz kullanıcı reddedilir", async () => {
    authState.session = null;

    const result = await getMyDenemeAttempts();

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });
});

describe("getStudentDenemeAttempts", () => {
  it("atanmış öğrenci için öğretmen deneme listesini alır", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };
    dbState.teacherStudentsRows = [{ studentId: STUDENT_ID }];
    dbState.denemeRows = [denemeRow()];

    const result = await getStudentDenemeAttempts(STUDENT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].net).toBe(27.5);
    }
  });

  it("atanmamış öğrenci için FORBIDDEN döner ve deneme sorgusu çalışmaz", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };
    dbState.teacherStudentsRows = [];

    const result = await getStudentDenemeAttempts(STUDENT_ID);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
    }
    expect(dbState.selectFrom).toHaveLength(1);
    expect(dbState.selectFrom[0]).not.toBe(undefined);
  });

  it("öğrenci başka öğrencinin denemelerini alamaz", async () => {
    authState.session = {
      user: { id: STUDENT_ID, role: "student", name: "Ayşe Yılmaz" },
    };

    const result = await getStudentDenemeAttempts(STUDENT_ID);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("oturumsuz kullanıcı reddedilir", async () => {
    authState.session = null;

    const result = await getStudentDenemeAttempts(STUDENT_ID);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });
});
