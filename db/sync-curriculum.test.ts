import { describe, expect, it } from "vitest";
import {
  planCurriculumSync,
  YDT_RENAMES,
  type ExistingTopicRow,
  type TopicRename,
} from "./sync-curriculum";
import { TOPICS, type TopicSeed } from "./seed-curriculum";

function existing(
  overrides: Partial<ExistingTopicRow> & { id: number; topicName: string },
): ExistingTopicRow {
  return {
    examType: "YDT",
    subjectId: "ydt-ingilizce",
    subjectName: "Yabancı Dil (İngilizce)",
    sortOrder: 1,
    isActive: true,
    ...overrides,
  };
}

function desiredTopics(subjectId = "ydt-ingilizce"): TopicSeed[] {
  return TOPICS.filter((t) => t.subjectId === subjectId);
}

describe("planCurriculumSync", () => {
  it("gerçekçi senaryo: YDT rename id korur, eski adlar silinmez, pasifleşir", () => {
    const dbRows: ExistingTopicRow[] = [
      existing({ id: 1, topicName: "Kelime Bilgisi (Vocabulary)", sortOrder: 1 }),
      existing({ id: 2, topicName: "Gramer (Grammar)", sortOrder: 2 }),
      existing({ id: 3, topicName: "Cümle Tamamlama", sortOrder: 3 }),
      existing({ id: 4, topicName: "İngilizce - Türkçe Çeviri", sortOrder: 4 }),
      existing({ id: 5, topicName: "Türkçe - İngilizce Çeviri", sortOrder: 5 }),
      existing({ id: 6, topicName: "Okuma Parçaları (Reading)", sortOrder: 6 }),
      existing({ id: 7, topicName: "Diyalog Tamamlama", sortOrder: 7 }),
      existing({ id: 8, topicName: "Anlamı Bozan Cümle", sortOrder: 8 }),
    ];
    const plan = planCurriculumSync(dbRows, desiredTopics(), YDT_RENAMES);

    const renameIds = plan.renames.map((r) => r.id).sort((a, b) => a - b);
    expect(renameIds).toEqual([1, 2, 3, 4, 6, 8]);

    expect(plan.deactivations.map((d) => d.id)).toEqual([5]);
    expect(plan.reactivations).toHaveLength(0);

    expect(plan.inserts.map((i) => i.topicName).sort()).toEqual([
      "Anlamca Yakın Cümle (Restatement)",
      "Cloze Test (Boşluk Doldurma)",
      "Paragraf Tamamlama",
      "Verilen Durumda Söylenebilecek İfade (Situation)",
    ]);

    const renamedTo = plan.renames.map((r) => r.to);
    expect(renamedTo).toContain("Kelime Bilgisi");
    expect(renamedTo).toContain("Dil Bilgisi");
    expect(renamedTo).toContain("Cümleyi Tamamlama");
    expect(renamedTo).toContain("Çeviri (İngilizce - Türkçe / Türkçe - İngilizce)");
    expect(renamedTo).toContain("Paragraf Anlama");
    expect(renamedTo).toContain("Akışı Bozan Cümle (Irrelevant Sentence)");

    expect(plan.reorders.find((r) => r.id === 4)?.to).toBe(5);
    expect(plan.reorders.find((r) => r.id === 8)?.to).toBe(11);
  });

  it("hiçbir şekilde DELETE üretmez (plan alanında silme yok)", () => {
    const plan = planCurriculumSync(
      [existing({ id: 1, topicName: "Eski Konu" })],
      desiredTopics(),
      YDT_RENAMES,
    );
    expect(Object.keys(plan).sort()).toEqual([
      "deactivations",
      "inserts",
      "reactivations",
      "renames",
      "reorders",
    ]);
    expect(JSON.stringify(plan)).not.toContain("delete");
  });

  it("idempotent: uygulanmış durumla ikinci plan tamamen boş", () => {
    const first = planCurriculumSync([], desiredTopics(), YDT_RENAMES);
    const applied: ExistingTopicRow[] = [
      ...first.renames.map((r) =>
        existing({ id: r.id, topicName: r.to, sortOrder: 1 }),
      ),
      ...first.reorders.map((r) =>
        existing({ id: r.id, topicName: r.topicName, sortOrder: r.to }),
      ),
      ...first.inserts.map((t, index) =>
        existing({
          id: 1000 + index,
          topicName: t.topicName,
          sortOrder: t.sortOrder,
          subjectId: t.subjectId,
          examType: t.examType,
        }),
      ),
    ];
    // unique id: reorders ve renames aynı id'leri paylaşıyor olabilir → dedup
    const seen = new Set<number>();
    const deduped = applied.filter((row) =>
      seen.has(row.id) ? false : (seen.add(row.id), true),
    );

    const second = planCurriculumSync(deduped, desiredTopics(), YDT_RENAMES);
    expect(second.renames).toHaveLength(0);
    expect(second.inserts).toHaveLength(0);
    expect(second.reorders).toHaveLength(0);
    expect(second.deactivations).toHaveLength(0);
    expect(second.reactivations).toHaveLength(0);
  });

  it("ad çakışmasında rename'i atlar, eski satırı pasifleştirir", () => {
    const dbRows: ExistingTopicRow[] = [
      existing({ id: 1, topicName: "Kelime Bilgisi (Vocabulary)" }),
      existing({ id: 2, topicName: "Kelime Bilgisi" }),
    ];
    const plan = planCurriculumSync(dbRows, desiredTopics(), YDT_RENAMES);
    expect(plan.renames).toHaveLength(0);
    expect(plan.deactivations.map((d) => d.id)).toEqual([1]);
    expect(plan.inserts.map((i) => i.topicName)).not.toContain(
      "Kelime Bilgisi",
    );
    expect(plan.inserts).toHaveLength(10);
  });

  it("hedefte olmayan pasif olmayan tüm konuları pasifleştirir (grup bazlı)", () => {
    const dbRows: ExistingTopicRow[] = [
      existing({ id: 1, topicName: "Silinmiş Ders Konusu", subjectId: "eski-ders" }),
      existing({ id: 2, topicName: "Yanlış Sıra", isActive: false }),
    ];
    const plan = planCurriculumSync(dbRows, desiredTopics(), YDT_RENAMES);
    expect(plan.deactivations.map((d) => d.id)).toEqual([1]);
  });

  it("yeniden adlandırılacak pasif satırı aktifleştirir", () => {
    const dbRows: ExistingTopicRow[] = [
      existing({
        id: 1,
        topicName: "Kelime Bilgisi (Vocabulary)",
        isActive: false,
      }),
      ...desiredTopics()
        .filter((t) => t.topicName !== "Kelime Bilgisi")
        .map((t, index) =>
          existing({
            id: 100 + index,
            topicName: t.topicName,
            sortOrder: t.sortOrder,
          }),
        ),
    ];
    const plan = planCurriculumSync(dbRows, desiredTopics(), YDT_RENAMES);
    expect(plan.renames.find((r) => r.id === 1)?.to).toBe("Kelime Bilgisi");
    expect(plan.reactivations.map((r) => r.id)).toEqual([1]);
  });

  it("yeni ders (geometri) tamamen insert olarak planlanır", () => {
    const plan = planCurriculumSync(
      [],
      desiredTopics("geometri"),
      YDT_RENAMES,
    );
    expect(plan.inserts).toHaveLength(14);
    expect(plan.renames).toHaveLength(0);
    expect(plan.deactivations).toHaveLength(0);
    expect(plan.inserts.every((i) => i.subjectId === "geometri")).toBe(true);
  });

  it("sırası değişen satırı reorder eder, aynıysa dokunmaz", () => {
    const dbRows: ExistingTopicRow[] = desiredTopics().map((t, index) =>
      existing({
        id: 500 + index,
        topicName: t.topicName,
        sortOrder: t.topicName === "Kelime Bilgisi" ? 9 : t.sortOrder,
      }),
    );
    const plan = planCurriculumSync(dbRows, desiredTopics(), YDT_RENAMES);
    expect(plan.reorders).toHaveLength(1);
    expect(plan.reorders[0]).toMatchObject({ id: 500, from: 9, to: 1 });
    expect(plan.renames).toHaveLength(0);
    expect(plan.deactivations).toHaveLength(0);
    expect(plan.inserts).toHaveLength(0);
  });

  it("YDT_RENAMES hedef adları seed listesiyle birebir örtüşür", () => {
    const ydtNames = new Set(desiredTopics().map((t) => t.topicName));
    for (const rename of YDT_RENAMES) {
      expect(ydtNames.has(rename.to)).toBe(true);
      expect(ydtNames.has(rename.from)).toBe(false);
    }
  });

  it("rename listesindeki eski adlarla seed'in eski çakışması yok (from != to)", () => {
    const renames: TopicRename[] = YDT_RENAMES;
    for (const r of renames) expect(r.from).not.toBe(r.to);
  });
});
