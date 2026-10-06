import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  usersRows: [] as unknown[],
  teacherStudentsRows: [] as unknown[],
  dailyRows: [] as unknown[],
  noteRows: [] as unknown[],
  mockRows: [] as unknown[],
  denemeRows: [] as unknown[],
  inserts: [] as { table: unknown; values: unknown }[],
  selectFrom: [] as unknown[],
}));

const authState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  const rowsFor = (table: unknown): unknown[] => {
    if (table === schema.users) return dbState.usersRows;
    if (table === schema.teacherStudents) return dbState.teacherStudentsRows;
    if (table === schema.dailyQuestionEntries) return dbState.dailyRows;
    if (table === schema.studentDailyNotes) return dbState.noteRows;
    if (table === schema.mockExams) return dbState.mockRows;
    if (table === schema.studentDenemeAttempts) return dbState.denemeRows;
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
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          dbState.inserts.push({ table, values });
          return Promise.resolve([]);
        },
      }),
      execute: () => Promise.resolve([]),
    },
  };
});

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(authState.session),
}));

import {
  REPORT_ACCESS_DENIED_MESSAGE,
  REPORT_UNAUTHORIZED_MESSAGE,
} from "@/lib/report-access";
import { todayInIstanbul } from "@/lib/week-utils";
import {
  getStudentRangeReport,
  searchStudentsForReport,
} from "./report-actions";

const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "11111111-1111-4111-8111-111111111111";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const FROM = isoDaysAgo(10);
const TO = isoDaysAgo(3);

function reportInput(overrides: Record<string, unknown> = {}) {
  return {
    studentId: STUDENT_ID,
    from: FROM,
    to: TO,
    includeDailyDetail: false,
    includeNotes: false,
    ...overrides,
  };
}

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STUDENT_ID,
    name: "Ayşe Yılmaz",
    studentNumber: "1042",
    role: "student",
    ...overrides,
  };
}

beforeEach(() => {
  dbState.usersRows = [];
  dbState.teacherStudentsRows = [];
  dbState.dailyRows = [];
  dbState.noteRows = [];
  dbState.mockRows = [];
  dbState.denemeRows = [];
  dbState.inserts = [];
  dbState.selectFrom = [];
  authState.session = null;
});

describe("getStudentRangeReport yetkisi", () => {
  it("admin herhangi bir öğrenci için rapor üretir ve report_viewed kaydı yazar", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin", name: "Admin" } };
    dbState.usersRows = [studentRow()];

    const result = await getStudentRangeReport(reportInput());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.student.id).toBe(STUDENT_ID);
      expect(result.data.report.range.from).toBe(FROM);
      expect(result.data.report.range.to).toBe(TO);
    }
    expect(dbState.inserts).toHaveLength(1);
    expect(dbState.inserts[0].values).toMatchObject({
      actorId: ADMIN_ID,
      action: "report_viewed",
      studentId: STUDENT_ID,
    });
  });

  it("atanmış kendi öğrencisi için öğretmen rapor üretir (öğretmen actor)", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };
    dbState.usersRows = [studentRow()];
    dbState.teacherStudentsRows = [{ studentId: STUDENT_ID }];

    const result = await getStudentRangeReport(
      reportInput({ includeDailyDetail: true }),
    );

    expect(result.success).toBe(true);
    expect(dbState.inserts).toHaveLength(1);
    expect(dbState.inserts[0].values).toMatchObject({
      actorId: TEACHER_ID,
      action: "report_viewed",
      studentId: STUDENT_ID,
    });
  });

  it("atanmamış öğrenci için öğretmeni genel mesajla reddeder, veri ve kayıt dönmez", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };
    dbState.usersRows = [studentRow()];
    dbState.teacherStudentsRows = [];

    const result = await getStudentRangeReport(reportInput());

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
      expect(result.message).toBe(REPORT_ACCESS_DENIED_MESSAGE);
    }
    expect(dbState.inserts).toHaveLength(0);
  });

  it("öğretmen hedefi student değilse genel mesajla reddeder (varlık sızdırmaz)", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };
    dbState.usersRows = [{ role: "teacher" }];

    const result = await getStudentRangeReport(reportInput());

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.message).toBe(REPORT_ACCESS_DENIED_MESSAGE);
    }
  });

  it("öğrenci rolü rapor üretemez", async () => {
    authState.session = {
      user: { id: STUDENT_ID, role: "student", name: "Ayşe Yılmaz" },
    };

    const result = await getStudentRangeReport(reportInput());

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
      expect(result.message).toBe(REPORT_ACCESS_DENIED_MESSAGE);
    }
    expect(dbState.selectFrom).toHaveLength(0);
    expect(dbState.inserts).toHaveLength(0);
  });

  it("oturumsuz kullanıcı reddedilir", async () => {
    authState.session = null;

    const result = await getStudentRangeReport(reportInput());

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
      expect(result.message).toBe(REPORT_UNAUTHORIZED_MESSAGE);
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("rapor öğrenci deneme girişlerini ve özetini de döndürür", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin", name: "Admin" } };
    dbState.usersRows = [studentRow()];
    dbState.denemeRows = [
      {
        id: 7,
        studentId: STUDENT_ID,
        date: isoDaysAgo(5),
        denemeKey: "tyt",
        correct: 30,
        wrong: 10,
        blank: 5,
        createdAt: new Date(),
      },
      {
        id: 8,
        studentId: STUDENT_ID,
        date: isoDaysAgo(4),
        denemeKey: "ayt",
        correct: 20,
        wrong: 6,
        blank: 2,
        createdAt: new Date(),
      },
    ];

    const result = await getStudentRangeReport(reportInput());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.denemeAttempts).toHaveLength(2);
      expect(result.data.report.denemeAttempts[0]).toMatchObject({
        id: 7,
        correct: 30,
        wrong: 10,
        blank: 5,
        solved: 45,
        net: 27.5,
      });
      expect(result.data.report.denemeSummary.count).toBe(2);
      expect(result.data.report.denemeSummary.avgNet).toBeGreaterThan(0);
      expect(result.data.report.denemeSummary.byType).toHaveLength(2);
    }
  });

  it("aralıkta deneme yoksa özet sıfır döner", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin", name: "Admin" } };
    dbState.usersRows = [studentRow()];

    const result = await getStudentRangeReport(reportInput());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.denemeAttempts).toHaveLength(0);
      expect(result.data.report.denemeSummary.count).toBe(0);
      expect(result.data.report.denemeSummary.byType).toHaveLength(0);
    }
  });

  it("öğretmen için bitiş tarihi bugünden ileri olamaz (kısaltılır)", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };
    dbState.usersRows = [studentRow()];
    dbState.teacherStudentsRows = [{ studentId: STUDENT_ID }];

    const futureTo = new Date(Date.now() + 5 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const result = await getStudentRangeReport(
      reportInput({ from: isoDaysAgo(2), to: futureTo }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.range.to).toBe(todayInIstanbul());
      expect(result.data.report.range.to < futureTo).toBe(true);
    }
    expect(dbState.inserts).toHaveLength(1);
  });

  it("öğretmen için 366 gün sınırı aynen geçerlidir", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };
    dbState.usersRows = [studentRow()];
    dbState.teacherStudentsRows = [{ studentId: STUDENT_ID }];

    const result = await getStudentRangeReport(
      reportInput({ from: isoDaysAgo(400), to: isoDaysAgo(1) }),
    );

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
      expect(result.message).toContain("366");
    }
    expect(dbState.inserts).toHaveLength(0);
  });
});

describe("searchStudentsForReport", () => {
  it("admin öğrenci araması yapabilir", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin", name: "Admin" } };
    dbState.usersRows = [
      { id: STUDENT_ID, name: "Ayşe Yılmaz", studentNumber: "1042" },
    ];

    const result = await searchStudentsForReport("Ayşe");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.students).toHaveLength(1);
    }
  });

  it("öğretmen arama uç noktasını kullanamaz (admin-only)", async () => {
    authState.session = {
      user: { id: TEACHER_ID, role: "teacher", name: "Öğretmen" },
    };

    const result = await searchStudentsForReport("Ayşe");

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
    }
    expect(dbState.selectFrom).toHaveLength(0);
  });

  it("oturumsuz arama reddedilir", async () => {
    authState.session = null;

    const result = await searchStudentsForReport("Ayşe");

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
  });
});
