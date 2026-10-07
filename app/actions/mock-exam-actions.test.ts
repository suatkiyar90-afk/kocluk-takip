import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  usersRows: [] as Record<string, unknown>[],
  mockRows: [] as Record<string, unknown>[],
  deleteReturn: [] as { id: number }[],
  inserts: [] as { table: unknown; values: unknown }[],
  transactions: 0,
}));

const authState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  const rowsFor = (table: unknown): unknown[] => {
    if (table === schema.users) return dbState.usersRows;
    if (table === schema.mockExams) return dbState.mockRows;
    return [];
  };
  const chain = (table: unknown) => {
    const node = {
      where: () => node,
      groupBy: () => node,
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
  const makeTx = () => ({
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        const returning = () => {
          dbState.inserts.push({ table, values });
          const vals = Array.isArray(values) ? values : [values];
          return Promise.resolve(
            vals.map((v) => ({
              studentId: (v as { studentId?: string }).studentId,
            })),
          );
        };
        return {
          onConflictDoUpdate: () => ({ returning }),
          returning,
        };
      },
    }),
    delete: () => ({
      where: () => ({
        returning: (): Promise<{ id: number }[]> =>
          Promise.resolve(dbState.deleteReturn),
      }),
    }),
  });
  return {
    db: {
      select: () => ({
        from: (table: unknown) => chain(table),
      }),
      transaction: async <T,>(fn: (tx: unknown) => Promise<T> | T): Promise<T> => {
        dbState.transactions += 1;
        return await fn(makeTx());
      },
    },
  };
});

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(authState.session),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(async () => undefined),
}));

vi.mock("@/lib/web-push-helper", () => ({
  sendPushNotification: vi.fn(async () => undefined),
}));

import {
  deleteMockExamGroup,
  importMockExams,
  listMockExamGroups,
  previewMockExamImport,
} from "./mock-exam-actions";
import { logActivity } from "@/lib/activity-log";
import { sendPushNotification } from "@/lib/web-push-helper";
import { todayInIstanbul } from "@/lib/week-utils";

const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const TODAY = todayInIstanbul();

function adminSession() {
  return { user: { id: ADMIN_ID, role: "admin" } };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    examName: "TYT 1. Deneme",
    examDate: TODAY,
    rows: [row()],
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    studentNumber: "1042",
    turkceNet: 12.5,
    tytPuani: 300,
    ...overrides,
  };
}

beforeEach(() => {
  dbState.usersRows = [];
  dbState.mockRows = [];
  dbState.deleteReturn = [];
  dbState.inserts = [];
  dbState.transactions = 0;
  authState.session = null;
  vi.mocked(logActivity).mockClear();
  vi.mocked(sendPushNotification).mockClear();
});

describe("importMockExams", () => {
  it("oturum yoksa UNAUTHORIZED döner", async () => {
    const result = await importMockExams(input());
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
  });

  it("öğrenci rolüne FORBIDDEN döner", async () => {
    authState.session = { user: { id: STUDENT_ID, role: "student" } };
    const result = await importMockExams(input());
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
    }
  });

  it("geçersiz girdide VALIDATION_FAILED döner", async () => {
    authState.session = adminSession();
    const result = await importMockExams({ examName: "", rows: [] });
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
    }
  });

  it("gerçek olmayan tarihte VALIDATION_FAILED döner", async () => {
    authState.session = adminSession();
    const result = await importMockExams(input({ examDate: "2026-02-30" }));
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
      expect(result.message).toContain("gerçek bir tarih");
    }
  });

  it("satır doğrulama hatasında kayıt yapmaz", async () => {
    authState.session = adminSession();
    const result = await importMockExams(
      input({ rows: [row({ tytPuani: 90 })] }),
    );
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
      expect(result.message).toContain("satır doğrulama hatası");
      expect(result.message).toContain("90");
    }
    expect(dbState.inserts).toHaveLength(0);
    expect(dbState.transactions).toBe(0);
  });

  it("eşleşen satırları kaydeder, bildirim ve log gönderir", async () => {
    authState.session = adminSession();
    dbState.usersRows = [
      { id: STUDENT_ID, name: "Ayşe Yılmaz", studentNumber: "1042" },
    ];

    const result = await importMockExams(input());
    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.data.total).toBe(1);
      expect(result.data.matched).toBe(1);
      expect(result.data.unmatched).toBe(0);
      expect(result.data.saved[0]?.studentName).toBe("Ayşe Yılmaz");
    }
    expect(dbState.inserts).toHaveLength(1);
    expect(dbState.transactions).toBe(1);
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      action: "mock_exam_uploaded",
    });
  });

  it("eşleşmeyen numaralarda success döner ama kayıt yapmaz", async () => {
    authState.session = adminSession();
    dbState.usersRows = [
      { id: STUDENT_ID, name: "Ayşe Yılmaz", studentNumber: "1042" },
    ];

    const result = await importMockExams(
      input({ rows: [row({ studentNumber: "9999" })] }),
    );
    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.data.matched).toBe(0);
      expect(result.data.unmatched).toBe(1);
      expect(result.data.unmatchedNumbers).toEqual(["9999"]);
    }
    expect(dbState.inserts).toHaveLength(0);
    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      action: "mock_exam_uploaded",
    });
  });
});

describe("previewMockExamImport", () => {
  it("yönetici olmayan erişimi reddeder", async () => {
    authState.session = { user: { id: STUDENT_ID, role: "student" } };
    const result = await previewMockExamImport(input());
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
    }
  });

  it("mevcut ve yeni kayıtları, ad uyuşmazlıklarını raporlar", async () => {
    authState.session = adminSession();
    dbState.usersRows = [
      { id: STUDENT_ID, studentNumber: "1042" },
      { id: "22222222-2222-4222-8222-222222222222", studentNumber: "1043" },
    ];
    dbState.mockRows = [{ studentId: STUDENT_ID, examName: "Eski Deneme" }];

    const result = await previewMockExamImport(
      input({
        examName: "Yeni Deneme",
        rows: [
          row({ studentNumber: "1042" }),
          row({ studentNumber: "1043" }),
          row({ studentNumber: "9999" }),
        ],
      }),
    );
    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.data.total).toBe(3);
      expect(result.data.matched).toBe(2);
      expect(result.data.unmatched).toBe(1);
      expect(result.data.unmatchedNumbers).toEqual(["9999"]);
      expect(result.data.existing).toBe(1);
      expect(result.data.fresh).toBe(1);
      expect(result.data.nameMismatches).toEqual(["Eski Deneme"]);
    }
    expect(dbState.inserts).toHaveLength(0);
  });

  it("geçersiz tarihte VALIDATION_FAILED döner", async () => {
    authState.session = adminSession();
    const result = await previewMockExamImport(input({ examDate: "2026-13-45" }));
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
    }
  });
});

describe("listMockExamGroups", () => {
  it("öğrenci erişimini reddeder", async () => {
    authState.session = { user: { id: STUDENT_ID, role: "student" } };
    const result = await listMockExamGroups();
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("FORBIDDEN");
    }
  });

  it("yöneticiye gruplu listeyi döner", async () => {
    authState.session = adminSession();
    dbState.mockRows = [
      {
        examName: "TYT 1. Deneme",
        examDate: "2026-09-10",
        studentCount: 12,
        lastUploaded: null,
      },
      {
        examName: "TYT 2. Deneme",
        examDate: "2026-09-17",
        studentCount: 11,
        lastUploaded: null,
      },
    ];

    const result = await listMockExamGroups();
    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.examName).toBe("TYT 1. Deneme");
      expect(result.data[1]?.studentCount).toBe(11);
    }
  });
});

describe("deleteMockExamGroup", () => {
  it("geçersiz tarih formatında VALIDATION_FAILED döner", async () => {
    authState.session = adminSession();
    const result = await deleteMockExamGroup({
      examName: "TYT 1. Deneme",
      examDate: "10.09.2026",
    });
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
    }
  });

  it("boş deneme adında VALIDATION_FAILED döner", async () => {
    authState.session = adminSession();
    const result = await deleteMockExamGroup({ examName: "", examDate: TODAY });
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
    }
  });

  it("silinen kayıt sayısıyla success döner ve loglar", async () => {
    authState.session = adminSession();
    dbState.deleteReturn = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const result = await deleteMockExamGroup({
      examName: "TYT 1. Deneme",
      examDate: TODAY,
    });
    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.deleted).toBe(3);
      expect(result.message).toContain("3");
    }
    expect(dbState.transactions).toBe(1);
    expect(logActivity).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      action: "mock_exam_deleted",
    });
  });

  it("hiç kayıt bulunmadığında deleted 0 ve log göndermez", async () => {
    authState.session = adminSession();
    dbState.deleteReturn = [];

    const result = await deleteMockExamGroup({
      examName: "TYT 1. Deneme",
      examDate: TODAY,
    });
    expect(result.success).toBe(true);
    if (result.success === true) {
      expect(result.deleted).toBe(0);
    }
    expect(logActivity).not.toHaveBeenCalled();
  });
});
