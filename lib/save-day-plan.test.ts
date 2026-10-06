import { describe, expect, it } from "vitest";
import {
  findPassiveTopicViolation,
  planSaveDay,
  saveDaySchema,
  type SaveDayInput,
} from "./save-day-plan";
import { MAX_COUNT, MAX_DAY_ENTRIES } from "./daily-entry-list";

function row(overrides: Partial<SaveDayInput["entries"][number]> = {}) {
  return {
    topicId: 101,
    examType: "TYT" as const,
    subjectId: "turkce",
    correct: 8,
    wrong: 2,
    blank: 0,
    ...overrides,
  };
}

function input(
  overrides: Partial<SaveDayInput> = {},
): SaveDayInput {
  return {
    entries: [row()],
    summary: "BugÃ¼n 3 test Ã§Ã¶zdÃ¼m.",
    ...overrides,
  };
}

describe("saveDaySchema", () => {
  it("geÃ§erli girdiyi onaylar", () => {
    expect(saveDaySchema.safeParse(input()).success).toBe(true);
  });

  it(`${MAX_DAY_ENTRIES + 1} satÄ±rÄ± reddeder`, () => {
    const payload = input({
      entries: Array.from({ length: MAX_DAY_ENTRIES + 1 }, (_, i) =>
        row({ topicId: i + 1 }),
      ),
    });
    const result = saveDaySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("aynÄ± konunun iki kez gelmesini reddeder", () => {
    const payload = input({ entries: [row(), row()] });
    const result = saveDaySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("0-300 dÄ±ÅŸÄ±ndaki sayÄ±larÄ± reddeder", () => {
    expect(
      saveDaySchema.safeParse(input({ entries: [row({ correct: 301 })] }))
        .success,
    ).toBe(false);
    expect(
      saveDaySchema.safeParse(input({ entries: [row({ wrong: -1 })] }))
        .success,
    ).toBe(false);
    expect(
      saveDaySchema.safeParse(input({ entries: [row({ correct: 1.5 })] }))
        .success,
    ).toBe(false);
  });

  it("toplamÄ± sÄ±fÄ±r olan satÄ±rÄ± reddeder", () => {
    const payload = input({
      entries: [row({ correct: 0, wrong: 0, blank: 0 })],
    });
    expect(saveDaySchema.safeParse(payload).success).toBe(false);
  });

  it("2000 karakterden uzun Ã¶zeti reddeder", () => {
    expect(
      saveDaySchema.safeParse(input({ summary: "x".repeat(2001) }))
        .success,
    ).toBe(false);
    expect(
      saveDaySchema.safeParse(input({ summary: "x".repeat(2000) }))
        .success,
    ).toBe(true);
  });

  it("MAX_COUNT tam sÄ±nÄ±rÄ±nÄ± kabul eder", () => {
    expect(
      saveDaySchema.safeParse(
        input({
          entries: [
            row({ correct: MAX_COUNT, wrong: 0, blank: 0 }),
          ],
        }),
      ).success,
    ).toBe(true);
  });
});

describe("planSaveDay", () => {
  it("aynÄ± girdiyle tekrar aynÄ± planÄ± Ã¼retir (idempotent)", () => {
    const payload = input();
    const existing = [{ topicId: 101 }, { topicId: 999 }];
    const first = planSaveDay(existing, payload);
    const second = planSaveDay(existing, payload);
    expect(first).toEqual(second);
    expect(first.upserts).toHaveLength(1);
    expect(first.upserts[0].correct).toBe(8);
  });

  it("payload'da olmayan bugÃ¼nkÃ¼ satÄ±rlarÄ± silmek Ã¼zere iÅŸaretler", () => {
    const payload = input({ entries: [row({ topicId: 101 })] });
    const plan = planSaveDay(
      [{ topicId: 101 }, { topicId: 55 }, { topicId: 56 }],
      payload,
    );
    expect(plan.deleteTopicIds).toEqual([55, 56]);
  });

  it("payload boÅŸsa tÃ¼m mevcut satÄ±rlarÄ± siler", () => {
    const plan = planSaveDay([{ topicId: 1 }, { topicId: 2 }], {
      entries: [],
      summary: "",
    });
    expect(plan.deleteTopicIds).toEqual([1, 2]);
  });

  it("Ã¶zet varsa upsert, boÅŸsa delete planlar", () => {
    const withSummary = planSaveDay([], input({ summary: "  Not  " }));
    expect(withSummary.note).toEqual({
      op: "upsert",
      value: "Not",
    });
    const withoutSummary = planSaveDay([], input({ summary: "   " }));
    expect(withoutSummary.note).toEqual({ op: "delete" });
  });

  it("upsert deÄŸerleri ham girdiyi korur (sayÄ±lar katlanmaz)", () => {
    const payload = input({
      entries: [row({ correct: 12, wrong: 3, blank: 5 })],
    });
    const plan = planSaveDay([{ topicId: 101 }], payload);
    expect(plan.upserts[0]).toMatchObject({
      correct: 12,
      wrong: 3,
      blank: 5,
    });
  });
});

describe("findPassiveTopicViolation", () => {
  const inactive = new Set([101, 202]);

  it("pasif konuya YENÄ° satÄ±r eklenemez (reddet)", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 202 })],
      inactive,
      [],
    );
    expect(violation).toEqual({ kind: "new-row", topicId: 202 });
  });

  it("bugÃ¼n zaten kayÄ±tlÄ± pasif konu aynen kalÄ±yorsa KABUL et", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 101, correct: 8, wrong: 2, blank: 0 })],
      inactive,
      [{ topicId: 101, correct: 8, wrong: 2, blank: 0 }],
    );
    expect(violation).toBeNull();
  });

  it("bugÃ¼n kayÄ±tlÄ± pasif konunun sayÄ±larÄ± deÄŸiÅŸmiÅŸse REDDET", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 101, correct: 9, wrong: 1, blank: 0 })],
      inactive,
      [{ topicId: 101, correct: 8, wrong: 2, blank: 0 }],
    );
    expect(violation).toEqual({ kind: "modified-row", topicId: 101 });
  });

  it("aktif konular iÃ§in hiÃ§ bakmaz", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 999, correct: 5, wrong: 5, blank: 5 })],
      inactive,
      [],
    );
    expect(violation).toBeNull();
  });

  it("karÄ±ÅŸÄ±ktaki ilk pasif ihlali dÃ¶ndÃ¼rÃ¼r", () => {
    const violation = findPassiveTopicViolation(
      [
        row({ topicId: 999 }),
        row({ topicId: 303 }),
        row({ topicId: 404 }),
      ],
      new Set([303, 404]),
      [],
    );
    expect(violation).toEqual({ kind: "new-row", topicId: 303 });
  });

  it("bugÃ¼n kaydÄ± olmayan ama pasif olmayan konu ihlal sayÄ±lmaz", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 777 })],
      new Set([101]),
      [],
    );
    expect(violation).toBeNull();
  });
});

describe("saveDaySchema attempts", () => {
  it("attempts alanı olmadan da geçerdir (eski istemci)", () => {
    expect(saveDaySchema.safeParse(input()).success).toBe(true);
    const parsed = saveDaySchema.parse(input());
    expect(parsed.attempts).toEqual([]);
  });

  it("geçerli deneme kayıtlarını onaylar", () => {
    const parsed = saveDaySchema.safeParse(
      input({
        attempts: [
          { denemeKey: "tyt", correct: 70, wrong: 30, blank: 20 },
          { denemeKey: "brans:matematik", correct: 40, wrong: 10, blank: 70 },
        ],
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it(`${11} denemeyi reddeder`, () => {
    const parsed = saveDaySchema.safeParse(
      input({
        attempts: Array.from({ length: 11 }, () => ({
          denemeKey: "tyt",
          correct: 1,
          wrong: 0,
          blank: 119,
        })),
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it("geçersiz deneme anahtarını reddeder", () => {
    const parsed = saveDaySchema.safeParse(
      input({
        attempts: [{ denemeKey: "boyle-degil", correct: 1, wrong: 0, blank: 0 }],
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it("AYT kaydında boşu zorunlu tutar", () => {
    const parsed = saveDaySchema.safeParse(
      input({
        attempts: [{ denemeKey: "ayt", correct: 40, wrong: 20 }],
      }),
    );
    expect(parsed.success).toBe(false);
  });
});

describe("planSaveDay attempts", () => {
  it("attempts yoksa boş plan döner", () => {
    const plan = planSaveDay([], input());
    expect(plan.attempts).toEqual([]);
  });

  it("TYT kayıtlarında boş değerini sunucuda yeniden hesaplar", () => {
    const plan = planSaveDay(
      [],
      input({
        attempts: [
          { denemeKey: "tyt", correct: 70, wrong: 30, blank: 1 },
          {
            denemeKey: "brans:matematik",
            correct: 40,
            wrong: 10,
            blank: 70,
          },
        ],
      }),
    );
    expect(plan.attempts).toEqual([
      { denemeKey: "tyt", correct: 70, wrong: 30, blank: 20 },
      { denemeKey: "brans:matematik", correct: 40, wrong: 10, blank: 70 },
    ]);
  });

  it("aynı girdiyle tekrar aynı planı üretir (attempts dahil idempotent)", () => {
    const payload = input({
      attempts: [{ denemeKey: "ayt", correct: 50, wrong: 30, blank: 60 }],
    });
    expect(planSaveDay([], payload)).toEqual(planSaveDay([], payload));
  });
});