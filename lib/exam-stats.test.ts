import { describe, expect, it } from "vitest";
import {
  buildSubjectRows,
  buildTimeline,
  hasPreviousExam,
} from "@/lib/exam-stats";
import type { MockExamRecord } from "@/app/actions/mock-exam-actions";

function makeRecord(overrides: Partial<MockExamRecord> = {}): MockExamRecord {
  return {
    id: 1,
    examName: "Deneme",
    examDate: "2026-01-05",
    turkceNet: 30,
    tarihNet: 5,
    cografyaNet: 4,
    felsefeNet: 3,
    dinNet: 4,
    matematikNet: 20,
    geometriNet: 5,
    fizikNet: 4,
    kimyaNet: 3,
    biyolojiNet: 4,
    toplamNet: 82,
    tytPuani: 85.5,
    ...overrides,
  };
}

describe("buildSubjectRows", () => {
  it("boş liste için hesaplama yapmadan boş dizi döner", () => {
    expect(buildSubjectRows([])).toEqual([]);
  });

  it("tek kayıtta prev 0 ve delta null olur (fark bölümü gösterilmez)", () => {
    const rows = buildSubjectRows([makeRecord()]);
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(typeof row.last).toBe("number");
      expect(row.prev).toBe(0);
      expect(row.delta).toBeNull();
    }
  });

  it("iki kayıtta son ve önceki net ile delta hesaplanır", () => {
    const rows = buildSubjectRows([
      makeRecord({ turkceNet: 32 }),
      makeRecord({ turkceNet: 30 }),
    ]);
    const turkce = rows.find((r) => r.label === "Türkçe");
    expect(turkce).toBeDefined();
    expect(turkce?.last).toBe(32);
    expect(turkce?.prev).toBe(30);
    expect(turkce?.delta).toBe(2);
  });

  it("delta iki ondalığa yuvarlanır", () => {
    const rows = buildSubjectRows([
      makeRecord({ matematikNet: 20.5625 }),
      makeRecord({ matematikNet: 20 }),
    ]);
    const matematik = rows.find((r) => r.label === "Matematik");
    expect(matematik?.delta).toBe(0.56);
  });

  it("eksik delta negatif işaretlenir", () => {
    const rows = buildSubjectRows([
      makeRecord({ fizikNet: 2 }),
      makeRecord({ fizikNet: 4 }),
    ]);
    const fizik = rows.find((r) => r.label === "Fizik");
    expect(fizik?.delta).toBe(-2);
  });
});

describe("buildTimeline", () => {
  it("boş liste için boş dizi döner", () => {
    expect(buildTimeline([])).toEqual([]);
  });

  it("kayıtları tarihe göre yeniden eskiye dizir", () => {
    const timeline = buildTimeline([
      makeRecord({ examDate: "2026-01-12", tytPuani: 90 }),
      makeRecord({ examDate: "2026-01-05", tytPuani: 85.5 }),
    ]);
    expect(timeline.map((p) => p.date)).toEqual(["2026-01-05", "2026-01-12"]);
    expect(timeline[0].puan).toBe(85.5);
    expect(timeline[1].net).toBe(82);
  });

  it("tek kayıtta tek nokta döner", () => {
    expect(buildTimeline([makeRecord()])).toHaveLength(1);
  });
});

describe("hasPreviousExam", () => {
  it("tek kayıtta false döner (fark bölümü gizlenir)", () => {
    expect(hasPreviousExam([makeRecord()])).toBe(false);
  });

  it("iki ve üzeri kayıtta true döner", () => {
    expect(hasPreviousExam([makeRecord(), makeRecord({ id: 2 })])).toBe(true);
  });

  it("boş liste için false döner", () => {
    expect(hasPreviousExam([])).toBe(false);
  });
});
