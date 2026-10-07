export type CellValue = string | number | null | undefined;
export type SheetMatrix = CellValue[][];

export type NetField =
  | "turkceNet"
  | "tarihNet"
  | "cografyaNet"
  | "felsefeNet"
  | "dinNet"
  | "matematikNet"
  | "geometriNet"
  | "fizikNet"
  | "kimyaNet"
  | "biyolojiNet"
  | "toplamNet"
  | "tytPuani";

export type ImportField = NetField | "studentNumber" | "studentName";

export type ImportColumnMap = Partial<Record<ImportField, number>>;

export const NET_FIELDS: NetField[] = [
  "turkceNet",
  "tarihNet",
  "cografyaNet",
  "felsefeNet",
  "dinNet",
  "matematikNet",
  "geometriNet",
  "fizikNet",
  "kimyaNet",
  "biyolojiNet",
  "toplamNet",
  "tytPuani",
];

export const REQUIRED_IMPORT_FIELDS: ImportField[] = [
  "studentNumber",
  "turkceNet",
  "tarihNet",
  "cografyaNet",
  "felsefeNet",
  "dinNet",
  "matematikNet",
  "geometriNet",
  "fizikNet",
  "kimyaNet",
  "biyolojiNet",
  "toplamNet",
  "tytPuani",
];

export const FIELD_LABELS: Record<ImportField, string> = {
  studentNumber: "Numara",
  studentName: "Ad Soyad",
  turkceNet: "Türkçe net",
  tarihNet: "Tarih net",
  cografyaNet: "Coğrafya net",
  felsefeNet: "Felsefe net",
  dinNet: "Din Kültürü net",
  matematikNet: "Matematik net",
  geometriNet: "Geometri net",
  fizikNet: "Fizik net",
  kimyaNet: "Kimya net",
  biyolojiNet: "Biyoloji net",
  toplamNet: "Toplam net",
  tytPuani: "TYT puanı",
};

export interface ImportedExamValues {
  studentNumber: string;
  studentName?: string;
  turkceNet?: number;
  tarihNet?: number;
  cografyaNet?: number;
  felsefeNet?: number;
  dinNet?: number;
  matematikNet?: number;
  geometriNet?: number;
  fizikNet?: number;
  kimyaNet?: number;
  biyolojiNet?: number;
  toplamNet?: number;
  tytPuani?: number;
}

export interface ParseIssue {
  row?: number;
  message: string;
}

export interface ColumnDetail {
  field: ImportField;
  fieldLabel: string;
  columnIndex: number;
  letter: string;
  header: string;
  subject: string | null;
}

export interface ScoreColumns {
  correct: number | null;
  wrong: number | null;
  extraCorrect?: number | null;
  extraWrong?: number | null;
}

export interface ParseTytResults {
  sheetName?: string;
  format: string;
  headerRow: number;
  subjectRow: number;
  columnMap: ImportColumnMap;
  columnDetails: ColumnDetail[];
  scoreColumns: Partial<Record<NetField, ScoreColumns>>;
  rows: ImportedExamValues[];
  warnings: ParseIssue[];
  errors: string[];
}

export interface ParseOptions {
  mergeSecFelsefe?: boolean;
  columnOverrides?: Partial<Record<ImportField, number>>;
}

export const NET_LIMITS: Record<
  Exclude<NetField, "tytPuani">,
  { max: number; label: string }
> = {
  turkceNet: { max: 40, label: "Türkçe" },
  tarihNet: { max: 5, label: "Tarih" },
  cografyaNet: { max: 5, label: "Coğrafya" },
  felsefeNet: { max: 5, label: "Felsefe" },
  dinNet: { max: 5, label: "Din Kültürü" },
  matematikNet: { max: 30, label: "Matematik" },
  geometriNet: { max: 10, label: "Geometri" },
  fizikNet: { max: 7, label: "Fizik" },
  kimyaNet: { max: 7, label: "Kimya" },
  biyolojiNet: { max: 6, label: "Biyoloji" },
  toplamNet: { max: 120, label: "Toplam" },
};

export const SUBJECT_FIELDS: Array<{
  field: NetField;
  label: string;
  patterns: string[];
}> = [
  { field: "turkceNet", label: "Türkçe", patterns: ["turkce"] },
  { field: "tarihNet", label: "Tarih", patterns: ["tarih"] },
  { field: "cografyaNet", label: "Coğrafya", patterns: ["cografya"] },
  { field: "dinNet", label: "Din Kültürü", patterns: ["din kulturu", "din kultur"] },
  { field: "matematikNet", label: "Matematik", patterns: ["matematik"] },
  { field: "geometriNet", label: "Geometri", patterns: ["geometri"] },
  { field: "fizikNet", label: "Fizik", patterns: ["fizik"] },
  { field: "kimyaNet", label: "Kimya", patterns: ["kimya"] },
  { field: "biyolojiNet", label: "Biyoloji", patterns: ["biyoloji"] },
  { field: "toplamNet", label: "Toplam", patterns: ["toplam"] },
  { field: "felsefeNet", label: "Felsefe", patterns: ["felsefe"] },
];

const SEC_FELSEFE_PATTERNS = ["sec felsefe", "secmeli felsefe"];

const TOTAL_TOLERANCE = 0.1;
const FORMULA_TOLERANCE = 0.02;
const SUSPICIOUS_RATIO = 0.05;

export function normalizeLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9?]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function labelMatches(candidate: string, target: string): boolean {
  if (candidate === target) return true;
  if (candidate.length !== target.length) return false;
  for (let i = 0; i < candidate.length; i++) {
    const a = candidate[i];
    const b = target[i];
    if (a === "?" || b === "?") continue;
    if (a !== b) return false;
  }
  return true;
}

function labelMatchesAny(candidate: string, patterns: string[]): boolean {
  if (!candidate) return false;
  for (const pattern of patterns) {
    if (labelMatches(candidate, pattern)) return true;
    if (
      candidate.startsWith(`${pattern} `) ||
      candidate.includes(` ${pattern}`) ||
      candidate.includes(` ${pattern} `)
    ) {
      return true;
    }
  }
  return false;
}

export function columnLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function toNumber(value: CellValue): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
  }
  const text = String(value).trim();
  if (!text) return undefined;
  const parsed = parseFloat(text.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : undefined;
}

export function normalizeStudentNumber(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : "";
  }
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return text;
  if (/^\d+\.0+$/.test(text)) return text.split(".")[0];
  return "";
}

function cellText(row: SheetMatrix[number], index: number): string {
  const value = row?.[index];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

interface FieldHeader {
  kind:
    | "correct"
    | "wrong"
    | "net"
    | "studentNumber"
    | "studentName"
    | "score"
    | null;
}

function classifyHeader(header: string): FieldHeader {
  const norm = normalizeLabel(header);
  if (norm === "d") return { kind: "correct" };
  if (norm === "y") return { kind: "wrong" };
  if (norm === "n" || norm === "net") return { kind: "net" };
  if (norm === "numara") return { kind: "studentNumber" };
  if (norm === "ad ve soyad" || norm === "ad soyad") return {
    kind: "studentName",
  };
  if (norm === "tyt puani" || norm === "tyt puan") return { kind: "score" };
  return { kind: null };
}

function findHeaderRowFast(matrix: SheetMatrix): number {
  const scanLimit = Math.min(matrix.length, 12);
  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (classifyHeader(cellText(row, c)).kind === "studentNumber") return i;
    }
  }
  return -1;
}

function matchSubject(label: string): { key: string; field: NetField | null } | null {
  const norm = normalizeLabel(label);
  if (!norm) return null;
  if (labelMatchesAny(norm, SEC_FELSEFE_PATTERNS)) {
    return { key: "secFelsefe", field: null };
  }
  for (const subject of SUBJECT_FIELDS) {
    if (labelMatchesAny(norm, subject.patterns)) {
      return { key: subject.field, field: subject.field };
    }
  }
  return null;
}

function buildSubjectRowLabels(
  matrix: SheetMatrix,
  subjectRow: number,
  width: number,
): Array<{ key: string; field: NetField | null; raw: string } | null> {
  const labels: Array<{ key: string; field: NetField | null; raw: string } | null> =
    new Array(width).fill(null);
  const row = matrix[subjectRow] ?? [];
  let current: { key: string; field: NetField | null; raw: string } | null = null;
  for (let c = 0; c < width; c++) {
    const raw = cellText(row, c);
    if (raw) {
      const matched = matchSubject(raw);
      current = matched ? { ...matched, raw } : null;
    }
    labels[c] = current;
  }
  return labels;
}

export function parseTytResults(
  matrix: SheetMatrix,
  options: ParseOptions = {},
): ParseTytResults {
  const mergeSecFelsefe = options.mergeSecFelsefe !== false;
  const warnings: ParseIssue[] = [];
  const errors: string[] = [];
  const columnMap: ImportColumnMap = {};
  const columnDetails: ColumnDetail[] = [];
  const scoreColumns: Partial<Record<NetField, ScoreColumns>> = {};
  const rows: ImportedExamValues[] = [];

  const headerRow = findHeaderRowFast(matrix);
  if (headerRow === -1) {
    return {
      format: "Bilinmeyen format",
      headerRow: -1,
      subjectRow: -1,
      columnMap,
      columnDetails,
      scoreColumns,
      rows,
      warnings,
      errors: ['Başlık satırı bulunamadı: "Numara" başlıklı satır yok.'],
    };
  }

  const header = matrix[headerRow] ?? [];
  const width = Math.max(header.length, ...(matrix.slice(0, headerRow + 1).map((r) => r.length)));
  const subjectRow = headerRow - 1;
  const subjectLabels =
    subjectRow >= 0
      ? buildSubjectRowLabels(matrix, subjectRow, width)
      : new Array(width).fill(null);

  const colMap = options.columnOverrides ?? {};

  let secFound = false;
  const seenFields = new Map<ImportField, number>();

  for (let c = 0; c < width; c++) {
    const headerText = cellText(header, c);
    const classified = classifyHeader(headerText);
    const subjectLabel = subjectLabels[c];
    const detail = (field: ImportField, subject: string | null): void => {
      if (seenFields.has(field)) {
        warnings.push({
          message: `${FIELD_LABELS[field]} sütunu birden fazla bulundu; ilk sütun kullanıldı (sütun ${columnLetter(seenFields.get(field)!)}).`,
        });
        return;
      }
      seenFields.set(field, c);
      columnMap[field] = c;
      columnDetails.push({
        field,
        fieldLabel: FIELD_LABELS[field],
        columnIndex: c,
        letter: columnLetter(c),
        header: headerText || subjectLabel?.raw || columnLetter(c),
        subject,
      });
    };

    if (classified.kind === "studentNumber") {
      detail("studentNumber", null);
      continue;
    }
    if (classified.kind === "studentName") {
      detail("studentName", null);
      continue;
    }
    if (classified.kind === "score") {
      detail("tytPuani", null);
      continue;
    }
    if (classified.kind === "net" && subjectLabel?.field) {
      detail(subjectLabel.field, subjectLabel.raw);
      continue;
    }
    if (classified.kind === "net" && subjectLabel?.key === "secFelsefe") {
      secFound = true;
      if (mergeSecFelsefe) {
        // Seç. Felsefe neti Din Kültürü'ne eklenir; ayrı sütun olarak eşlenmez.
        continue;
      }
      continue;
    }
    if (classified.kind === "correct" && subjectLabel) {
      const field = subjectLabel.field;
      if (field) {
        const existing = scoreColumns[field] ?? { correct: null, wrong: null };
        if (existing.correct === null) existing.correct = c;
        scoreColumns[field] = existing;
      }
      continue;
    }
    if (classified.kind === "wrong" && subjectLabel) {
      const field = subjectLabel.field;
      if (field) {
        const existing = scoreColumns[field] ?? { correct: null, wrong: null };
        if (existing.wrong === null) existing.wrong = c;
        scoreColumns[field] = existing;
      }
      continue;
    }
  }

  // Seç. Felsefe D/Y/N bloğu: Din Kültürü ile birleştirme için blok konumu bul.
  let secBlock: { net: number; correct: number | null; wrong: number | null } | null =
    null;
  if (secFound) {
    for (let c = 0; c < width; c++) {
      const subjectLabel = subjectLabels[c];
      if (subjectLabel?.key !== "secFelsefe") continue;
      const kind = classifyHeader(cellText(header, c)).kind;
      if (kind === "net") {
        const startCol = c;
        let correct: number | null = null;
        let wrong: number | null = null;
        for (let k = 1; k <= 2 && startCol - k >= 0; k++) {
          const prevKind = classifyHeader(cellText(header, startCol - k)).kind;
          const prevLabel = subjectLabels[startCol - k];
          if (prevLabel?.key !== "secFelsefe") break;
          if (prevKind === "wrong") wrong = startCol - k;
          if (prevKind === "correct") correct = startCol - k;
        }
        secBlock = { net: startCol, correct, wrong };
        break;
      }
    }
    if (secBlock) {
      const dinScore = scoreColumns.dinNet ?? { correct: null, wrong: null };
      dinScore.extraCorrect = secBlock.correct;
      dinScore.extraWrong = secBlock.wrong;
      scoreColumns.dinNet = dinScore;
      warnings.push({
        message: mergeSecFelsefe
          ? "Seç. Felsefe, Din Kültürü ile birleştirildi."
          : "Seç. Felsefe sütunları yok sayıldı (birleştirme kapalı).",
      });
    }
  }

  const overrides = options.columnOverrides ?? {};
  for (const [field, col] of Object.entries(overrides)) {
    if (col === null || col === undefined) continue;
    const key = field as ImportField;
    columnMap[key] = col;
    if (!columnDetails.some((d) => d.field === key)) {
      columnDetails.push({
        field: key,
        fieldLabel: FIELD_LABELS[key] ?? key,
        columnIndex: col,
        letter: columnLetter(col),
        header: cellText(header, col) || columnLetter(col),
        subject: null,
      });
    }
  }
  columnDetails.sort((a, b) => a.columnIndex - b.columnIndex);

  const missing = REQUIRED_IMPORT_FIELDS.filter(
    (field) => columnMap[field] === undefined,
  );
  if (missing.length > 0) {
    errors.push(
      `Eksik zorunlu sütunlar: ${missing
        .map((f) => FIELD_LABELS[f])
        .join(", ")}.`,
    );
  }

  const format = secFound
    ? "Seçmeli Felsefe sütunlu format"
    : "Standart TYT formatı";

  if (columnMap.studentNumber === undefined || missing.length > 0) {
    return {
      format,
      headerRow,
      subjectRow,
      columnMap,
      columnDetails,
      scoreColumns,
      rows,
      warnings,
      errors,
    };
  }

  const numberColumn = columnMap.studentNumber;
  const seenNumbers = new Map<string, number>();
  let totalRows = 0;
  let suspiciousRows = 0;

  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const rowNo = i + 1;
    const studentNumber = normalizeStudentNumber(row[numberColumn]);
    if (!studentNumber) continue;

    const previousRow = seenNumbers.get(studentNumber);
    if (previousRow !== undefined) {
      warnings.push({
        row: rowNo,
        message: `Numara ${studentNumber} bu satırda tekrar ediyor (ilk kayıt satır ${previousRow}); ilk kayıt alındı.`,
      });
      continue;
    }

    const values: ImportedExamValues = { studentNumber };
    const nameColumn = columnMap.studentName;
    if (nameColumn !== undefined) {
      const name = cellText(row, nameColumn);
      if (name) values.studentName = name;
    }

    let secNet: number | undefined;
    for (const field of NET_FIELDS) {
      const col = columnMap[field];
      if (col === undefined) continue;
      const value = toNumber(row[col]);
      if (value === undefined) continue;
      values[field] = value;
    }
    if (secFound && secBlock && mergeSecFelsefe) {
      secNet = toNumber(row[secBlock.net]);
      if (secNet !== undefined) {
        values.dinNet = Math.round(((values.dinNet ?? 0) + secNet) * 100) / 100;
      }
    }

    const rowIssueMessages = validateImportedRow(values, scoreColumns, row, rowNo);
    for (const message of rowIssueMessages) {
      warnings.push({ row: rowNo, message });
    }
    if (rowIssueMessages.some((m) => m.includes("Toplam net"))) {
      suspiciousRows += 1;
    }

    seenNumbers.set(studentNumber, rowNo);
    totalRows += 1;
    rows.push(values);
  }

  if (totalRows > 0 && suspiciousRows / totalRows > SUSPICIOUS_RATIO) {
    errors.push(
      `Sütun eşlemesi şüpheli: ${totalRows} satırın ${suspiciousRows} tanesinde toplam net, ders netleri toplamıyla uyuşmuyor (>%5). Sütun eşlemesini kontrol edin.`,
    );
  }

  return {
    format,
    headerRow,
    subjectRow,
    columnMap,
    columnDetails,
    scoreColumns,
    rows,
    warnings,
    errors,
  };
}

function validateImportedRow(
  values: ImportedExamValues,
  scoreColumns: Partial<Record<NetField, ScoreColumns>>,
  row: SheetMatrix[number],
  rowNo: number,
): string[] {
  const messages: string[] = [];

  for (const [field, limits] of Object.entries(NET_LIMITS)) {
    const key = field as Exclude<NetField, "tytPuani">;
    const net = values[key];
    if (net === undefined) continue;
    if (net > limits.max + FORMULA_TOLERANCE) {
      messages.push(
        `Satır ${rowNo}: ${limits.label} neti (${net}) üst sınırı (${limits.max}) aşıyor.`,
      );
    } else if (net < -limits.max / 4 - FORMULA_TOLERANCE) {
      messages.push(
        `Satır ${rowNo}: ${limits.label} neti (${net}) alt sınırı (${(-limits.max / 4).toFixed(2)}) aşıyor.`,
      );
    }

    const score = scoreColumns[key];
    if (score?.correct !== null && score?.correct !== undefined &&
        score?.wrong !== null && score?.wrong !== undefined) {
      const dBase = toNumber(row[score.correct]);
      const yBase = toNumber(row[score.wrong]);
      const dExtra =
        score.extraCorrect !== null && score.extraCorrect !== undefined
          ? toNumber(row[score.extraCorrect])
          : 0;
      const yExtra =
        score.extraWrong !== null && score.extraWrong !== undefined
          ? toNumber(row[score.extraWrong])
          : 0;
      if (dBase !== undefined && yBase !== undefined) {
        const d = dBase + (dExtra ?? 0);
        const y = yBase + (yExtra ?? 0);
        const expected = Math.round((d - y / 4) * 100) / 100;
        if (Math.abs(net - expected) > FORMULA_TOLERANCE) {
          messages.push(
            `Satır ${rowNo}: ${limits.label} neti (${net}) beklenen değerle (${expected}) uyuşmuyor.`,
          );
        }
      }
    }
  }

  const subjectSumFields: Array<Exclude<NetField, "toplamNet" | "tytPuani">> = [
    "turkceNet",
    "tarihNet",
    "cografyaNet",
    "felsefeNet",
    "dinNet",
    "matematikNet",
    "geometriNet",
    "fizikNet",
    "kimyaNet",
    "biyolojiNet",
  ];
  const definedSum = subjectSumFields.reduce<number | undefined>(
    (sum, field) => (values[field] === undefined ? sum : (sum ?? 0) + values[field]!),
    undefined,
  );
  if (values.toplamNet !== undefined && definedSum !== undefined) {
    if (Math.abs(values.toplamNet - definedSum) > TOTAL_TOLERANCE) {
      messages.push(
        `Satır ${rowNo}: Toplam net (${values.toplamNet}) ders netleri toplamıyla (${Math.round(definedSum * 100) / 100}) uyuşmuyor.`,
      );
    }
  }

  const score = values.tytPuani;
  if (score !== undefined) {
    if (score === 0) {
      messages.push(`Satır ${rowNo}: TYT puanı 0 — puan yok.`);
    } else if (score < 100 || score > 500) {
      messages.push(
        `Satır ${rowNo}: TYT puanı (${score}) 100-500 aralığının dışında.`,
      );
    }
  }

  return messages;
}

export interface RowValidationIssue {
  row: number;
  studentNumber: string;
  message: string;
}

export function validateImportedRows(
  rows: ReadonlyArray<ImportedExamValues>,
): RowValidationIssue[] {
  const issues: RowValidationIssue[] = [];
  rows.forEach((values, index) => {
    const rowNo = index + 1;
    const messages = validateImportedRow(values, {}, [], rowNo);
    for (const message of messages) {
      issues.push({
        row: rowNo,
        studentNumber: values.studentNumber,
        message: message.replace(`Satır ${rowNo}: `, ""),
      });
    }
  });
  return issues;
}

export interface SheetInput {
  name: string;
  matrix: SheetMatrix;
}

export function isNetSiraliSheet(name: string): boolean {
  return normalizeLabel(name) === "net sirali";
}

export function selectImportSheet(
  sheets: SheetInput[],
): { sheet: SheetInput; result: ParseTytResults } | null {
  let fallback: { sheet: SheetInput; result: ParseTytResults } | null = null;
  for (const sheet of sheets) {
    const result = parseTytResults(sheet.matrix, {});
    if (!fallback) fallback = { sheet, result };
    if (isNetSiraliSheet(sheet.name)) continue;
    if (result.errors.length === 0 && result.rows.length > 0) {
      return { sheet, result };
    }
  }
  return fallback;
}

export function suggestExamName(fileName: string): string {
  return fileName
    .replace(/\.(xlsx|xlsm|xls|csv)$/i, "")
    .replace(/\d{6,}/g, " ")
    .replace(/_/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Eski sabit-indeks okuma mantığı (yalnız regresyon testi için):
export const LEGACY_COLUMN_INDEX = {
  studentNumber: 2,
  turkceNet: 7,
  tarihNet: 10,
  cografyaNet: 13,
  felsefeNet: 16,
  dinNet: 19,
  matematikNet: 22,
  geometriNet: 25,
  fizikNet: 28,
  kimyaNet: 31,
  biyolojiNet: 34,
  toplamNet: 37,
  tytPuani: 38,
} as const;

export function legacyParseRow(
  cells: SheetMatrix[number],
): ImportedExamValues | null {
  const rawNumber = cells[LEGACY_COLUMN_INDEX.studentNumber];
  const studentNumber = normalizeStudentNumber(rawNumber);
  if (!studentNumber) return null;
  return {
    studentNumber,
    turkceNet: toNumber(cells[LEGACY_COLUMN_INDEX.turkceNet]),
    tarihNet: toNumber(cells[LEGACY_COLUMN_INDEX.tarihNet]),
    cografyaNet: toNumber(cells[LEGACY_COLUMN_INDEX.cografyaNet]),
    felsefeNet: toNumber(cells[LEGACY_COLUMN_INDEX.felsefeNet]),
    dinNet: toNumber(cells[LEGACY_COLUMN_INDEX.dinNet]),
    matematikNet: toNumber(cells[LEGACY_COLUMN_INDEX.matematikNet]),
    geometriNet: toNumber(cells[LEGACY_COLUMN_INDEX.geometriNet]),
    fizikNet: toNumber(cells[LEGACY_COLUMN_INDEX.fizikNet]),
    kimyaNet: toNumber(cells[LEGACY_COLUMN_INDEX.kimyaNet]),
    biyolojiNet: toNumber(cells[LEGACY_COLUMN_INDEX.biyolojiNet]),
    toplamNet: toNumber(cells[LEGACY_COLUMN_INDEX.toplamNet]),
    tytPuani: toNumber(cells[LEGACY_COLUMN_INDEX.tytPuani]),
  };
}
