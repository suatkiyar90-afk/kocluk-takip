import { describe, expect, it } from "vitest";
import {
  computeDenemeTrend,
  computeRecord,
  computeSubjectTrends,
  countDaysEntered,
  ringMotivation,
  summarizeLastWeek,
  type DailySubjectRow,
} from "./motivation";

const WEEK_START = "2026-10-12";

function row(overrides: Partial<DailySubjectRow>): DailySubjectRow {
  return {
    date: "2026-10-12",
    subjectId: "mat",
    correct: 10,
    wrong: 0,
    blank: 0,
    ...overrides,
  };
}

describe("countDaysEntered", () => {
  it("hafta içindeki farklı günleri sayar", () => {
    expect(
      countDaysEntered(
        ["2026-10-12", "2026-10-12", "2026-10-13", "2026-10-16"],
        WEEK_START,
      ),
    ).toBe(3);
  });

  it("hafta dışındaki ve hafta sonraki günleri saymaz", () => {
    expect(
      countDaysEntered(
        ["2026-10-11", "2026-10-19", "2026-10-12"],
        WEEK_START,
      ),
    ).toBe(1);
  });
});

describe("ringMotivation", () => {
  it("hedef %70'de motive edici mesaj verir", () => {
    const result = ringMotivation(70, 5);
    expect(result.complete).toBe(false);
    expect(result.message).toBe("Çok iyi gidiyorsun, hedefe çok az kaldı!");
  });

  it("hedef %100'de tamamlandı mesajı ve yeşil bayrak verir", () => {
    const result = ringMotivation(100, 6);
    expect(result.complete).toBe(true);
    expect(result.message).toBe("Hedef Tamamlandı 🚀");
  });

  it("%70 altında mesaj vermez", () => {
    expect(ringMotivation(69, 4).message).toBeNull();
  });

  it("hedef yoksa giriş gün oranına göre değerlendirir (5/7 ≈ %71)", () => {
    expect(ringMotivation(null, 5).message).toBe(
      "Çok iyi gidiyorsun, hedefe çok az kaldı!",
    );
    expect(ringMotivation(null, 7).complete).toBe(true);
    expect(ringMotivation(null, 3).message).toBeNull();
  });
});

describe("computeSubjectTrends", () => {
  const names = new Map([["mat", "Matematik"]]);

  it("en erken ve en son hafta arasındaki başarı oranını karşılaştırır", () => {
    const rows: DailySubjectRow[] = [
      row({ date: "2026-09-28", correct: 62, wrong: 25, blank: 13 }),
      row({ date: "2026-10-13", correct: 78, wrong: 15, blank: 7 }),
    ];
    const trends = computeSubjectTrends(rows, names, WEEK_START);
    expect(trends).toHaveLength(1);
    expect(trends[0].subjectName).toBe("Matematik");
    expect(trends[0].fromPct).toBe(62);
    expect(trends[0].toPct).toBe(78);
    expect(trends[0].delta).toBe(16);
  });

  it("tek haftada verisi olan dersi atlar", () => {
    const rows = [row({ date: "2026-10-13" })];
    expect(computeSubjectTrends(rows, names, WEEK_START)).toHaveLength(0);
  });

  it("gelişimi büyükten küçüğe sıralar ve 4 ile sınırlar", () => {
    const rows: DailySubjectRow[] = [
      row({ subjectId: "a", date: "2026-09-29", correct: 50, wrong: 50, blank: 0 }),
      row({ subjectId: "a", date: "2026-10-14", correct: 80, wrong: 20, blank: 0 }),
      row({ subjectId: "b", date: "2026-10-06", correct: 60, wrong: 40, blank: 0 }),
      row({ subjectId: "b", date: "2026-10-15", correct: 70, wrong: 30, blank: 0 }),
      row({ subjectId: "c", date: "2026-09-30", correct: 90, wrong: 10, blank: 0 }),
      row({ subjectId: "c", date: "2026-10-16", correct: 91, wrong: 9, blank: 0 }),
    ];
    const trends = computeSubjectTrends(rows, names, WEEK_START);
    expect(trends).toHaveLength(3);
    expect(trends[0].subjectName).toBe("a");
    expect(trends[0].delta).toBe(30);
    expect(trends[1].subjectName).toBe("b");
    expect(trends[2].subjectName).toBe("c");
  });

  it("hafta penceresi dışındaki satırları yok sayar", () => {
    const rows = [
      row({ date: "2026-09-20" }),
      row({ date: "2026-10-13" }),
    ];
    expect(computeSubjectTrends(rows, names, WEEK_START)).toHaveLength(0);
  });
});

describe("computeDenemeTrend", () => {
  it("son 3 ortalama ile önceki 3 ortalamayı karşılaştırır", () => {
    const trend = computeDenemeTrend([91, 88, 94, 74, 70, 78]);
    expect(trend).toEqual({ newAvg: 91, oldAvg: 74 });
  });

  it("4-5 denemede elde kalan eski dilimi kullanır", () => {
    const trend = computeDenemeTrend([80, 90, 100, 60]);
    expect(trend).toEqual({ newAvg: 90, oldAvg: 60 });
  });

  it("yeterli veri yoksa null döner", () => {
    expect(computeDenemeTrend([80, 90, 100])).toBeNull();
    expect(computeDenemeTrend([])).toBeNull();
  });

  it("ondalık ortalamaları 1 basamağa yuvarlar", () => {
    const trend = computeDenemeTrend([10, 10, 11, 4, 4, 4]);
    expect(trend?.newAvg).toBe(10.3);
    expect(trend?.oldAvg).toBe(4);
  });
});

describe("computeRecord", () => {
  it("bugün tüm zamanların en yükseğiyse rekor döner", () => {
    const record = computeRecord("2026-10-14", WEEK_START, [
      { date: "2026-10-01", total: 200 },
      { date: "2026-10-14", total: 350 },
    ]);
    expect(record).toEqual({ scope: "all-time", total: 350 });
  });

  it("bugün haftanın en yükseği ama tüm zamanların değilse haftalık rekor döner", () => {
    const record = computeRecord("2026-10-14", WEEK_START, [
      { date: "2026-09-20", total: 400 },
      { date: "2026-10-13", total: 100 },
      { date: "2026-10-14", total: 250 },
    ]);
    expect(record).toEqual({ scope: "week", total: 250 });
  });

  it("eski rekorla eşitse rekor sayılmaz", () => {
    expect(
      computeRecord("2026-10-14", WEEK_START, [
        { date: "2026-09-20", total: 250 },
        { date: "2026-10-14", total: 250 },
      ]),
    ).toBeNull();
  });

  it("bu hafta rakip gün yoksa haftalık rekor sayılmaz", () => {
    expect(
      computeRecord("2026-10-14", WEEK_START, [
        { date: "2026-09-20", total: 400 },
        { date: "2026-10-14", total: 250 },
      ]),
    ).toBeNull();
  });

  it("bugün giriş yoksa rekor dömez", () => {
    expect(
      computeRecord("2026-10-14", WEEK_START, [
        { date: "2026-09-20", total: 100 },
      ]),
    ).toBeNull();
  });

  it("sadece bugünkü giriş varsa ilk gün rekoru sayılır", () => {
    expect(
      computeRecord("2026-10-14", WEEK_START, [
        { date: "2026-10-14", total: 120 },
      ]),
    ).toEqual({ scope: "all-time", total: 120 });
  });
});

describe("summarizeLastWeek", () => {
  const names = new Map([
    ["mat", "Matematik"],
    ["geo", "Co�rafya"],
  ]);

  it("ge�en haftan�n g�n ve soru toplam�n� verir, bu hafta verisini hari� tutar", () => {
    const rows: DailySubjectRow[] = [
      row({ date: "2026-10-05", subjectId: "geo", correct: 20, wrong: 0, blank: 0 }),
      row({ date: "2026-10-06", subjectId: "mat", correct: 10, wrong: 0, blank: 0 }),
      row({ date: "2026-10-07", subjectId: "mat", correct: 5, wrong: 0, blank: 0 }),
      row({ date: "2026-10-13", subjectId: "mat", correct: 99, wrong: 0, blank: 0 }),
    ];
    const stats = summarizeLastWeek(rows, names, WEEK_START);
    expect(stats.daysEntered).toBe(3);
    expect(stats.totalQuestions).toBe(35);
  });

  it("en �ok geli�en dersi bulur (ge�en hafta vs �nceki hafta)", () => {
    const rows: DailySubjectRow[] = [
      row({ date: "2026-09-29", subjectId: "mat", correct: 62, wrong: 25, blank: 13 }),
      row({ date: "2026-10-06", subjectId: "mat", correct: 78, wrong: 15, blank: 7 }),
      row({ date: "2026-09-30", subjectId: "geo", correct: 50, wrong: 50, blank: 0 }),
      row({ date: "2026-10-07", subjectId: "geo", correct: 50, wrong: 50, blank: 0 }),
    ];
    const stats = summarizeLastWeek(rows, names, WEEK_START);
    expect(stats.bestSubject).not.toBeNull();
    expect(stats.bestSubject?.subjectName).toBe("Matematik");
    expect(stats.bestSubject?.delta).toBe(16);
  });

  it("pozitif geli�im yoksa bestSubject null d�ner", () => {
    const rows: DailySubjectRow[] = [
      row({ date: "2026-09-29", subjectId: "mat", correct: 90, wrong: 10, blank: 0 }),
      row({ date: "2026-10-06", subjectId: "mat", correct: 60, wrong: 40, blank: 0 }),
      row({ date: "2026-09-30", subjectId: "geo", correct: 50, wrong: 50, blank: 0 }),
      row({ date: "2026-10-07", subjectId: "geo", correct: 50, wrong: 50, blank: 0 }),
    ];
    expect(summarizeLastWeek(rows, names, WEEK_START).bestSubject).toBeNull();
  });

  it("tek haftal�k veride trend olu�maz", () => {
    const rows = [row({ date: "2026-10-06", correct: 40 })];
    const stats = summarizeLastWeek(rows, names, WEEK_START);
    expect(stats.daysEntered).toBe(1);
    expect(stats.bestSubject).toBeNull();
  });

  it("hi� veri yoksa s�f�rlar d�ner", () => {
    expect(summarizeLastWeek([], names, WEEK_START)).toEqual({
      daysEntered: 0,
      totalQuestions: 0,
      bestSubject: null,
    });
  });
});
