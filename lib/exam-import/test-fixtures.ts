import type { CellValue, SheetMatrix } from "./parse-tyt-results";

export interface FixtureScore {
  d: number;
  y: number;
  n: number;
}

export interface FixtureStudent {
  number: CellValue;
  name: string;
  scores: Record<string, FixtureScore>;
  puan?: number;
  toplam?: FixtureScore;
}

export interface BuildSheetOptions {
  secFelsefe?: boolean;
  netSirali?: boolean;
  brokenHeaders?: boolean;
  brokenSubjectLabels?: boolean;
  omitSubjects?: string[];
  textNumbers?: boolean;
  students: FixtureStudent[];
  extraRows?: CellValue[][];
}

const BLOCK_ORDER = [
  "TÜRKÇE",
  "TARİH",
  "COĞRAFYA",
  "FELSEFE",
  "DİN KÜLTÜRÜ",
  "MATEMATİK",
  "GEOMETRİ",
  "FİZİK",
  "KİMYA",
  "BİYOLOJİ",
  "TOPLAM",
];

export function score(d: number, y: number): FixtureScore {
  return { d, y, n: Math.round((d - y / 4) * 100) / 100 };
}

export function buildSheet(options: BuildSheetOptions): SheetMatrix {
  const labels = BLOCK_ORDER.filter(
    (label) => !options.omitSubjects?.includes(label),
  );
  if (options.secFelsefe) {
    labels.splice(labels.indexOf("MATEMATİK"), 0, "SEÇ. FELSEFE");
  }

  const groupRow: CellValue[] = [
    "",
    "",
    "",
    "",
    "",
    "TYT-TÜRKÇE",
    "",
    "",
    "TYT-SOSYAL BİLİMLER",
    "",
    "",
    "TYT-MATEMATİK",
    "",
    "",
    "TYT-FEN BİLİMLERİ",
    "",
    "",
    "TOPLAM",
    "TYT",
  ];
  const subjectRow: CellValue[] = ["", "", "", "", ""];
  const headerRow: CellValue[] = [
    "NO",
    options.brokenHeaders ? "?UBE" : "ŞUBE",
    "Numara",
    "AD VE SOYAD",
    "ALAN",
  ];

  const blockStarts: Record<string, number> = {};
  for (const label of labels) {
    const isTotal = label === "TOPLAM";
    let subjectLabel = label;
    if (options.brokenSubjectLabels && label === "DİN KÜLTÜRÜ") {
      subjectLabel = "D?N KÜLTÜRÜ";
    }
    blockStarts[label] = subjectRow.length;
    subjectRow.push(subjectLabel, "", "");
    if (options.netSirali) {
      subjectRow.push("");
      headerRow.push("Sıra", "D", "Y", isTotal ? "NET" : "N");
    } else {
      headerRow.push("D", "Y", isTotal ? "NET" : "N");
    }
  }
  blockStarts["TYT PUANI"] = subjectRow.length;
  subjectRow.push("TYT");
  headerRow.push(
    "TYT PUANI",
    "GENEL",
    "KURUM",
    "ŞUBE",
    options.brokenHeaders ? "S?N" : "SINIF",
    "OSYM23",
    "OSYM24",
    "OSYM25",
  );

  const format = (value: number): CellValue => {
    if (!options.textNumbers) return value;
    return String(value).replace(".", ",");
  };

  const rows: CellValue[][] = [];
  options.students.forEach((student, seq) => {
    const row: CellValue[] = new Array(headerRow.length).fill("");
    row[0] = seq + 1;
    row[1] = "A";
    row[2] = student.number;
    row[3] = student.name;
    row[4] = "SAYISAL";

    let subjectSum = 0;
    for (const label of labels) {
      let col = blockStarts[label];
      if (options.netSirali) {
        row[col] = seq + 1;
        col += 1;
      }
      let s = student.scores[label];
      if (!s) {
        if (label === "TOPLAM") {
          s = {
            d: Math.round(subjectSum * 100) / 100,
            y: 0,
            n: Math.round(subjectSum * 100) / 100,
          };
        } else {
          s = { d: 0, y: 0, n: 0 };
        }
      }
      if (label !== "TOPLAM") subjectSum += s.n;
      row[col] = format(s.d);
      row[col + 1] = format(s.y);
      row[col + 2] = format(s.n);
    }
    if (student.toplam && labels.includes("TOPLAM")) {
      const col = blockStarts["TOPLAM"] + (options.netSirali ? 1 : 0);
      row[col] = format(student.toplam.d);
      row[col + 1] = format(student.toplam.y);
      row[col + 2] = format(student.toplam.n);
    }
    row[blockStarts["TYT PUANI"]] = format(student.puan ?? 300);
    row[blockStarts["TYT PUANI"] + 1] = 1;
    row[blockStarts["TYT PUANI"] + 2] = 2;
    row[blockStarts["TYT PUANI"] + 3] = "A";
    row[blockStarts["TYT PUANI"] + 4] = "10";
    row[blockStarts["TYT PUANI"] + 5] = 3;
    row[blockStarts["TYT PUANI"] + 6] = 4;
    row[blockStarts["TYT PUANI"] + 7] = 5;
    rows.push(row);
  });

  for (const extra of options.extraRows ?? []) {
    rows.push(extra);
  }

  return [groupRow, subjectRow, headerRow, ...rows];
}

export function defaultScores(): Record<string, FixtureScore> {
  return {
    TÜRKÇE: score(30, 8),
    TARİH: score(4, 1),
    COĞRAFYA: score(3, 1),
    FELSEFE: score(4, 0),
    "DİN KÜLTÜRÜ": score(3, 1),
    MATEMATİK: score(18, 2),
    GEOMETRİ: score(7, 1),
    FİZİK: score(5, 1),
    KİMYA: score(5, 0),
    BİYOLOJİ: score(4, 1),
  };
}
