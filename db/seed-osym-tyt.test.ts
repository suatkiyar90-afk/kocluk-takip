import { describe, expect, it } from "vitest";
import {
  normalizeTopicKey,
  planOsymSync,
  resolveSubjectId,
  type OsymExistingTopicRow,
  type OsymSubjectSeed,
} from "./seed-osym-tyt";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021];

function existing(
  overrides: Partial<OsymExistingTopicRow> & { id: number },
): OsymExistingTopicRow {
  return {
    subjectId: "turkce",
    subjectName: "Türkçe",
    topicName: "Konu",
    sortOrder: 0,
    ...overrides,
  };
}

function subject(
  overrides: Partial<OsymSubjectSeed> = {},
): OsymSubjectSeed {
  return {
    subjectId: "turkce",
    subjectName: "Türkçe",
    years: YEARS,
    topics: [
      { name: "Sözcükte Anlam", aliases: [], counts: [3, 4, 5, 3, 4, 1] },
    ],
    ...overrides,
  };
}

describe("normalizeTopicKey", () => {
  it("buyuk-kucuk harf, kesme isareti ve noktalama duyarsizdir", () => {
    expect(normalizeTopicKey("Dünya'nın Şekli ve Hareketleri")).toBe(
      normalizeTopicKey("Dünyanın Şekli ve Hareketleri"),
    );
    expect(normalizeTopicKey("Dünya’nın Şekli ve Hareketleri")).toBe(
      normalizeTopicKey("Dünyanın Şekli ve Hareketleri"),
    );
    expect(normalizeTopicKey("EBOB - EKOK")).toBe(normalizeTopicKey("EBOB-EKOK"));
    expect(normalizeTopicKey("İş, Güç ve  Enerji")).toBe(
      normalizeTopicKey("İş güç ve enerji"),
    );
    expect(normalizeTopicKey("Isı, Sıcaklık ve Genleşme")).toBe(
      normalizeTopicKey("ISI SICAKLIK VE GENLEŞME"),
    );
  });
});

describe("resolveSubjectId", () => {
  it("tyt-geometri dersini mevcut geometri dersine esler", () => {
    expect(resolveSubjectId("tyt-geometri")).toBe("geometri");
    expect(resolveSubjectId("turkce")).toBe("turkce");
  });
});

describe("planOsymSync", () => {
  it("ayni isimli konuyu gunceller, id korunur", () => {
    const plan = planOsymSync(
      [existing({ id: 42, topicName: "Sözcükte Anlam" })],
      [subject()],
    );
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe(42);
    expect(plan.updates[0].matchedBy).toBe("name");
    expect(plan.updates[0].avgRecentQuestions).toBe(3.8);
    expect(plan.updates[0].yearlyQuestionCounts).toEqual({
      "2026": 3,
      "2025": 4,
      "2024": 5,
      "2023": 3,
      "2022": 4,
      "2021": 1,
    });
  });

  it("alias ile eslesirse mevcut konu guncellenir", () => {
    const data = subject({
      topics: [
        {
          name: "Paragraf",
          aliases: ["Paragrafın Anlamı ve Yapısı"],
          counts: [5, 5, 5, 5, 5, 0],
        },
      ],
    });
    const plan = planOsymSync(
      [existing({ id: 7, topicName: "Paragrafın Anlamı ve Yapısı" })],
      [data],
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe(7);
    expect(plan.updates[0].matchedBy).toBe("alias");
    expect(plan.updates[0].topicName).toBe("Paragrafın Anlamı ve Yapısı");
    expect(plan.inserts).toHaveLength(0);
  });

  it("sistemde yoksa yeni konu ekler ve son siradan devam eder", () => {
    const plan = planOsymSync(
      [existing({ id: 1, topicName: "Başka Konu", sortOrder: 30 })],
      [subject()],
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({
      subjectId: "turkce",
      subjectName: "Türkçe",
      topicName: "Sözcükte Anlam",
      sortOrder: 40,
    });
  });

  it("bir mevcut satir iki seed konusu tarafindan kullanilmaz", () => {
    const data = subject({
      topics: [
        { name: "Paragraf", aliases: ["Ortak Konu"], counts: [1, 1, 1, 1, 1, 1] },
        { name: "Diğer", aliases: ["Ortak Konu"], counts: [2, 2, 2, 2, 2, 2] },
      ],
    });
    const plan = planOsymSync(
      [existing({ id: 9, topicName: "Ortak Konu" })],
      [data],
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe(9);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].topicName).toBe("Diğer");
  });

  it("yil ve sayim uzunlugu uyusmazsa konuyu atlar", () => {
    const data = subject({
      topics: [{ name: "Bozuk", aliases: [], counts: [1, 2, 3] }],
    });
    const plan = planOsymSync([existing({ id: 1 })], [data]);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.skips).toHaveLength(1);
    expect(plan.skips[0].reason).toContain("Yil sayisi uyusmuyor");
  });

  it("ders sistemde yoksa tumunu atlar", () => {
    const data = subject({ subjectId: "yok-ders", subjectName: "Yok" });
    const plan = planOsymSync([existing({ id: 1 })], [data]);
    expect(plan.updates).toHaveLength(0);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.skips).toHaveLength(1);
    expect(plan.skips[0].reason).toContain("Ders veritabaninda yok");
  });

  it("eslesmeyen mevcut konulari raporlar", () => {
    const plan = planOsymSync(
      [
        existing({ id: 1, topicName: "Sözcükte Anlam" }),
        existing({ id: 2, topicName: "Eşleşmeyen Konu" }),
      ],
      [subject()],
    );
    expect(plan.unmatchedExisting).toEqual([
      { id: 2, subjectId: "turkce", topicName: "Eşleşmeyen Konu" },
    ]);
  });
});
