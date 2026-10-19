import { describe, expect, it } from "vitest";
import { AYT_OSYM_DATA } from "./seed-osym-ayt";
import {
  normalizeTopicKey,
  planOsymSync,
  resolveSubjectId,
  seedSubjectIds,
  type OsymExistingTopicRow,
  type OsymSubjectSeed,
} from "./osym-sync";

function existing(
  overrides: Partial<OsymExistingTopicRow> & { id: number },
): OsymExistingTopicRow {
  return {
    subjectId: "cografya1",
    subjectName: "Coğrafya (S1)",
    topicName: "Konu",
    sortOrder: 0,
    ...overrides,
  };
}

describe("AYT_OSYM_DATA veri butunlugu", () => {
  it("her konuda yil sayisi ile sayim sayisi esittir", () => {
    const problems: string[] = [];
    for (const subject of AYT_OSYM_DATA) {
      for (const topic of subject.topics) {
        if (topic.counts.length !== subject.years.length) {
          problems.push(
            `${subject.subjectName} / ${topic.name}: ${topic.counts.length} sayim, ${subject.years.length} yil`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("farkli konular ayni normalize anahtarini paylasmaz", () => {
    const problems: string[] = [];
    for (const subject of AYT_OSYM_DATA) {
      const owners = new Map<string, Set<string>>();
      for (const topic of subject.topics) {
        for (const value of [topic.name, ...topic.aliases]) {
          const key = normalizeTopicKey(value);
          const set = owners.get(key) ?? new Set<string>();
          set.add(topic.name);
          owners.set(key, set);
        }
      }
      for (const [key, topics] of owners) {
        if (topics.size > 1) {
          problems.push(
            `${subject.subjectName}: "${key}" -> ${[...topics].join(" | ")}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("tum sayimlar negatif olmayan tam sayidir", () => {
    const problems: string[] = [];
    for (const subject of AYT_OSYM_DATA) {
      for (const topic of subject.topics) {
        for (const value of topic.counts) {
          if (!Number.isInteger(value) || value < 0 || value > 500) {
            problems.push(`${subject.subjectName} / ${topic.name}: ${value}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("felsefe grubu, tarih ve cografya dersleri beklenen kapsama sahiptir", () => {
    const byName = new Map(AYT_OSYM_DATA.map((s) => [s.subjectName, s]));
    expect(byName.get("Felsefe Grubu")?.topics).toHaveLength(20);
    expect(
      AYT_OSYM_DATA.find((s) => s.subjectName === "Tarih")?.subjectIds,
    ).toEqual(["tarih1", "tarih2"]);
    expect(
      AYT_OSYM_DATA.find((s) => s.subjectName === "Coğrafya")?.subjectIds,
    ).toEqual(["cografya1", "cografya2"]);
  });
});

describe("resolveSubjectId AYT eslemeleri", () => {
  it("ayt-geometri dersini mevcut geometri-ayt dersine esler", () => {
    expect(resolveSubjectId("ayt-geometri")).toBe("geometri-ayt");
    expect(resolveSubjectId("matematik-ayt")).toBe("matematik-ayt");
  });

  it("seedSubjectIds tekil ve coklu dersleri birlestirir", () => {
    expect(
      seedSubjectIds({ subjectIds: ["cografya1", "cografya2"], subjectName: "C", years: [], topics: [] }),
    ).toEqual(["cografya1", "cografya2"]);
    expect(
      seedSubjectIds({ subjectId: "ayt-geometri", subjectName: "G", years: [], topics: [] }),
    ).toEqual(["geometri-ayt"]);
  });
});

describe("planOsymSync coklu ders", () => {
  const data: OsymSubjectSeed[] = [
    {
      subjectIds: ["cografya1", "cografya2"],
      subjectName: "Coğrafya",
      years: [2026, 2025],
      topics: [
        { name: "Ekosistem", aliases: [], counts: [2, 3] },
        { name: "Yeni Konu", aliases: ["Yeni Konu Alias"], counts: [1, 1] },
      ],
    },
  ];

  it("ayni konuyu her iki derste de gunceller", () => {
    const plan = planOsymSync(
      [
        existing({ id: 1, topicName: "Ekosistem", sortOrder: 10 }),
        existing({
          id: 2,
          subjectId: "cografya2",
          subjectName: "Coğrafya (S2)",
          topicName: "Ekosistem",
          sortOrder: 60,
        }),
      ],
      data,
    );
    expect(plan.updates.map((u) => u.id).sort()).toEqual([1, 2]);
    expect(plan.updates[0].avgRecentQuestions).toBe(1);
    expect(plan.updates[0].yearlyQuestionCounts).toEqual({
      "2026": 2,
      "2025": 3,
    });
  });

  it("eksik konuyu her iki dersin altina ekler ve mevcut adi kullanir", () => {
    const plan = planOsymSync(
      [
        existing({ id: 1, topicName: "Ekosistem", sortOrder: 10 }),
        existing({
          id: 2,
          subjectId: "cografya2",
          subjectName: "Coğrafya (S2)",
          topicName: "Ekosistem",
          sortOrder: 60,
        }),
      ],
      data,
    );
    const inserts = plan.inserts.map((i) => ({
      subjectId: i.subjectId,
      subjectName: i.subjectName,
      topicName: i.topicName,
      sortOrder: i.sortOrder,
    }));
    expect(inserts).toEqual([
      {
        subjectId: "cografya1",
        subjectName: "Coğrafya (S1)",
        topicName: "Yeni Konu",
        sortOrder: 20,
      },
      {
        subjectId: "cografya2",
        subjectName: "Coğrafya (S2)",
        topicName: "Yeni Konu",
        sortOrder: 70,
      },
    ]);
  });

  it("ayt-geometri seedi geometri-ayt dersindeki konuyu gunceller", () => {
    const plan = planOsymSync(
      [
        existing({
          id: 9,
          subjectId: "geometri-ayt",
          subjectName: "Geometri AYT",
          topicName: "Katı Cisimler",
        }),
      ],
      [
        {
          subjectIds: ["ayt-geometri"],
          subjectName: "Geometri",
          years: [2026, 2025],
          topics: [{ name: "Katı Cisimler", aliases: [], counts: [2, 4] }],
        },
      ],
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe(9);
    expect(plan.inserts).toHaveLength(0);
  });

  it("hicbir ders sistemde yoksa atlar ve silme planlamaz", () => {
    const plan = planOsymSync([], data);
    expect(plan.updates).toHaveLength(0);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.skips[0].reason).toContain("Ders veritabaninda yok");
  });
});
