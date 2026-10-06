import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  rows: [] as unknown[],
  selectFrom: [] as unknown[],
  failQuery: false,
}));

const authState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/db", () => {
  const node = {
    leftJoin: () => node,
    innerJoin: () => node,
    where: () => node,
    orderBy: () => node,
    groupBy: () => node,
    limit: (): Promise<unknown[]> =>
      dbState.failQuery
        ? Promise.reject(new Error("db down"))
        : Promise.resolve(dbState.rows),
    then: (
      onfulfilled: (value: unknown[]) => unknown,
      onrejected: (reason: unknown) => unknown,
    ): Promise<unknown[]> =>
      (
        dbState.failQuery
          ? Promise.reject(new Error("db down"))
          : Promise.resolve(dbState.rows)
      ).then(onfulfilled, onrejected) as unknown as Promise<unknown[]>,
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          dbState.selectFrom.push(table);
          return node;
        },
      }),
      selectDistinctOn: () => ({
        from: (table: unknown) => {
          dbState.selectFrom.push(table);
          return node;
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
  adminListUsers,
  getPolicyAcknowledgmentOverview,
} from "./admin-actions";

const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT2_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  dbState.rows = [];
  dbState.selectFrom = [];
  dbState.failQuery = false;
  authState.session = null;
});

describe("getPolicyAcknowledgmentOverview yetkisi", () => {
  it("öğretmen bu veriye erişemez ve sorgu çalışmaz", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Zeynep Öğretmen" },
    };

    const result = await getPolicyAcknowledgmentOverview();

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
      expect(result.message).toBe("Bu işlem için yönetici yetkisi gerekli.");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("öğrenci bu veriye erişemez ve sorgu çalışmaz", async () => {
    authState.session = {
      user: { id: STUDENT_ID, role: "student", name: "Ayşe Yılmaz" },
    };

    const result = await getPolicyAcknowledgmentOverview();

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("oturumsuz kullanıcı reddedilir", async () => {
    authState.session = null;

    const result = await getPolicyAcknowledgmentOverview();

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
      expect(result.message).toBe("Oturum açmanız gerekiyor.");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("admin tek sorguyla rol bazlı özeti döner, admin satırı sayımlara girmez", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin", name: "Admin" } };
    dbState.rows = [
      {
        id: STUDENT_ID,
        name: "Ayşe Yılmaz",
        role: "student",
        studentNumber: "1042",
        lastSeenAt: new Date("2026-10-05T12:00:00Z"),
        lastLoginAt: new Date("2026-10-05T08:00:00Z"),
        assignedTeacherName: "Zeynep Öğretmen",
        studentAckAt: new Date("2026-10-05T09:30:00Z"),
        teacherAckAt: null,
      },
      {
        id: STUDENT2_ID,
        name: "Ali Veli",
        role: "student",
        studentNumber: "1043",
        lastSeenAt: null,
        lastLoginAt: null,
        assignedTeacherName: null,
        studentAckAt: null,
        teacherAckAt: null,
      },
      {
        id: TEACHER_ID,
        name: "Zeynep Öğretmen",
        role: "teacher",
        studentNumber: null,
        lastSeenAt: new Date("2026-10-05T10:00:00Z"),
        lastLoginAt: new Date("2026-10-05T11:00:00Z"),
        assignedTeacherName: null,
        studentAckAt: null,
        teacherAckAt: null,
      },
      {
        id: ADMIN_ID,
        name: "Yönetici",
        role: "admin",
        studentNumber: null,
        lastSeenAt: null,
        lastLoginAt: null,
        assignedTeacherName: null,
        studentAckAt: null,
        teacherAckAt: null,
      },
    ];

    const result = await getPolicyAcknowledgmentOverview();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.students).toEqual({
        total: 2,
        acknowledged: 1,
        notAcknowledged: 1,
      });
      expect(result.data.teachers).toEqual({
        total: 1,
        acknowledged: 0,
        notAcknowledged: 1,
      });
      expect(result.data.notAcknowledged.map((p) => p.name)).toEqual([
        "Ali Veli",
        "Zeynep Öğretmen",
      ]);
      expect(result.data.acknowledged).toHaveLength(1);
      expect(result.data.acknowledged[0]).toMatchObject({
        id: STUDENT_ID,
        name: "Ayşe Yılmaz",
        assignedTeacher: "Zeynep Öğretmen",
        acknowledgedAt: "2026-10-05T09:30:00.000Z",
        lastSeenAt: "2026-10-05T12:00:00.000Z",
      });
      expect(result.data.studentVersion).toBe("2026-10-05");
      expect(result.data.teacherVersion).toBe("2026-10-05");
    }
    expect(dbState.selectFrom).toHaveLength(1);
  });

  it("veritabanı hatasında DATABASE_ERROR döner", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin", name: "Admin" } };
    dbState.failQuery = true;

    const result = await getPolicyAcknowledgmentOverview();

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("DATABASE_ERROR");
    }
  });
});

describe("adminListUsers KVKK onay rozeti", () => {
  it("öğretmen ve öğrenciler için güncel sürüm onay rozetini döner", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin", name: "Admin" } };
    dbState.rows = [
      {
        id: TEACHER_ID,
        name: "Zeynep Öğretmen",
        email: "zeynep@kocluk.local",
        role: "teacher",
        studentNumber: null,
        studentAckAt: null,
        teacherAckAt: new Date("2026-10-05T09:00:00Z"),
      },
      {
        id: STUDENT_ID,
        name: "Ayşe Yılmaz",
        email: "ayse@kocluk.local",
        role: "student",
        studentNumber: "1042",
        studentAckAt: new Date("2026-10-05T09:30:00Z"),
        teacherAckAt: null,
      },
      {
        id: STUDENT2_ID,
        name: "Ali Veli",
        email: "ali@kocluk.local",
        role: "student",
        studentNumber: "1043",
        studentAckAt: null,
        teacherAckAt: null,
      },
    ];

    const result = await adminListUsers();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teachers).toHaveLength(1);
      expect(result.data.teachers[0].policyAcknowledged).toBe(true);
      const ayse = result.data.students.find((s) => s.id === STUDENT_ID);
      const ali = result.data.students.find((s) => s.id === STUDENT2_ID);
      expect(ayse?.policyAcknowledged).toBe(true);
      expect(ali?.policyAcknowledged).toBe(false);
    }
  });

  it("admin olmayan adminListUsers çağıramaz", async () => {
    authState.session = {
      user: { id: STUDENT_ID, role: "student", name: "Ayşe Yılmaz" },
    };

    const result = await adminListUsers();

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });
});
