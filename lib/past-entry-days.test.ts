import { describe, expect, it } from "vitest";
import {
  dayLabel,
  groupPastRows,
  paginatePastGroups,
  type PastDayGroup,
  type PastRowInput,
} from "./past-entry-days";

function row(overrides: Partial<PastRowInput> = {}): PastRowInput {
  return {
    id: 1,
    date: "2026-10-02",
    examType: "TYT",
    subjectName: "Türkçe",
    topicName: "Paragraf",
    correct: 8,
    wrong: 2,
    blank: 0,
    ...overrides,
  };
}

function group(date: string): PastDayGroup {
  return {
    date,
    label: date,
    isYesterday: false,
    summary: null,
    topics: [],
    questions: 0,
    net: 0,
  };
}

describe("dayLabel", () => {
  it("dünü 'Dün ·' etiketiyle verir (hafta günü yok)", () => {
    const result = dayLabel("2026-10-02", "2026-10-03");
    expect(result).toEqual({
      label: "Dün · 2 Ekim 2026",
      isYesterday: true,
    });
  });

  it("diğer günleri '2 Ekim 2026, Cuma' formatında verir", () => {
    const result = dayLabel("2026-10-02", "2026-10-04");
    expect(result.isYesterday).toBe(false);
    expect(result.label).toBe("2 Ekim 2026, Cuma");
  });
});

describe("groupPastRows", () => {
  it("bugünü hariç tutar", () => {
    const groups = groupPastRows(
      [
        row({ id: 1, date: "2026-10-04" }),
        row({ id: 2, date: "2026-10-03" }),
      ],
      {},
      "2026-10-04",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe("2026-10-03");
  });

  it("UTC günü henüz geçmemiş olsa da İstanbul tarihine göre doğru günü kullanır", () => {
    // 3 Ekim 2026 23:30 UTC -> İstanbul'ta hâlâ 3 Ekim 22:30 (4 değil),
    // bugün İstanbul tarihi 4 Ekim ise satır 3 Ekim'de kalır.
    const groups = groupPastRows(
      [row({ date: "2026-10-03" })],
      {},
      "2026-10-04",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe("2026-10-03");
    expect(groups[0].isYesterday).toBe(true);
  });

  it("satırları tarihe göre gruplar ve yeniden eskiye sıralar", () => {
    const groups = groupPastRows(
      [
        row({ id: 1, date: "2026-10-01" }),
        row({ id: 2, date: "2026-10-03" }),
        row({ id: 3, date: "2026-10-03", topicName: "Noktalama" }),
        row({ id: 4, date: "2026-10-01", topicName: "Yazım Kuralları" }),
      ],
      {},
      "2026-10-04",
    );
    expect(groups.map((g) => g.date)).toEqual(["2026-10-03", "2026-10-01"]);
    expect(groups[0].topics).toHaveLength(2);
    expect(groups[1].topics).toHaveLength(2);
  });

  it("gün toplamlarını netScore ile hesaplar", () => {
    const groups = groupPastRows(
      [
        row({ id: 1, date: "2026-10-03", correct: 8, wrong: 2 }),
        row({
          id: 2,
          date: "2026-10-03",
          topicName: "Noktalama",
          correct: 10,
          wrong: 0,
        }),
      ],
      {},
      "2026-10-04",
    );
    const day = groups[0];
    expect(day.topics).toHaveLength(2);
    expect(day.questions).toBe(20);
    expect(day.net).toBe(17.5);
    expect(day.topics[0].net).toBe(7.5);
    expect(day.topics[1].net).toBe(10);
  });

  it("özet notu ilgili güne bağlar", () => {
    const groups = groupPastRows(
      [row({ date: "2026-10-03" }), row({ date: "2026-10-02" })],
      { "2026-10-03": "Ünite testi çözdüm." },
      "2026-10-04",
    );
    expect(groups[0].summary).toBe("Ünite testi çözdüm.");
    expect(groups[1].summary).toBeNull();
  });

  it("boş satır listesi boş grup döner", () => {
    expect(groupPastRows([], {}, "2026-10-04")).toEqual([]);
  });
});

describe("paginatePastGroups", () => {
  const groups = [
    group("2026-10-09"),
    group("2026-10-08"),
    group("2026-10-07"),
    group("2026-10-06"),
    group("2026-10-05"),
    group("2026-10-04"),
    group("2026-10-03"),
    group("2026-10-02"),
    group("2026-10-01"),
  ];

  it("ilk sayfada limit kadar gün, imleç son günün tarihi", () => {
    const page = paginatePastGroups(groups, 7);
    expect(page.days).toHaveLength(7);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("2026-10-03");
  });

  it("sonraki sayfada kalan günler, imleç güncellenir", () => {
    const rest = groups.filter((g) => g.date < "2026-10-03");
    const page = paginatePastGroups(rest, 7);
    expect(page.days.map((g) => g.date)).toEqual([
      "2026-10-02",
      "2026-10-01",
    ]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBe("2026-10-01");
  });

  it("veri kalmadığında boş sayfa ve imleç null", () => {
    const page = paginatePastGroups([], 7);
    expect(page.days).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});
