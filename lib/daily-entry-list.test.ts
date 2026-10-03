import { describe, expect, it } from "vitest";
import {
  MAX_COUNT,
  MAX_DAY_ENTRIES,
  addOrMergeEntry,
  draftKey,
  entryNet,
  entryQuestions,
  groupEntriesBySubject,
  listTotals,
  mergeDraftWithServer,
  parseDraft,
  restoreEntry,
  removeEntry,
  serializeDraft,
  validateEntryList,
  type ListEntry,
} from "./daily-entry-list";

function entry(overrides: Partial<ListEntry> = {}): ListEntry {
  return {
    topicId: 101,
    subjectId: "turkce",
    subjectName: "Türkçe",
    examType: "TYT",
    topicName: "Paragraf",
    correct: 8,
    wrong: 2,
    blank: 0,
    ...overrides,
  };
}

describe("addOrMergeEntry", () => {
  it("yeni konuyu listenin sonuna ekler", () => {
    const first = entry();
    const second = entry({ topicId: 102, topicName: "Sözcükte Anlam" });
    const result = addOrMergeEntry([first], second);
    expect(result.merged).toBe(false);
    expect(result.list).toHaveLength(2);
    expect(result.list[1].topicId).toBe(102);
  });

  it("aynı konu tekrar eklenirse sayıları toplar ve merged döner", () => {
    const base = entry({ correct: 5, wrong: 1, blank: 4 });
    const result = addOrMergeEntry([base], entry({ correct: 3, wrong: 1, blank: 0 }));
    expect(result.merged).toBe(true);
    expect(result.list).toHaveLength(1);
    expect(result.list[0]).toMatchObject({ correct: 8, wrong: 2, blank: 4 });
  });

  it("birleşmede sayılar MAX_COUNT sınırını aşmaz", () => {
    const base = entry({ correct: MAX_COUNT, wrong: 0, blank: 0 });
    const result = addOrMergeEntry([base], entry({ correct: 50, wrong: 0, blank: 0 }));
    expect(result.list[0].correct).toBe(MAX_COUNT);
  });

  it("orijinal listeyi değiştirmez", () => {
    const base = entry();
    addOrMergeEntry([base], entry({ correct: 1 }));
    expect(base.correct).toBe(8);
  });
});

describe("removeEntry / restoreEntry", () => {
  it("silmeyi ve geri almayı yapar", () => {
    const a = entry({ topicId: 1 });
    const b = entry({ topicId: 2 });
    const removed = removeEntry([a, b], 1);
    expect(removed).toHaveLength(1);
    const restored = restoreEntry(removed, a, 0);
    expect(restored.map((item) => item.topicId)).toEqual([1, 2]);
  });

  it("geri alda aynı konu ikinci kez girmez", () => {
    const a = entry({ topicId: 1 });
    const restored = restoreEntry([a], a, 0);
    expect(restored).toHaveLength(1);
  });
});

describe("entryQuestions / entryNet / listTotals", () => {
  it("soru sayısı ve neti hesaplar", () => {
    const e = entry({ correct: 10, wrong: 4, blank: 6 });
    expect(entryQuestions(e)).toBe(20);
    expect(entryNet(e)).toBe(9);
  });

  it("toplam konu, soru ve neti verir", () => {
    const list = [
      entry({ topicId: 1, correct: 4, wrong: 4, blank: 0 }),
      entry({ topicId: 2, correct: 10, wrong: 0, blank: 0 }),
    ];
    expect(listTotals(list)).toEqual({ topics: 2, questions: 18, net: 13 });
  });

  it("boş liste sıfırlar döner", () => {
    expect(listTotals([])).toEqual({ topics: 0, questions: 0, net: 0 });
  });
});

describe("groupEntriesBySubject", () => {
  it("derslere göre gruplar ve ara toplamı hesaplar", () => {
    const list = [
      entry({ topicId: 1, topicName: "Paragraf" }),
      entry({ topicId: 2, topicName: "Sözcükte Anlam" }),
      entry({
        topicId: 3,
        subjectId: "matematik",
        subjectName: "Temel Matematik",
        topicName: "Rasyonel Sayılar",
        correct: 4,
        wrong: 0,
        blank: 0,
      }),
    ];
    const groups = groupEntriesBySubject(list);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("TYT:turkce");
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[0].questions).toBe(20);
    expect(groups[0].net).toBe(15);
    expect(groups[1].key).toBe("TYT:matematik");
    expect(groups[1].net).toBe(4);
  });

  it("ders sırasını müfredat sırasına göre verir", () => {
    const list = [
      entry({ topicId: 1, subjectId: "fen", subjectName: "Fen Bilimleri" }),
      entry({ topicId: 2, subjectId: "turkce", subjectName: "Türkçe" }),
    ];
    const groups = groupEntriesBySubject(list);
    expect(groups.map((group) => group.subjectId)).toEqual([
      "turkce",
      "fen",
    ]);
  });
});

describe("validateEntryList", () => {
  it("geçerli listeyi onaylar", () => {
    expect(validateEntryList([entry()])).toBeNull();
  });

  it(`${MAX_DAY_ENTRIES + 1} satırı reddeder`, () => {
    const list = Array.from({ length: MAX_DAY_ENTRIES + 1 }, (_, index) =>
      entry({ topicId: index + 1 }),
    );
    expect(validateEntryList(list)).toContain("En fazla 30 satır");
  });

  it("aynı konunun tekrarını reddeder", () => {
    expect(validateEntryList([entry(), entry()])).toContain(
      "birden fazla",
    );
  });

  it("toplamı sıfır olan satırı reddeder", () => {
    expect(
      validateEntryList([
        entry({ correct: 0, wrong: 0, blank: 0 }),
      ]),
    ).toContain("en az 1");
  });

  it("aralık dışı sayıyı reddeder", () => {
    expect(
      validateEntryList([entry({ correct: MAX_COUNT + 1 })]),
    ).toContain("0 ile 300");
    expect(validateEntryList([entry({ wrong: -1 })])).toContain(
      "0 ile 300",
    );
  });

  it("ondalık sayıyı reddeder", () => {
    expect(
      validateEntryList([entry({ correct: 1.5 })]),
    ).toContain("0 ile 300");
  });
});

describe("draft serialize / restore", () => {
  const draft = {
    v: 1 as const,
    date: "2026-10-03",
    entries: [entry()],
    summary: "Bugün 3 test çözdüm.",
    savedAt: "2026-10-03T20:00:00.000Z",
  };

  it("draft anahtarı öğrenci id + tarih içerir", () => {
    expect(draftKey("abc", "2026-10-03")).toBe(
      "daily-entry-draft:abc:2026-10-03",
    );
  });

  it("serileştirip geri yükler", () => {
    const raw = serializeDraft(draft);
    expect(raw).not.toBeNull();
    expect(parseDraft(raw)).toEqual(draft);
  });

  it("bozuk JSON veya yanlış versiyonu reddeder", () => {
    expect(parseDraft("{bozuk")).toBeNull();
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 2 }))).toBeNull();
    expect(
      parseDraft(JSON.stringify({ ...draft, date: "yarin" })),
    ).toBeNull();
    expect(
      parseDraft(JSON.stringify({ ...draft, entries: "yok" })),
    ).toBeNull();
  });

  it("aşırı uzun liste içeren taslağı reddeder", () => {
    const long = {
      ...draft,
      entries: Array.from({ length: MAX_DAY_ENTRIES + 1 }, (_, i) =>
        entry({ topicId: i + 1 }),
      ),
    };
    expect(parseDraft(JSON.stringify(long))).toBeNull();
  });
});

describe("mergeDraftWithServer", () => {
  it("çakışan satırda sunucu sürümü esas alır ve çakışma sayar", () => {
    const server = [entry({ correct: 10, wrong: 0, blank: 0 })];
    const draft = {
      v: 1 as const,
      date: "2026-10-03",
      entries: [entry({ correct: 3, wrong: 1, blank: 0 })],
      summary: "",
      savedAt: "",
    };
    const result = mergeDraftWithServer(draft, server);
    expect(result.conflicts).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].correct).toBe(10);
  });

  it("taslakta olup sunucuda olmayan satırı korur", () => {
    const server = [entry({ topicId: 1 })];
    const extra = entry({ topicId: 2, topicName: "Noktalama" });
    const draft = {
      v: 1 as const,
      date: "2026-10-03",
      entries: [entry({ topicId: 1 }), extra],
      summary: "",
      savedAt: "",
    };
    const result = mergeDraftWithServer(draft, server);
    expect(result.conflicts).toBe(0);
    expect(result.entries.map((item) => item.topicId)).toEqual([1, 2]);
  });

  it("değerler aynıysa çakışma saymaz", () => {
    const server = [entry({ correct: 5 })];
    const draft = {
      v: 1 as const,
      date: "2026-10-03",
      entries: [entry({ correct: 5 })],
      summary: "",
      savedAt: "",
    };
    expect(mergeDraftWithServer(draft, server).conflicts).toBe(0);
  });
});
