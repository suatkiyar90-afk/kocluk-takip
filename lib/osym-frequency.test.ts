import { describe, expect, it } from "vitest";
import {
  classifyOsymFrequency,
  computeRecentAverage,
  osymTotalQuestions,
  osymYearCounts,
  sanitizeYearlyCounts,
  weightedMastery,
} from "./osym-frequency";

describe("osymYearCounts", () => {
  it("yil azalan sirada doner ve sifirlari atlar", () => {
    const result = osymYearCounts({ "2026": 3, "2024": 0, "2025": 5 });
    expect(result).toEqual([
      { year: 2026, count: 3 },
      { year: 2025, count: 5 },
    ]);
  });

  it("bos veya null girdide bos dizi doner", () => {
    expect(osymYearCounts(null)).toEqual([]);
    expect(osymYearCounts(undefined)).toEqual([]);
    expect(osymYearCounts({})).toEqual([]);
  });
});

describe("osymTotalQuestions", () => {
  it("tum yillardaki soru sayilarini toplar", () => {
    expect(osymTotalQuestions({ "2026": 3, "2025": 4, "2020": 2 })).toBe(9);
  });
});

describe("computeRecentAverage", () => {
  it("son 5 yilin ortalamasini 5e bolerek hesaplar", () => {
    expect(
      computeRecentAverage({
        "2026": 3,
        "2025": 4,
        "2024": 5,
        "2023": 3,
        "2022": 4,
        "2021": 1,
      }),
    ).toBe(3.8);
  });

  it("sifir veya veri yoksa 0 doner", () => {
    expect(computeRecentAverage({})).toBe(0);
    expect(computeRecentAverage({ "2026": 0, "2025": 0 })).toBe(0);
  });
});

describe("classifyOsymFrequency", () => {
  it("0.8 ve uzerini garantı konu sayar", () => {
    const info = classifyOsymFrequency(1.2, { "2026": 1, "2025": 1 });
    expect(info.tier).toBe("garanti");
    expect(info.label).toBe("Garanti Konu");
    expect(info.icon).toBe("🔥");
    expect(info.totalQuestions).toBe(2);
  });

  it("0.4-0.8 arasini duzenli sayar", () => {
    expect(classifyOsymFrequency(0.4, { "2026": 2 }).tier).toBe("duzenli");
    expect(classifyOsymFrequency(0.79, { "2026": 2 }).tier).toBe("duzenli");
  });

  it("dusuk ortalamada gecmis soru varsa seyrek sayar", () => {
    const info = classifyOsymFrequency(0.2, { "2015": 3 });
    expect(info.tier).toBe("seyrek");
    expect(info.label).toBe("Seyrek Çıkar");
  });

  it("hic soru cikmamis konuyu yok sayar", () => {
    const info = classifyOsymFrequency(0, {});
    expect(info.tier).toBe("yok");
    expect(info.icon).toBe("");
  });
});

describe("weightedMastery", () => {
  it("biten konularin agirligini toplam agirliga boler", () => {
    const result = weightedMastery([
      { status: "bitti", avgRecentQuestions: 3 },
      { status: "bitti", avgRecentQuestions: 2 },
      { status: "baslamadi", avgRecentQuestions: 5 },
    ]);
    expect(result.percent).toBe(50);
    expect(result.weightedDone).toBe(5);
    expect(result.weightedTotal).toBe(10);
  });

  it("agirlik yoksa yuzde null doner", () => {
    const result = weightedMastery([
      { status: "bitti", avgRecentQuestions: 0 },
      { status: "calisiliyor", avgRecentQuestions: 0 },
    ]);
    expect(result.percent).toBeNull();
    expect(result.weightedTotal).toBe(0);
  });
});

describe("sanitizeYearlyCounts", () => {
  it("gecerli yil/sayi ciftlerini korur", () => {
    expect(sanitizeYearlyCounts({ "2026": "3", "2015": 2.6 })).toEqual({
      "2026": 3,
      "2015": 3,
    });
  });

  it("gecersiz anahtar ve degerleri atar", () => {
    expect(
      sanitizeYearlyCounts({ abc: 3, "2026": -1, "1850": 4, "2030": 7 }),
    ).toEqual({ "2030": 7 });
  });

  it("bos girdide bos obje doner", () => {
    expect(sanitizeYearlyCounts(null)).toEqual({});
  });
});
