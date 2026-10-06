import { describe, expect, it } from "vitest";
import {
  DENEME_RULES,
  MAX_DAY_ATTEMPTS,
  MAX_DENEME_TARGET_ROWS,
  MAX_WEEK_TARGET_COUNT,
  MIN_WEEK_TARGET_COUNT,
  bransSubjects,
  buildDenemeKey,
  computeDenemeProgress,
  denemeAttemptSchema,
  denemeTargetRowSchema,
  denemeTypeOptions,
  getDenemeLabel,
  isValidDenemeKey,
  mergeDenemeTargetRows,
  parseDenemeKey,
  resolveTytBlank,
  validateDenemeCounts,
} from "@/lib/deneme";

describe("deneme key yardımcıları", () => {
  it("tyt ve ayt anahtarlarını kurar ve çözer", () => {
    expect(buildDenemeKey("tyt")).toBe("tyt");
    expect(buildDenemeKey("ayt")).toBe("ayt");
    expect(parseDenemeKey("tyt")).toEqual({
      type: "tyt",
      bransSubjectId: null,
    });
    expect(parseDenemeKey("ayt")).toEqual({
      type: "ayt",
      bransSubjectId: null,
    });
  });

  it("brans anahtarı12 ders için geçerlidir", () => {
    expect(bransSubjects).toHaveLength(12);
    for (const subject of bransSubjects) {
      const key = buildDenemeKey("brans", subject.id);
      expect(key).toBe(`brans:${subject.id}`);
      expect(isValidDenemeKey(key)).toBe(true);
      expect(parseDenemeKey(key)).toEqual({
        type: "brans",
        bransSubjectId: subject.id,
      });
    }
  });

  it("geçersiz anahtarları reddeder", () => {
    for (const key of ["", "TYT", "brans:", "brans:yok-boyle-ders", 42, null]) {
      expect(isValidDenemeKey(key)).toBe(false);
      expect(parseDenemeKey(key)).toBeNull();
    }
  });

  it("etiketleri doğru üretir", () => {
    expect(getDenemeLabel("tyt")).toBe("TYT Denemesi");
    expect(getDenemeLabel("ayt")).toBe("AYT Denemesi");
    expect(getDenemeLabel("brans:matematik")).toBe("Matematik Branş Denemesi");
    expect(getDenemeLabel("geçersiz")).toBeNull();
  });

  it("tür seçenekleri sırasıyla TYT, AYT, Branş", () => {
    expect(denemeTypeOptions.map((t) => t.key)).toEqual([
      "tyt",
      "ayt",
      "brans",
    ]);
  });
});

describe("sabitler", () => {
  it("sınırlar ödev değerleriyle eşleşir", () => {
    expect(MAX_DAY_ATTEMPTS).toBe(10);
    expect(MAX_WEEK_TARGET_COUNT).toBe(14);
    expect(MIN_WEEK_TARGET_COUNT).toBe(1);
    expect(MAX_DENEME_TARGET_ROWS).toBe(10);
    expect(DENEME_RULES.tyt.totalQuestions).toBe(120);
    expect(DENEME_RULES.ayt.maxSolved).toBe(160);
    expect(DENEME_RULES.brans.maxSolved).toBe(120);
  });
});

describe("resolveTytBlank", () => {
  it("120 − doğru − yanlış hesaplar", () => {
    expect(resolveTytBlank(0, 0)).toBe(120);
    expect(resolveTytBlank(80, 20)).toBe(20);
    expect(resolveTytBlank(120, 0)).toBe(0);
  });
});

describe("validateDenemeCounts", () => {
  it("geçerli TYT sayımını kabul eder", () => {
    expect(
      validateDenemeCounts("tyt", { correct: 80, wrong: 20, blank: 20 }),
    ).toBeNull();
    expect(
      validateDenemeCounts("tyt", { correct: 1, wrong: 0, blank: 119 }),
    ).toBeNull();
  });

  it("TYT'de istemciden gelen blank yoksayılır (sunucuda yeniden hesaplanır)", () => {
    expect(
      validateDenemeCounts("tyt", { correct: 80, wrong: 20, blank: 999 }),
    ).toBeNull();
    expect(
      validateDenemeCounts("tyt", { correct: 80, wrong: 20 }),
    ).toBeNull();
  });

  it("TYT'de doğru + yanlış120'yi aşarsa reddeder", () => {
    expect(
      validateDenemeCounts("tyt", { correct: 100, wrong: 21 }),
    ).toContain("120");
  });

  it("TYT'de toplam sıfırsa reddeder", () => {
    expect(validateDenemeCounts("tyt", { correct: 0, wrong: 0 })).toContain(
      "en az 1",
    );
  });

  it("AYT'de boş zorunlu ve toplam1-160 aralığındadır", () => {
    expect(
      validateDenemeCounts("ayt", { correct: 40, wrong: 20, blank: 100 }),
    ).toBeNull();
    expect(
      validateDenemeCounts("ayt", { correct: 40, wrong: 20, blank: 101 }),
    ).toContain("160");
    expect(validateDenemeCounts("ayt", { correct: 0, wrong: 0, blank: 0 })).toContain(
      "en az 1",
    );
    expect(
      validateDenemeCounts("ayt", { correct: 40, wrong: 20 }),
    ).toContain("Boş");
  });

  it("branş denemesinde toplam1-120 aralığındadır", () => {
    expect(
      validateDenemeCounts("brans:matematik", {
        correct: 30,
        wrong: 10,
        blank: 80,
      }),
    ).toBeNull();
    expect(
      validateDenemeCounts("brans:matematik", {
        correct: 30,
        wrong: 10,
        blank: 81,
      }),
    ).toContain("120");
    expect(
      validateDenemeCounts("brans:matematik", {
        correct: 0,
        wrong: 0,
        blank: 0,
      }),
    ).toContain("en az 1");
  });

  it("geçersiz anahtarı reddeder", () => {
    expect(
      validateDenemeCounts("boyle-bir-sey", { correct: 1, wrong: 0, blank: 0 }),
    ).toBe("Geçersiz deneme türü.");
  });

  it("negatif veya kesirli değerleri reddeder", () => {
    expect(
      validateDenemeCounts("ayt", { correct: -1, wrong: 0, blank: 5 }),
    ).toContain("0 ile");
    expect(
      validateDenemeCounts("ayt", { correct: 1.5, wrong: 0, blank: 5 }),
    ).toContain("0 ile");
  });
});

describe("denemeAttemptSchema", () => {
  it("geçerli TYT kaydını onaylar (blank opsiyonel)", () => {
    const parsed = denemeAttemptSchema.safeParse({
      denemeKey: "tyt",
      correct: 70,
      wrong: 30,
      blank: 20,
    });
    expect(parsed.success).toBe(true);
    const withoutBlank = denemeAttemptSchema.safeParse({
      denemeKey: "tyt",
      correct: 70,
      wrong: 30,
    });
    expect(withoutBlank.success).toBe(true);
  });

  it("AYT'de blank zorunlu", () => {
    const parsed = denemeAttemptSchema.safeParse({
      denemeKey: "ayt",
      correct: 40,
      wrong: 20,
    });
    expect(parsed.success).toBe(false);
  });

  it("geçersiz anahtar ve negatif sayıları reddeder", () => {
    expect(
      denemeAttemptSchema.safeParse({
        denemeKey: "yanlis",
        correct: 1,
        wrong: 1,
        blank: 1,
      }).success,
    ).toBe(false);
    expect(
      denemeAttemptSchema.safeParse({
        denemeKey: "tyt",
        correct: -5,
        wrong: 0,
      }).success,
    ).toBe(false);
  });
});

describe("denemeTargetRowSchema", () => {
  it("adet sınırı1-14 aralığındadır", () => {
    expect(
      denemeTargetRowSchema.safeParse({ denemeKey: "tyt", targetCount: 1 })
        .success,
    ).toBe(true);
    expect(
      denemeTargetRowSchema.safeParse({ denemeKey: "tyt", targetCount: 14 })
        .success,
    ).toBe(true);
    expect(
      denemeTargetRowSchema.safeParse({ denemeKey: "tyt", targetCount: 0 })
        .success,
    ).toBe(false);
    expect(
      denemeTargetRowSchema.safeParse({ denemeKey: "tyt", targetCount: 15 })
        .success,
    ).toBe(false);
  });
});

describe("mergeDenemeTargetRows", () => {
  it("aynı anahtardaki adetleri birleştirir", () => {
    const result = mergeDenemeTargetRows([
      { denemeKey: "tyt", targetCount: 3 },
      { denemeKey: "tyt", targetCount: 4 },
      { denemeKey: "ayt", targetCount: 2 },
    ]);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([
      { denemeKey: "tyt", targetCount: 7 },
      { denemeKey: "ayt", targetCount: 2 },
    ]);
  });

  it("birleşim14'ü aşarsa hata döner", () => {
    const result = mergeDenemeTargetRows([
      { denemeKey: "tyt", targetCount: 10 },
      { denemeKey: "tyt", targetCount: 5 },
    ]);
    expect(result.rows).toEqual([]);
    expect(result.error).toContain("14");
  });

  it("boş liste temiz geçer", () => {
    expect(mergeDenemeTargetRows([])).toEqual({ rows: [], error: null });
  });
});

describe("computeDenemeProgress", () => {
  const targets = [
    { denemeKey: "tyt", targetCount: 2 },
    { denemeKey: "ayt", targetCount: 1 },
  ];

  it("yalnızca Pzt-Pazar aralığındaki denemeleri sayar", () => {
    const progress = computeDenemeProgress(
      "2026-01-05",
      targets,
      [
        { date: "2026-01-05", denemeKey: "tyt" },
        { date: "2026-01-06", denemeKey: "tyt" },
        { date: "2026-01-04", denemeKey: "tyt" },
        { date: "2026-01-12", denemeKey: "tyt" },
        { date: "2026-01-08", denemeKey: "ayt" },
      ],
    );
    const tyt = progress.find((row) => row.denemeKey === "tyt")!;
    const ayt = progress.find((row) => row.denemeKey === "ayt")!;
    expect(tyt.solvedCount).toBe(2);
    expect(tyt.reached).toBe(true);
    expect(ayt.solvedCount).toBe(1);
    expect(ayt.reached).toBe(true);
  });

  it("hedefe ulaşılmadığında reached=false döner", () => {
    const progress = computeDenemeProgress(
      "2026-01-05",
      targets,
      [{ date: "2026-01-07", denemeKey: "tyt" }],
    );
    const tyt = progress.find((row) => row.denemeKey === "tyt")!;
    const ayt = progress.find((row) => row.denemeKey === "ayt")!;
    expect(tyt.solvedCount).toBe(1);
    expect(tyt.reached).toBe(false);
    expect(ayt.solvedCount).toBe(0);
    expect(ayt.reached).toBe(false);
  });

  it("hafta sınır günlerini dahil eder (Pzt ve Pazar)", () => {
    const progress = computeDenemeProgress(
      "2026-01-05",
      targets,
      [
        { date: "2026-01-05", denemeKey: "tyt" },
        { date: "2026-01-11", denemeKey: "tyt" },
      ],
    );
    expect(progress[0].solvedCount).toBe(2);
  });
});
