import { describe, expect, it } from "vitest";
import {
  LEGACY_COLUMN_INDEX,
  isNetSiraliSheet,
  legacyParseRow,
  parseTytResults,
  selectImportSheet,
  suggestExamName,
  toNumber,
  validateImportedRows,
  type SheetMatrix,
} from "./parse-tyt-results";
import { buildSheet, defaultScores, score } from "./test-fixtures";

describe("parseTytResults — standart format", () => {
  const matrix = buildSheet({
    students: [
      { number: 1042, name: "AYŞE DENEME", scores: defaultScores() },
      { number: 1043, name: "MEHMET DENEME", scores: defaultScores() },
    ],
  });

  it("başlık satırını bulur, sütunları alan bazında eşler ve satırları okur", () => {
    const result = parseTytResults(matrix);

    expect(result.errors).toHaveLength(0);
    expect(result.format).toBe("Standart TYT formatı");
    expect(result.headerRow).toBe(2);
    expect(result.columnMap.studentNumber).toBe(2);
    expect(result.columnMap.turkceNet).toBe(7);
    expect(result.columnMap.tarihNet).toBe(10);
    expect(result.columnMap.matematikNet).toBe(22);
    expect(result.columnMap.biyolojiNet).toBe(34);
    expect(result.columnMap.toplamNet).toBe(37);
    expect(result.columnMap.tytPuani).toBe(38);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      studentNumber: "1042",
      studentName: "AYŞE DENEME",
      turkceNet: 28,
      tarihNet: 3.75,
      matematikNet: 17.5,
      tytPuani: 300,
    });
  });

  it("columnDetails önizleme tablosunu alan bazında üretir", () => {
    const result = parseTytResults(matrix);
    const math = result.columnDetails.find((d) => d.field === "matematikNet");
    expect(math).toMatchObject({ letter: "W", header: "N", subject: "MATEMATİK" });
    expect(result.columnDetails.some((d) => d.field === "studentNumber")).toBe(true);
  });
});

describe("parseTytResults — SEÇ. FELSEFE bloklu format", () => {
  const scores = defaultScores();
  scores["DİN KÜLTÜRÜ"] = { d: 0, y: 0, n: 0 };
  scores["SEÇ. FELSEFE"] = score(5, 0);
  const matrix = buildSheet({
    secFelsefe: true,
    students: [
      {
        number: 2001,
        name: "ZEHRA DENEME",
        scores,
        toplam: { d: 90, y: 35, n: 81.25 },
      },
    ],
  });

  it("Matematik ve sonrasını kaydırmadan okur (eski sabit indeks kaymaz)", () => {
    const result = parseTytResults(matrix);

    expect(result.errors).toHaveLength(0);
    expect(result.format).toBe("Seçmeli Felsefe sütunlu format");
    expect(result.columnMap.matematikNet).toBe(25);
    expect(result.columnMap.toplamNet).toBe(40);
    expect(result.columnMap.tytPuani).toBe(41);
    expect(result.rows[0]).toMatchObject({
      matematikNet: 17.5,
      geometriNet: 6.75,
      fizikNet: 4.75,
      kimyaNet: 5,
      biyolojiNet: 3.75,
      toplamNet: 81.25,
      tytPuani: 300,
    });
  });

  it("Seç. Felsefe netini Din Kültürü ile birleştirir ve uyarı verir", () => {
    const result = parseTytResults(matrix);

    expect(result.rows[0].dinNet).toBe(5);
    expect(
      result.warnings.some((w) =>
        w.message.includes("Seç. Felsefe, Din Kültürü ile birleştirildi"),
      ),
    ).toBe(true);
  });

  it("birleştirme bayrağı kapatılınca Seç. Felsefe yok sayılır", () => {
    const result = parseTytResults(matrix, { mergeSecFelsefe: false });
    expect(result.rows[0].dinNet).toBe(0);
    expect(
      result.warnings.some((w) => w.message.includes("yok sayıldı")),
    ).toBe(true);
  });

  it("regresyon: eski sabit indeks Paraf benzeri satırda yanlış okur", () => {
    const dataRow = matrix[3];
    const legacy = legacyParseRow(dataRow);

    expect(legacy).not.toBeNull();
    // Eski indeks matematik sütunu yerine Seç. Felsefe netini okur:
    expect(legacy!.matematikNet).toBe(5);
    expect(legacy!.toplamNet).toBe(3.75); // Biyoloji neti "toplam" sanılır
    expect(legacy!.tytPuani).toBe(90); // Toplam doğru "puan" sanılır
    expect(LEGACY_COLUMN_INDEX.matematikNet).toBe(22);

    const parsed = parseTytResults(matrix);
    expect(parsed.rows[0].matematikNet).toBe(17.5);
    expect(parsed.rows[0].toplamNet).toBe(81.25);
    expect(parsed.rows[0].tytPuani).toBe(300);
  });
});

describe("parseTytResults — NET SIRALI sayfası ve sayfa seçimi", () => {
  const netSiraliMatrix = buildSheet({
    netSirali: true,
    students: [{ number: 3001, name: "SERKAN DENEME", scores: defaultScores() }],
  });

  it("bloklardaki Sıra sütununu yok sayıp doğru eşler", () => {
    const result = parseTytResults(netSiraliMatrix);
    expect(result.errors).toHaveLength(0);
    expect(result.columnMap.turkceNet).toBe(8);
    expect(result.columnMap.matematikNet).toBe(28);
    expect(result.columnMap.toplamNet).toBe(48);
    expect(result.columnMap.tytPuani).toBe(49);
    expect(result.rows[0]).toMatchObject({
      studentNumber: "3001",
      turkceNet: 28,
      matematikNet: 17.5,
      tytPuani: 300,
    });
  });

  it("NET SIRALI adını tanır", () => {
    expect(isNetSiraliSheet("NET SIRALI")).toBe(true);
    expect(isNetSiraliSheet("net sirali")).toBe(true);
    expect(isNetSiraliSheet("TYT")).toBe(false);
  });

  it("çoklu sayfada başlık eşleşen ve NET SIRALI olmayan sayfayı seçer", () => {
    const tytMatrix = buildSheet({
      students: [{ number: 3002, name: "AYLIN DENEME", scores: defaultScores() }],
    });
    const selected = selectImportSheet([
      { name: "NET SIRALI", matrix: netSiraliMatrix },
      { name: "TYT", matrix: tytMatrix },
    ]);

    expect(selected?.sheet.name).toBe("TYT");
    expect(selected?.result.errors).toHaveLength(0);
    expect(selected?.result.rows[0].studentNumber).toBe("3002");
  });

  it("hiçbir sayfa başarılı değilse ilk sayfayı hatalarıyla döndürür", () => {
    const junk: SheetMatrix = [["a", "b"], ["c", "d"]];
    const selected = selectImportSheet([
      { name: "BOZUK", matrix: junk },
      { name: "BOZUK2", matrix: junk },
    ]);
    expect(selected?.sheet.name).toBe("BOZUK");
    expect(selected?.result.errors.length).toBeGreaterThan(0);
  });
});

describe("parseTytResults — bozuk başlıklar ve metin sayılar", () => {
  it("bozuk Türkçe karakterli başlıklarda ve ders etiketlerinde hata vermez", () => {
    const matrix = buildSheet({
      brokenHeaders: true,
      brokenSubjectLabels: true,
      students: [{ number: 4001, name: "FATMA DENEME", scores: defaultScores() }],
    });
    const result = parseTytResults(matrix);

    expect(result.errors).toHaveLength(0);
    expect(result.columnMap.studentNumber).toBe(2);
    expect(result.columnMap.dinNet).toBe(19);
    expect(result.columnMap.tytPuani).toBe(38);
    expect(result.rows).toHaveLength(1);
  });

  it("metin sayıları ve virgül ondalığı çözümler", () => {
    const matrix = buildSheet({
      textNumbers: true,
      students: [{ number: 4002, name: "ALI DENEME", scores: defaultScores() }],
    });
    const result = parseTytResults(matrix);

    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].turkceNet).toBe(28);
    expect(result.rows[0].tarihNet).toBe(3.75);
    expect(result.rows[0].tytPuani).toBe(300);
    expect(toNumber("12,5")).toBe(12.5);
    expect(toNumber("")).toBeUndefined();
    expect(toNumber(null)).toBeUndefined();
  });
});

describe("parseTytResults — hatalar ve şüpheli eşleme", () => {
  it("eksik zorunlu sütunu alan adlarıyla errors'a yazar ve kayıt bloklanır", () => {
    const matrix = buildSheet({
      omitSubjects: ["BİYOLOJİ"],
      students: [{ number: 5001, name: "NOYAN DENEME", scores: defaultScores() }],
    });
    const result = parseTytResults(matrix);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Biyoloji net");
    expect(result.rows).toHaveLength(0);
  });

  it("toplam net ders toplamıyla uyuşmayan satırlarda %5 üzeriyse şüpheli eşleme hatası verir", () => {
    const students = Array.from({ length: 10 }, (_, i) => ({
      number: 6000 + i,
      name: `DENEME ${i}`,
      scores: defaultScores(),
      toplam: { d: 0, y: 0, n: 99 },
    }));
    const result = parseTytResults(buildSheet({ students }));

    expect(
      result.errors.some((e) => e.includes("Sütun eşlemesi şüpheli")),
    ).toBe(true);
  });

  it("toplam net uyuşmazlığı %5 üstüyse (tek satırlık dosyada 1 satır) şüpheli eşleme hatası verir", () => {
    const result = parseTytResults(
      buildSheet({
        students: [
          {
            number: 6500,
            name: "DENEME TEK",
            scores: defaultScores(),
            toplam: { d: 0, y: 0, n: 99 },
          },
        ],
      }),
    );

    expect(
      result.errors.some((e) => e.includes("Sütun eşlemesi şüpheli")),
    ).toBe(true);
    expect(
      result.warnings.some((w) => w.message.includes("Toplam net")),
    ).toBe(true);
  });

  it("toplam uyuşmazlığı %5 altındaysa dosyayı bloklamaz, satır uyarısı verir", () => {
    const students = Array.from({ length: 100 }, (_, i) => ({
      number: 6800 + i,
      name: `DENEME ${i}`,
      scores: defaultScores(),
      ...(i === 0 ? { toplam: { d: 0, y: 0, n: 99 } } : {}),
    }));
    const result = parseTytResults(buildSheet({ students }));

    expect(result.errors).toHaveLength(0);
    expect(
      result.warnings.some((w) => w.message.includes("Toplam net")),
    ).toBe(true);
  });

  it("formüle uymayan ders netini satır numarasıyla uyarır", () => {
    const scores = defaultScores();
    scores["MATEMATİK"] = { d: 18, y: 2, n: 30 };
    const result = parseTytResults(
      buildSheet({ students: [{ number: 6600, name: "X", scores }] }),
    );

    expect(
      result.warnings.some(
        (w) => w.row === 4 && w.message.includes("Matematik neti"),
      ),
    ).toBe(true);
  });

  it("TYT puanı 0 ise ve 100-500 dışında ise uyarı verir", () => {
    const result = parseTytResults(
      buildSheet({
        students: [
          { number: 6700, name: "P0", scores: defaultScores(), puan: 0 },
          { number: 6701, name: "P1", scores: defaultScores(), puan: 620 },
        ],
      }),
    );

    expect(result.warnings.some((w) => w.message.includes("puan yok"))).toBe(true);
    expect(
      result.warnings.some((w) => w.message.includes("aralığının dışında")),
    ).toBe(true);
  });
});

describe("parseTytResults — satır filtreleri", () => {
  it("tekrar eden numarada uyarır ve ilkini alır", () => {
    const result = parseTytResults(
      buildSheet({
        students: [
          { number: 7001, name: "İLK", scores: defaultScores() },
          { number: 7001, name: "SONRAKİ", scores: defaultScores() },
        ],
      }),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].studentName).toBe("İLK");
    expect(
      result.warnings.some((w) => w.message.includes("tekrar ediyor")),
    ).toBe(true);
  });

  it("boş ve özet satırlarını atlar", () => {
    const matrix = buildSheet({
      students: [{ number: 7100, name: "GERÇEK", scores: defaultScores() }],
      extraRows: [
        ["", "", "", "", "", "TOPLAM", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "12,5 metin numara değil", "", "", "", "", "", "", "", ""],
      ],
    });
    const result = parseTytResults(matrix);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].studentNumber).toBe("7100");
  });
});

describe("validateImportedRows — sunucu tarafı satır doğrulaması", () => {
  it("puan ve toplam net hatalarını satır numarasıyla döndürür", () => {
    const issues = validateImportedRows([
      {
        studentNumber: "8001",
        turkceNet: 28,
        tarihNet: 3.75,
        cografyaNet: 2.75,
        felsefeNet: 4,
        dinNet: 2.75,
        matematikNet: 17.5,
        geometriNet: 6.75,
        fizikNet: 4.75,
        kimyaNet: 5,
        biyolojiNet: 3.75,
        toplamNet: 99,
        tytPuani: 620,
      },
    ]);

    expect(issues.some((i) => i.message.includes("Toplam net"))).toBe(true);
    expect(issues.some((i) => i.message.includes("aralığının dışında"))).toBe(true);
    expect(issues[0].studentNumber).toBe("8001");
    expect(issues[0].row).toBe(1);
  });

  it("geçerli satır için sorun üretmez", () => {
    const issues = validateImportedRows([
      {
        studentNumber: "8002",
        turkceNet: 28,
        tarihNet: 3.75,
        cografyaNet: 2.75,
        felsefeNet: 4,
        dinNet: 2.75,
        matematikNet: 17.5,
        geometriNet: 6.75,
        fizikNet: 4.75,
        kimyaNet: 5,
        biyolojiNet: 3.75,
        toplamNet: 79,
        tytPuani: 312.5,
      },
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe("suggestExamName", () => {
  it("uzantı, uzun sayı kodları ve alt çizgileri temizler", () => {
    expect(suggestExamName("PARAF TG TYT-1.xlsx")).toBe("PARAF TG TYT-1");
    expect(suggestExamName("okul_20241005_deneme__son.xlsx")).toBe(
      "okul deneme son",
    );
    expect(suggestExamName("TYT_4321098765.csv")).toBe("TYT");
  });
});
