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
    summary: "Bugün 3 test çözdüm.",
    ...overrides,
  };
}

describe("saveDaySchema", () => {
  it("geçerli girdiyi onaylar", () => {
    expect(saveDaySchema.safeParse(input()).success).toBe(true);
  });

  it(`${MAX_DAY_ENTRIES + 1} satırı reddeder`, () => {
    const payload = input({
      entries: Array.from({ length: MAX_DAY_ENTRIES + 1 }, (_, i) =>
        row({ topicId: i + 1 }),
      ),
    });
    const result = saveDaySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("aynı konunun iki kez gelmesini reddeder", () => {
    const payload = input({ entries: [row(), row()] });
    const result = saveDaySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("0-300 dışındaki sayıları reddeder", () => {
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

  it("toplamı sıfır olan satırı reddeder", () => {
    const payload = input({
      entries: [row({ correct: 0, wrong: 0, blank: 0 })],
    });
    expect(saveDaySchema.safeParse(payload).success).toBe(false);
  });

  it("2000 karakterden uzun özeti reddeder", () => {
    expect(
      saveDaySchema.safeParse(input({ summary: "x".repeat(2001) }))
        .success,
    ).toBe(false);
    expect(
      saveDaySchema.safeParse(input({ summary: "x".repeat(2000) }))
        .success,
    ).toBe(true);
  });

  it("MAX_COUNT tam sınırını kabul eder", () => {
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
  it("aynı girdiyle tekrar aynı planı üretir (idempotent)", () => {
    const payload = input();
    const existing = [{ topicId: 101 }, { topicId: 999 }];
    const first = planSaveDay(existing, payload);
    const second = planSaveDay(existing, payload);
    expect(first).toEqual(second);
    expect(first.upserts).toHaveLength(1);
    expect(first.upserts[0].correct).toBe(8);
  });

  it("payload'da olmayan bugünkü satırları silmek üzere işaretler", () => {
    const payload = input({ entries: [row({ topicId: 101 })] });
    const plan = planSaveDay(
      [{ topicId: 101 }, { topicId: 55 }, { topicId: 56 }],
      payload,
    );
    expect(plan.deleteTopicIds).toEqual([55, 56]);
  });

  it("payload boşsa tüm mevcut satırları siler", () => {
    const plan = planSaveDay([{ topicId: 1 }, { topicId: 2 }], {
      entries: [],
      summary: "",
    });
    expect(plan.deleteTopicIds).toEqual([1, 2]);
  });

  it("özet varsa upsert, boşsa delete planlar", () => {
    const withSummary = planSaveDay([], input({ summary: "  Not  " }));
    expect(withSummary.note).toEqual({
      op: "upsert",
      value: "Not",
    });
    const withoutSummary = planSaveDay([], input({ summary: "   " }));
    expect(withoutSummary.note).toEqual({ op: "delete" });
  });

  it("upsert değerleri ham girdiyi korur (sayılar katlanmaz)", () => {
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

  it("pasif konuya YENİ satır eklenemez (reddet)", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 202 })],
      inactive,
      [],
    );
    expect(violation).toEqual({ kind: "new-row", topicId: 202 });
  });

  it("bugün zaten kayıtlı pasif konu aynen kalıyorsa KABUL et", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 101, correct: 8, wrong: 2, blank: 0 })],
      inactive,
      [{ topicId: 101, correct: 8, wrong: 2, blank: 0 }],
    );
    expect(violation).toBeNull();
  });

  it("bugün kayıtlı pasif konunun sayıları değişmişse REDDET", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 101, correct: 9, wrong: 1, blank: 0 })],
      inactive,
      [{ topicId: 101, correct: 8, wrong: 2, blank: 0 }],
    );
    expect(violation).toEqual({ kind: "modified-row", topicId: 101 });
  });

  it("aktif konular için hiç bakmaz", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 999, correct: 5, wrong: 5, blank: 5 })],
      inactive,
      [],
    );
    expect(violation).toBeNull();
  });

  it("karışıktaki ilk pasif ihlali döndürür", () => {
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

  it("bugün kaydı olmayan ama pasif olmayan konu ihlal sayılmaz", () => {
    const violation = findPassiveTopicViolation(
      [row({ topicId: 777 })],
      new Set([101]),
      [],
    );
    expect(violation).toBeNull();
  });
});
