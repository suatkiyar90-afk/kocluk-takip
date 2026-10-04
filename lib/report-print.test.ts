import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  usersRows: [] as unknown[],
  teacherStudentsRows: [] as unknown[],
  dailyRows: [] as unknown[],
  noteRows: [] as unknown[],
  mockRows: [] as unknown[],
  inserts: [] as { table: unknown; values: unknown }[],
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
        from: (table: unknown) => chain(table),
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

import { addDaysISO, todayInIstanbul } from "@/lib/week-utils";
import {
  loadPrintReport,
  parsePrintReportParams,
  resolvePrintTitle,
} from "@/lib/report-print";
import { reportFileName } from "@/lib/report-utils";

const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "11111111-1111-4111-8111-111111111111";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const FROM = isoDaysAgo(10);
const TO = isoDaysAgo(3);

function rawParams(
  overrides: Record<string, string | string[] | undefined> = {},
) {
  return {
    student: STUDENT_ID,
    from: FROM,
    to: TO,
    detail: "0",
    notes: "0",
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
  dbState.inserts = [];
  authState.session = null;
});

describe("parsePrintReportParams", () => {
  it("geçerli parametreleri çözer ve bayrakları boolean'a çevirir", () => {
    const result = parsePrintReportParams(rawParams({ detail: "1", notes: "1" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params).toEqual({
        studentId: STUDENT_ID,
        from: FROM,
        to: TO,
        detail: true,
        notes: true,
      });
    }
  });

  it("dizi olarak gelen parametrenin ilk değerini kullanır", () => {
    const result = parsePrintReportParams(
      rawParams({ from: [FROM, isoDaysAgo(1)] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params.from).toBe(FROM);
    }
  });

  it("eksik student parametresini PARAMS hatasıyla reddeder", () => {
    const raw = rawParams();
    delete raw.student;
    expect(parsePrintReportParams(raw)).toEqual({
      ok: false,
      error: "PARAMS",
    });
  });

  it("geçersiz öğrenci kimliğini PARAMS hatasıyla reddeder", () => {
    expect(
      parsePrintReportParams(rawParams({ student: "not-a-uuid" })),
    ).toEqual({ ok: false, error: "PARAMS" });
  });

  it("geçersiz tarih biçimini PARAMS hatasıyla reddeder", () => {
    expect(
      parsePrintReportParams(rawParams({ from: "01.10.2026" })),
    ).toEqual({ ok: false, error: "PARAMS" });
  });

  it("bitiş başlangıçtan önceyse RANGE hatasıyla reddeder", () => {
    expect(
      parsePrintReportParams(rawParams({ from: TO, to: FROM })),
    ).toEqual({ ok: false, error: "RANGE" });
  });

  it("366 günlük aralığı kabul eder", () => {
    const today = todayInIstanbul();
    const result = parsePrintReportParams(
      rawParams({ from: addDaysISO(today, -365), to: today }),
    );
    expect(result.ok).toBe(true);
  });

  it("366 günden uzun aralığı RANGE hatasıyla reddeder", () => {
    const today = todayInIstanbul();
    const result = parsePrintReportParams(
      rawParams({ from: addDaysISO(today, -366), to: today }),
    );
    expect(result).toEqual({ ok: false, error: "RANGE" });
  });

  it("ileri tarihli bitişi bugüne kısaltır", () => {
    const today = todayInIstanbul();
    const future = addDaysISO(today, 5);
    const result = parsePrintReportParams(rawParams({ to: future }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params.to).toBe(today);
    }
  });
});

describe("reportFileName", () => {
  it("Türkçe karakter, boşluk ve özel karakterleri temizler", () => {
    expect(reportFileName("A/B 12-ç", FROM, TO)).toBe(
      `rapor_AB12_${FROM}_${TO}`,
    );
  });

  it("boş numara için yedek ad kullanır", () => {
    expect(reportFileName(null, FROM, TO)).toBe(`rapor_ogrenci_${FROM}_${TO}`);
  });
});

describe("loadPrintReport yetki matrisi", () => {
  it("admin her öğrenci için rapor yükler", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin" } };
    dbState.usersRows = [studentRow()];

    const result = await loadPrintReport(rawParams());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.student.id).toBe(STUDENT_ID);
      expect(result.report.range.from).toBe(FROM);
      expect(result.report.range.to).toBe(TO);
    }
  });

  it("atanmış öğretmen rapor yükler", async () => {
    authState.session = { user: { id: TEACHER_ID, role: "teacher" } };
    dbState.usersRows = [studentRow()];
    dbState.teacherStudentsRows = [
      { teacherId: TEACHER_ID, studentId: STUDENT_ID },
    ];

    const result = await loadPrintReport(rawParams());

    expect(result.ok).toBe(true);
  });

  it("atanmamış öğretmen ACCESS hatası alır", async () => {
    authState.session = { user: { id: TEACHER_ID, role: "teacher" } };
    dbState.usersRows = [studentRow()];
    dbState.teacherStudentsRows = [];

    const result = await loadPrintReport(rawParams());

    expect(result).toEqual({ ok: false, error: "ACCESS" });
  });

  it("öğrenci rolü ACCESS hatası alır", async () => {
    authState.session = { user: { id: STUDENT_ID, role: "student" } };
    dbState.usersRows = [studentRow()];

    const result = await loadPrintReport(rawParams());

    expect(result).toEqual({ ok: false, error: "ACCESS" });
  });

  it("oturumsuz erişim ACCESS hatası alır", async () => {
    authState.session = null;

    const result = await loadPrintReport(rawParams());

    expect(result).toEqual({ ok: false, error: "ACCESS" });
  });

  it("geçersiz parametrede veritabanına dokunmadan PARAMS hatası verir", async () => {
    const raw = rawParams();
    delete raw.student;

    const result = await loadPrintReport(raw);

    expect(result).toEqual({ ok: false, error: "PARAMS" });
    expect(dbState.inserts).toHaveLength(0);
  });

  it("geçersiz tarih aralığında RANGE hatası verir", async () => {
    const result = await loadPrintReport(rawParams({ from: TO, to: FROM }));

    expect(result).toEqual({ ok: false, error: "RANGE" });
  });
});

describe("resolvePrintTitle", () => {
  it("admin için öğrenci numaralı başlık üretir", async () => {
    authState.session = { user: { id: ADMIN_ID, role: "admin" } };
    dbState.usersRows = [studentRow()];

    await expect(resolvePrintTitle(rawParams())).resolves.toBe(
      reportFileName("1042", FROM, TO),
    );
  });

  it("atanmamış öğretmen için numara sızdırmaz", async () => {
    authState.session = { user: { id: TEACHER_ID, role: "teacher" } };
    dbState.usersRows = [studentRow()];
    dbState.teacherStudentsRows = [];

    await expect(resolvePrintTitle(rawParams())).resolves.toBe("rapor");
  });

  it("geçersiz parametrede genel başlık döner", async () => {
    await expect(
      resolvePrintTitle(rawParams({ from: "bozuk" })),
    ).resolves.toBe("rapor");
  });
});
