import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildAnalysisTopicNote,
  cleanExamName,
  findCurriculumTopicId,
  normalizeTrKey,
  normalizeTrName,
  parseExamAnalysisWorkbooks,
  type CurriculumTopicMatchRow,
} from "./exam-analysis";

function workbookBase64(sheets: Record<string, unknown[][]>): string {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      name,
    );
  }
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

const summaryHeaders = [
  "Öğrenci Adı",
  "Sınıf",
  "Ders Grubu",
  "Ders",
  "Konu",
  "Soru Sayısı",
  "Doğru",
  "Yanlış",
  "Boş",
  "Net",
  "Başarı (%)",
  "Durum",
];

const detailHeaders = [
  "Öğrenci Adı",
  "Sınıf",
  "Ders Grubu",
  "Ders",
  "Konu",
  "Kazanım",
  "Soru Sayısı",
  "Doğru",
  "Yanlış",
  "Boş",
  "Net",
  "Başarı (%)",
  "Durum",
];

const examHeaders = [
  "Öğrenci Adı",
  "Sınıf",
  "Sınav Adı",
  "Sınav Tarihi",
  "Toplam Net",
];

const priorityHeaders = [
  "Sube",
  "Numara",
  "Adi",
  "Ders",
  "Konu Id",
  "Konu",
  "Dogru",
  "Yanlis",
  "Bos",
  "Net",
  "Kayıp Puan",
  "Yuzde",
  "Oncelik",
  "Oncelik Sira",
];

describe("parseExamAnalysisWorkbooks", () => {
  it("geometri konularini iki dosyada da TYT-GEO olarak birlestirir", () => {
    const consolidated = workbookBase64({
      "Konu Özet": [
        summaryHeaders,
        [
          "Ada Yılmaz",
          "12-A",
          "TYT-MAT",
          "Matematik",
          "Üçgende Açılar",
          4,
          1,
          3,
          0,
          0,
          25,
          "🔴 Acil Çalış",
        ],
      ],
      "Konu Detay": [
        detailHeaders,
        [
          "Ada Yılmaz",
          "12-A",
          "TYT-MAT",
          "Matematik",
          "Üçgende Açılar",
          "Açıortay Bağıntıları",
          2,
          0,
          2,
          0,
          0,
          0,
          "🔴 Acil Çalış",
        ],
      ],
      "Sınav Bilgileri": [
        examHeaders,
        [
          "Ada Yılmaz",
          "12-A",
          "ÖZDEBİR TYT-1 ÖZDEBİR TYT-1",
          "21.10.2026",
          21.5,
        ],
      ],
    });
    const priority = workbookBase64({
      Analiz: [
        priorityHeaders,
        [
          "A",
          "101",
          "ADA YILMAZ",
          "Geometri",
          376,
          "Üçgende Açılar",
          1,
          3,
          0,
          -0.25,
          7.61,
          25,
          1,
          1,
        ],
      ],
    });

    const result = parseExamAnalysisWorkbooks(consolidated, priority);

    expect(result.counts).toEqual({
      studentCount: 1,
      examCount: 1,
      topicCount: 1,
      outcomeCount: 1,
      priorityTopicCount: 1,
    });
    const student = result.students[0];
    expect(student.studentNumber).toBe("101");
    expect(student.exams[0].examName).toBe("ÖZDEBİR TYT-1");
    expect(student.exams[0].examDate).toBe("2026-10-21");
    expect(student.topics[0]).toMatchObject({
      subjectName: "Geometri",
      subjectGroup: "TYT-GEO",
      topicName: "Üçgende Açılar",
      correct: 1,
      wrong: 3,
      blank: 0,
      net: 0.25,
      successPct: 25,
      statusLabel: "🔴 Acil Çalış",
      priorityLevel: 1,
      priorityOrder: 1,
      lostPoints: 7.61,
    });
    expect(student.topics[0].outcomes[0]).toMatchObject({
      kazanimName: "Açıortay Bağıntıları",
      correct: 0,
      wrong: 2,
      net: -0.5,
      successPct: 0,
    });
  });

  it("sadece oncelik listesinde olan ogrenciyi de dahil eder", () => {
    const consolidated = workbookBase64({
      "Konu Özet": [
        summaryHeaders,
        [
          "Ada Yılmaz",
          "12-A",
          "TYT-TRK",
          "Türkçe",
          "Paragrafın Ana Düşüncesi",
          10,
          4,
          4,
          2,
          0,
          40,
          "🟡 Tekrar Et",
        ],
      ],
    });
    const priority = workbookBase64({
      Analiz: [
        priorityHeaders,
        [
          "B",
          "202",
          "Bora Demir",
          "Matematik",
          478,
          "Sayı Problemleri",
          10,
          3,
          5,
          2,
          9.25,
          30,
          2,
          4,
        ],
      ],
    });

    const result = parseExamAnalysisWorkbooks(consolidated, priority);
    const bora = result.students.find((student) => student.name === "Bora Demir");

    expect(result.counts.studentCount).toBe(2);
    expect(bora?.topics[0]).toMatchObject({
      subjectName: "Matematik",
      topicName: "Sayı Problemleri",
      priorityLevel: 2,
      lostPoints: 9.25,
      correct: 10,
      wrong: 3,
      blank: 5,
      successPct: 56,
    });
  });

  it("agirlikli basari yuzdesine gore durum etiketi uretir", () => {
    const consolidated = workbookBase64({
      "Konu Özet": [
        summaryHeaders,
        ["Ada Yılmaz", "12-A", "TYT-TRK", "Türkçe", "Paragraf", 10, 9, 1, 0, 0, 0, ""],
        ["Ada Yılmaz", "12-A", "TYT-TRK", "Türkçe", "Cümlede Anlam", 10, 7, 3, 0, 0, 0, ""],
        ["Ada Yılmaz", "12-A", "TYT-TRK", "Türkçe", "Sözcükte Anlam", 10, 5, 5, 0, 0, 0, ""],
      ],
    });
    const priority = workbookBase64({
      Analiz: [priorityHeaders],
    });

    const result = parseExamAnalysisWorkbooks(consolidated, priority);
    const labels = new Map(
      result.students[0].topics.map((topic) => [topic.topicName, topic.statusLabel]),
    );

    expect(labels.get("Paragraf")).toBe("⭐ Mükemmel");
    expect(labels.get("Cümlede Anlam")).toBe("🟢 İyi");
    expect(labels.get("Sözcükte Anlam")).toBe("🟡 Tekrar Et");
  });
});

describe("normalizeTrKey", () => {
  it("buyuk harfli ve normal yazimli adlari ayni anahtara indirir", () => {
    expect(normalizeTrKey("OLMAYAN OGRENCI KK")).toBe(
      normalizeTrKey("Olmayan Ogrenci KK"),
    );
    expect(normalizeTrKey("TEST ÖĞRENCİ")).toBe(
      normalizeTrKey("Test Öğrenci"),
    );
    expect(normalizeTrKey("ELİF YILMAZ")).toBe(normalizeTrKey("Elif Yılmaz"));
  });
});

describe("normalizeTrName", () => {
  it("turkce karakterleri ASCII karsiliklarina katlar", () => {
    expect(normalizeTrName("Şener ÇANKAYA")).toBe("SENERCANKAYA");
    expect(normalizeTrName("SENER CANKAYA")).toBe(normalizeTrName("Şener ÇANKAYA"));
    expect(normalizeTrName("Öğrenci İsmi")).toBe("OGRENCIISMI");
    expect(normalizeTrName("Âlî Çağrı")).toBe("ALICAGRI");
    expect(normalizeTrName("IŞIK ÖZTÜRK")).toBe("ISIKOZTURK");
  });

  it("bosluk ve noktalama isaretlerini temizler", () => {
    expect(normalizeTrName("  Ahmet  KİREMİTÇİ. ")).toBe("AHMETKIREMITCI");
    expect(normalizeTrName("Ayşe-Nur (DEMİR)")).toBe("AYSENURDEMIR");
    expect(normalizeTrName("")).toBe("");
    expect(normalizeTrName(null)).toBe("");
  });
});

describe("parseExamAnalysisWorkbooks birlestirme", () => {
  it("ayni ogrenciyi iki dosyada farkli harf bicimiyle tek kayda indirir", () => {
    const consolidated = workbookBase64({
      "Konu Özet": [
        summaryHeaders,
        [
          "Test Öğrenci", "12-A", "TYT-TRK", "Türkçe", "Paragraf",
          20, 9, 8, 3, 0, 45, "",
        ],
      ],
    });
    const priority = workbookBase64({
      Analiz: [
        priorityHeaders,
        [
          "A", "101", "TEST ÖĞRENCİ", "Türkçe", 200, "Paragraf",
          9, 8, 3, 5, 12.75, 45, 1, 1,
        ],
      ],
    });

    const result = parseExamAnalysisWorkbooks(consolidated, priority);

    expect(result.counts.studentCount).toBe(1);
    expect(result.students[0].studentNumber).toBe("101");
    expect(result.students[0].topics).toHaveLength(1);
    expect(result.students[0].topics[0]).toMatchObject({
      topicName: "Paragraf",
      priorityLevel: 1,
      lostPoints: 12.75,
    });
  });
});

const curriculumRows: CurriculumTopicMatchRow[] = [
  { id: 4, subjectId: "turkce", topicName: "Paragrafın Anlamı ve Yapısı" },
  { id: 31, subjectId: "matematik", topicName: "Üslü Sayılar" },
  { id: 32, subjectId: "matematik", topicName: "Köklü Sayılar" },
  { id: 476, subjectId: "matematik", topicName: "Bölünebilme Kuralları" },
  { id: 478, subjectId: "matematik", topicName: "Problemler" },
  { id: 380, subjectId: "geometri", topicName: "Açıortay" },
  { id: 385, subjectId: "geometri", topicName: "Dörtgenler" },
  { id: 485, subjectId: "geometri", topicName: "Deltoid" },
  { id: 388, subjectId: "geometri", topicName: "Katı Cisimler" },
  { id: 44, subjectId: "tyt-fizik", topicName: "Hareket ve Kuvvet" },
];

describe("findCurriculumTopicId", () => {
  it.each([
    ["Paragraf", "Türkçe", 4],
    ["Paragrafın Ana Düşüncesi", "Türkçe", 4],
    ["Üslü İfadeler", "Matematik", 31],
    ["Köklü İfadeler", "Matematik", 32],
    ["Bölünebilme", "Matematik", 476],
    ["Bölme - Bölünebilme", "Matematik", 476],
    ["Sayı Problemleri", "Matematik", 478],
    ["Üçgende Açıortay", "Geometri", 380],
    ["Dörtgenler-Deltoid", "Geometri", 385],
    ["Prizmalar", "Geometri", 388],
    ["Kuvvet ve Hareket", "Fizik", 44],
  ] as const)("%s", (topicName, subjectName, expected) => {
    expect(
      findCurriculumTopicId(topicName, subjectName, curriculumRows),
    ).toBe(expected);
  });

  it("eslesmeyen konu icin null doner", () => {
    expect(
      findCurriculumTopicId("Uzaylı Yaşam Formları", "Biyoloji", curriculumRows),
    ).toBeNull();
  });
});

describe("analysis helpers", () => {
  it("tekrar eden sinav adini temizler", () => {
    expect(cleanExamName("ÖZDEBİR TYT-1 ÖZDEBİR TYT-1")).toBe(
      "ÖZDEBİR TYT-1",
    );
    expect(cleanExamName("MEBİ TYT-1")).toBe("MEBİ TYT-1");
  });

  it("tek kelime sayili tekrarli adlarda kod parcasini korur", () => {
    expect(
      cleanExamName("ÖZDEBİR İLK PROVA TYT ÖZDEBİR İLK PROVA TYT (T1226)"),
    ).toBe("ÖZDEBİR İLK PROVA TYT (T1226)");
    expect(
      cleanExamName("ÖZDEBİR İLK PROVA TYT ÖZDEBİR İLK PROVA TYT"),
    ).toBe("ÖZDEBİR İLK PROVA TYT");
    expect(cleanExamName("3D TYT-2 3D TYT-2 (1224)")).toBe("3D TYT-2 (1224)");
  });

  it("tekrarsiz ve farkli sinav adlarina dokunmaz", () => {
    expect(cleanExamName("MEB 1 MEB 2")).toBe("MEB 1 MEB 2");
    expect(cleanExamName("TÜRKÇE TÜRKÇE SOSYAL")).toBe("TÜRKÇE TÜRKÇE SOSYAL");
    expect(cleanExamName("")).toBe("");
  });

  it("planner notuna donem, kayip puan ve zayif kazanimlari yazar", () => {
    const note = buildAnalysisTopicNote({
      periodTitle: "Ekim Ayı Analizi",
      priorityLevel: 1,
      lostPoints: 7.61,
      outcomes: [
        { kazanimName: "Paragraf Oluşturma", successPct: 0 },
        { kazanimName: "Düşünce Akışını Bozan Cümle", successPct: 50 },
        { kazanimName: "Güçlü Kazanım", successPct: 90 },
      ],
    });

    expect(note).toContain("Ekim Ayı Analizi");
    expect(note).toContain("1. Öncelik");
    expect(note).toContain("7,61 Kayıp Puan");
    expect(note).toContain("Paragraf Oluşturma (%0)");
    expect(note).not.toContain("Güçlü Kazanım");
  });
});
