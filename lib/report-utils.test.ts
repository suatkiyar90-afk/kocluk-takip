import { describe, expect, it } from "vitest";
import {
  MAX_REPORT_DAYS,
  buildDayRows,
  buildSubjectBreakdown,
  buildSummary,
  dayCountInclusive,
  excelFileName,
  excelSafeCell,
  filterMocksInRange,
  quickReportRange,
  successRate,
  validateReportRange,
  withMockDiffs,
  type ReportEntryRow,
} from "./report-utils";

function row(overrides: Partial<ReportEntryRow> = {}): ReportEntryRow {
  return {
    topicId: 1,
    date: "2026-10-01",
    examType: "TYT",
    subjectId: "mat",
    subjectName: "Matematik",
    topicName: "Problemler",
    sortOrder: 1,
    correct: 0,
    wrong: 0,
    blank: 0,
    ...overrides,
  };
}

describe("validateReportRange", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("geçerli aralığı kabul eder", () => {
    const result = validateReportRange("2026-10-01", "2026-10-05", now);
    expect(result).toEqual({ ok: true, from: "2026-10-01", to: "2026-10-05" });
  });

  it("bitiş gününü İstanbul gününe göre bugünden ileri kısaltır", () => {
    const lateNight = new Date("2026-10-05T22:30:00.000Z");
    const result = validateReportRange("2026-10-01", "2026-10-09", lateNight);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.to).toBe("2026-10-06");
    }
  });

  it("bitiş başlangıçtan önceyse hata verir", () => {
    const result = validateReportRange("2026-10-05", "2026-10-01", now);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toBe("Bitiş tarihi başlangıçtan önce olamaz.");
    }
  });

  it("geçersiz formatı reddeder", () => {
    const result = validateReportRange("01.10.2026", "2026-10-05", now);
    expect(result.ok).toBe(false);
  });

  it("366 gün sınırını uygular", () => {
    const exact = validateReportRange("2025-01-01", "2026-01-01", now);
    expect(exact.ok).toBe(true);
    const over = validateReportRange("2025-01-01", "2026-01-02", now);
    expect(over.ok).toBe(false);
    if (over.ok === false) {
      expect(over.message).toContain(String(MAX_REPORT_DAYS));
    }
  });

  it("366 günlük sınır tam sayılık gününü de kapsar", () => {
    expect(dayCountInclusive("2025-01-01", "2025-12-31")).toBe(365);
    expect(dayCountInclusive("2025-01-01", "2026-01-01")).toBe(366);
    expect(
      validateReportRange("2025-01-01", "2026-01-01", now).ok,
    ).toBe(true);
  });
});

describe("quickReportRange", () => {
  it("bu hafta Pazartesi başlar ve bugünü geçmez", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const range = quickReportRange("this-week", now);
    expect(range.from).toBe("2026-10-05");
    expect(range.to).toBe("2026-10-07");
  });

  it("geçen hafta tam 7 gün Pazartesi-Pazar", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const range = quickReportRange("last-week", now);
    expect(range.from).toBe("2026-09-28");
    expect(range.to).toBe("2026-10-04");
    expect(dayCountInclusive(range.from, range.to)).toBe(7);
  });

  it("son 7 gün bugünle biter", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const range = quickReportRange("last-7", now);
    expect(range.from).toBe("2026-10-01");
    expect(range.to).toBe("2026-10-07");
  });

  it("geçen ay ay geçişini ve artık yılı doğru hesaplar", () => {
    const newYear = quickReportRange("last-month", new Date("2026-01-05T12:00:00.000Z"));
    expect(newYear).toEqual({ from: "2025-12-01", to: "2025-12-31" });

    const march = quickReportRange("last-month", new Date("2026-03-10T12:00:00.000Z"));
    expect(march).toEqual({ from: "2026-02-01", to: "2026-02-28" });

    const leap = quickReportRange("last-month", new Date("2024-03-01T12:00:00.000Z"));
    expect(leap).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("bu ay başı ayın biri, sonu bugünü geçmez", () => {
    const now = new Date("2026-10-15T12:00:00.000Z");
    const range = quickReportRange("this-month", now);
    expect(range).toEqual({ from: "2026-10-01", to: "2026-10-15" });

    const monthEnd = quickReportRange(
      "this-month",
      new Date("2026-10-31T12:00:00.000Z"),
    );
    expect(monthEnd).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("hafta başı Pazartesi olur (Pazar günü seçili)", () => {
    const range = quickReportRange("this-week", new Date("2026-10-04T12:00:00.000Z"));
    expect(range.from).toBe("2026-09-28");
    expect(range.to).toBe("2026-10-04");
  });
});

describe("buildSubjectBreakdown", () => {
  it("boş veri için boş döner", () => {
    expect(buildSubjectBreakdown([])).toEqual([]);
  });

  it("tek konuyu toplar ve net/başarı hesaplar", () => {
    const result = buildSubjectBreakdown([
      row({ correct: 8, wrong: 2, blank: 0 }),
      row({ date: "2026-10-02", correct: 1, wrong: 2, blank: 1 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].solved).toBe(14);
    expect(result[0].correct).toBe(9);
    expect(result[0].wrong).toBe(4);
    expect(result[0].blank).toBe(1);
    expect(result[0].net).toBe(8);
    expect(result[0].rate).toBe(64.3);
    expect(result[0].topics).toHaveLength(1);
    expect(result[0].topics[0].solved).toBe(14);
  });

  it("sınav türü ve müfredat sırasına göre dersleri, konuları çözene göre azalan sıralar", () => {
    const result = buildSubjectBreakdown([
      row({
        topicId: 10,
        examType: "YDT",
        subjectId: "ing",
        subjectName: "İngilizce",
        topicName: "Kelime",
        sortOrder: 1,
        correct: 5,
      }),
      row({
        topicId: 11,
        examType: "AYT",
        subjectId: "fiz",
        subjectName: "Fizik",
        topicName: "Dinamik",
        sortOrder: 3,
        correct: 2,
      }),
      row({
        topicId: 1,
        examType: "TYT",
        subjectId: "mat",
        subjectName: "Matematik",
        topicName: "Problemler",
        sortOrder: 1,
        correct: 10,
      }),
      row({
        topicId: 2,
        examType: "TYT",
        subjectId: "mat",
        subjectName: "Matematik",
        topicName: "Proportional",
        sortOrder: 2,
        correct: 3,
        wrong: 1,
      }),
      row({
        topicId: 3,
        examType: "TYT",
        subjectId: "mat",
        subjectName: "Matematik",
        topicName: "Rasyonel",
        sortOrder: 3,
        correct: 20,
      }),
    ]);

    expect(
      result.map((subject) => subject.subjectName),
    ).toEqual(["Matematik", "Fizik", "İngilizce"]);

    const mathTopics = result[0].topics;
    expect(mathTopics.map((topic) => topic.topicName)).toEqual([
      "Rasyonel",
      "Problemler",
      "Proportional",
    ]);
  });
});

describe("successRate", () => {
  it("0 soruda yüzde 0 döner", () => {
    expect(successRate(0, 0, 0)).toBe(0);
  });

  it("başarı oranını doğru hesaplar", () => {
    expect(successRate(8, 2, 0)).toBe(80);
    expect(successRate(1, 0, 3)).toBe(25);
  });
});

describe("buildSummary ve buildDayRows", () => {
  it("boş veride gün ve ortalama sıfırdır", () => {
    const summary = buildSummary([], 30);
    expect(summary.totalSolved).toBe(0);
    expect(summary.daysWithData).toBe(0);
    expect(summary.avgPerActiveDay).toBe(0);
    expect(summary.rate).toBe(0);
    expect(summary.bestDay).toBeNull();
    expect(summary.totalDays).toBe(30);
    expect(buildDayRows([])).toEqual([]);
  });

  it("gün gün toplamlar ve konu sayısını verir", () => {
    const days = buildDayRows([
      row({ date: "2026-10-02", topicId: 1, correct: 3, wrong: 1 }),
      row({ date: "2026-10-01", topicId: 2, correct: 4 }),
      row({ date: "2026-10-01", topicId: 1, correct: 2, blank: 1 }),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe("2026-10-01");
    expect(days[0].topicCount).toBe(2);
    expect(days[0].solved).toBe(7);
    expect(days[1].topicCount).toBe(1);
    expect(days[1].solved).toBe(4);
    expect(days[1].net).toBe(2.75);
  });

  it("en çok soru çözülen günü ve ortalamayı bulur", () => {
    const summary = buildSummary(
      [
        row({ date: "2026-10-01", correct: 4 }),
        row({ date: "2026-10-02", topicId: 2, correct: 10 }),
      ],
      10,
    );
    expect(summary.daysWithData).toBe(2);
    expect(summary.avgPerActiveDay).toBe(7);
    expect(summary.bestDay).toEqual({ date: "2026-10-02", solved: 10 });
    expect(summary.net).toBe(14);
  });
});

describe("deneme filtresi ve fark", () => {
  const exams = [
    { examDate: "2026-09-30", toplamNet: 80 },
    { examDate: "2026-10-01", toplamNet: 78 },
    { examDate: "2026-10-07", toplamNet: 82.5 },
    { examDate: "2026-10-08", toplamNet: 81 },
  ];

  it("başlangıç ve bitiş gününü dahil tutar, dışındakileri atlar", () => {
    const result = filterMocksInRange(exams, "2026-10-01", "2026-10-07");
    expect(result.map((exam) => exam.examDate)).toEqual([
      "2026-10-01",
      "2026-10-07",
    ]);
  });

  it("aralıkta deneme yoksa boş döner", () => {
    expect(filterMocksInRange(exams, "2026-11-01", "2026-11-30")).toEqual([]);
  });

  it("bir önceki denemeye göre net farkını hesaplar", () => {
    const result = withMockDiffs([
      { toplamNet: 80 },
      { toplamNet: 82.5 },
      { toplamNet: 79 },
      { toplamNet: 79 },
    ]);
    expect(result.map((exam) => exam.netDiff)).toEqual([
      null,
      2.5,
      -3.5,
      0,
    ]);
  });

  it("tek denemede fark yoktur", () => {
    expect(withMockDiffs([{ toplamNet: 50 }])[0].netDiff).toBeNull();
  });
});

describe("Excel hücre güvenliği", () => {
  it("formül enjeksiyonu riskli metinlerin başına kesme işareti ekler", () => {
    expect(excelSafeCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(excelSafeCell("+1+1")).toBe("'+1+1");
    expect(excelSafeCell("-2+3")).toBe("'-2+3");
    expect(excelSafeCell("@cmd")).toBe("'@cmd");
  });

  it("tehlikeli olmayan metinleri ve sayıları değiştirmez", () => {
    expect(excelSafeCell("normal metin")).toBe("normal metin");
    expect(excelSafeCell("1+1 işi")).toBe("1+1 işi");
    expect(excelSafeCell(-2)).toBe(-2);
    expect(excelSafeCell(42.5)).toBe(42.5);
    expect(excelSafeCell(null)).toBeNull();
  });
});

describe("excelFileName", () => {
  it("numara, başlangıç ve bitişten dosya adı üretir", () => {
    expect(excelFileName("1042", "2026-10-01", "2026-10-07")).toBe(
      "rapor_1042_2026-10-01_2026-10-07.xlsx",
    );
  });

  it("Türkçe karakter, boşluk ve özel karakterleri temizler", () => {
    expect(excelFileName("A/B 12-ç", "2026-01-01", "2026-01-31")).toBe(
      "rapor_AB12_2026-01-01_2026-01-31.xlsx",
    );
    expect(excelFileName(null, "2026-01-01", "2026-01-31")).toBe(
      "rapor_ogrenci_2026-01-01_2026-01-31.xlsx",
    );
  });
});
