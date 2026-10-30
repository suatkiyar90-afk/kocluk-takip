import * as XLSX from "xlsx";
import type { ExamAnalysisOutcome } from "@/db/schema";

export const ANALYSIS_STATUS_LABELS = [
  "🔴 Acil Çalış",
  "🟡 Tekrar Et",
  "🟢 İyi",
  "⭐ Mükemmel",
] as const;

export type AnalysisStatusLabel = (typeof ANALYSIS_STATUS_LABELS)[number];

export const ANALYSIS_SUBJECTS = [
  "Türkçe",
  "Matematik",
  "Geometri",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Tarih",
  "Coğrafya",
  "Felsefe",
  "Din Kültürü",
] as const;

export type AnalysisSubjectName = (typeof ANALYSIS_SUBJECTS)[number];

const GEOMETRY_TOPIC_NAMES = [
  "Üçgende Açılar",
  "Dik Üçgen",
  "Üçgende Alan",
  "Üçgende Açıortay",
  "Üçgende Eşlik ve Benzerlik",
  "Üçgende Açı- Kenar Bağıntıları",
  "Çokgenler",
  "Dörtgenler-Deltoid",
  "Eşkenar Dörtgen",
  "Dikdörtgen",
  "Kare",
  "Yamuk",
  "Prizmalar",
] as const;

const GEOMETRY_TOPIC_BY_KEY = new Map(
  GEOMETRY_TOPIC_NAMES.map((name) => [normalizeTrKey(name), name]),
);

const SUBJECT_GROUP: Record<AnalysisSubjectName, string> = {
  Türkçe: "TYT-TRK",
  Matematik: "TYT-MAT",
  Geometri: "TYT-GEO",
  Fizik: "TYT-FEN",
  Kimya: "TYT-FEN",
  Biyoloji: "TYT-FEN",
  Tarih: "TYT-SOS",
  Coğrafya: "TYT-SOS",
  Felsefe: "TYT-SOS",
  "Din Kültürü": "TYT-SOS",
};

export interface ParsedExamAnalysisOutcome extends ExamAnalysisOutcome {}

export interface ParsedPeriodExam {
  examName: string;
  examDate: string | null;
  totalNet: number;
}

export interface ParsedTopicAnalysis {
  subjectGroup: string;
  subjectName: AnalysisSubjectName;
  topicName: string;
  totalQuestions: number;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  successPct: number;
  statusLabel: AnalysisStatusLabel;
  priorityLevel: number | null;
  priorityOrder: number | null;
  lostPoints: number;
  outcomes: ParsedExamAnalysisOutcome[];
}

export interface ParsedStudentAnalysis {
  key: string;
  name: string;
  studentNumber: string | null;
  exams: ParsedPeriodExam[];
  topics: ParsedTopicAnalysis[];
}

export interface ExamAnalysisParseCounts {
  studentCount: number;
  examCount: number;
  topicCount: number;
  outcomeCount: number;
  priorityTopicCount: number;
}

export interface ExamAnalysisParseResult {
  students: ParsedStudentAnalysis[];
  counts: ExamAnalysisParseCounts;
  warnings: string[];
}

export class ExamAnalysisParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExamAnalysisParseError";
  }
}

interface MutableTopic extends ParsedTopicAnalysis {
  hasSourceCounts: boolean;
}

interface MutableStudent {
  key: string;
  name: string;
  studentNumber: string | null;
  exams: ParsedPeriodExam[];
  topics: Map<string, MutableTopic>;
}

interface SheetMatrix {
  name: string;
  matrix: unknown[][];
}

interface HeaderAccessor {
  headerRow: number;
  indexByKey: Map<string, number>;
}

type CellRow = unknown[];

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeTrKey(value: unknown): string {
  // Excel dosyalarında adlar bazen büyük harfle (OGRENCI), bazen normal
  // yazımla (Ogrenci) gelir. Türkçe büyütmede i -> İ olduğu için iki biçim
  // ayrışmasın diye İ/ı tek bir I harfine katlanır.
  return cleanText(value)
    .normalize("NFC")
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function normalizePersonName(value: unknown): string {
  return normalizeTrKey(value);
}

const TR_ASCII_FOLD: Record<string, string> = {
  İ: "I",
  I: "I",
  ı: "I",
  Ş: "S",
  ş: "S",
  Ğ: "G",
  ğ: "G",
  Ü: "U",
  ü: "U",
  Ö: "O",
  ö: "O",
  Ç: "C",
  ç: "C",
  Â: "A",
  â: "A",
  Î: "I",
  î: "I",
  Û: "U",
  û: "U",
};

/**
 * Kişi adlarını eşleştirmek için Türkçe karakterleri ASCII karşılıklarına
 * katlar (İ->I, Ş->S, Ğ->G, Ü->U, Ö->O, Ç->C, Â->A), boşluk ve noktalama
 * işaretlerini temizler. Böylece "Şener ÇANKAYA" ile "SENER CANKAYA"
 * aynı anahtara düşer.
 */
export function normalizeTrName(value: unknown): string {
  return cleanText(value)
    .normalize("NFC")
    .toLocaleUpperCase("tr-TR")
    .replace(/[İIıŞşĞğÜüÖöÇçÂâÎîÛû]/g, (char) => TR_ASCII_FOLD[char] ?? char)
    .replace(/[^A-Z0-9]+/g, "");
}

export function normalizeStudentNumber(value: unknown): string {
  return cleanText(value).replace(/\s+/g, "").replace(/\.0$/, "");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  let text = cleanText(value).replace(/%/g, "").replace(/\s/g, "");
  if (!text) return 0;
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function statusForSuccess(successPct: number): AnalysisStatusLabel {
  if (successPct >= 85) return "⭐ Mükemmel";
  if (successPct >= 65) return "🟢 İyi";
  if (successPct >= 40) return "🟡 Tekrar Et";
  return "🔴 Acil Çalış";
}

export function formatLostPoints(value: number): string {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAnalysisPeriodDate(value: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function canonicalSubjectFor(
  rawSubject: unknown,
  topicName: string,
): AnalysisSubjectName {
  const geometryName = GEOMETRY_TOPIC_BY_KEY.get(normalizeTrKey(topicName));
  if (geometryName) return "Geometri";

  const key = cleanText(rawSubject).toLocaleLowerCase("tr-TR");
  if (key.includes("geometri")) return "Geometri";
  if (key.includes("türkçe") || key.includes("edebiyat")) return "Türkçe";
  if (key.includes("matematik")) return "Matematik";
  if (key.includes("fizik")) return "Fizik";
  if (key.includes("kimya")) return "Kimya";
  if (key.includes("biyoloji")) return "Biyoloji";
  if (key.includes("tarih")) return "Tarih";
  if (key.includes("coğrafya")) return "Coğrafya";
  if (key.includes("felsefe")) return "Felsefe";
  if (key.includes("din")) return "Din Kültürü";
  return "Türkçe";
}

export function canonicalTopicName(
  subjectName: AnalysisSubjectName,
  rawTopic: unknown,
): string {
  const topic = cleanText(rawTopic);
  if (subjectName === "Geometri") {
    const canonical = GEOMETRY_TOPIC_BY_KEY.get(normalizeTrKey(topic));
    if (canonical) return canonical;
  }
  return topic;
}

export function subjectGroupFor(subjectName: AnalysisSubjectName): string {
  return SUBJECT_GROUP[subjectName];
}

const ANALYSIS_SUBJECT_ID: Record<AnalysisSubjectName, string> = {
  Türkçe: "turkce",
  Matematik: "matematik",
  Geometri: "geometri",
  Fizik: "tyt-fizik",
  Kimya: "tyt-kimya",
  Biyoloji: "tyt-biyoloji",
  Tarih: "tyt-tarih",
  Coğrafya: "tyt-cografya",
  Felsefe: "tyt-felsefe",
  "Din Kültürü": "tyt-din",
};

const TOPIC_ALIAS_TARGETS: Record<string, string[]> = {
  [normalizeTrKey("Paragraf")]: ["Paragrafın Anlamı ve Yapısı"],
  [normalizeTrKey("Paragrafın Ana Düşüncesi")]: [
    "Paragrafın Anlamı ve Yapısı",
    "Paragraf",
  ],
  [normalizeTrKey("Paragrafta Yardımcı Düşünceler")]: [
    "Paragrafın Anlamı ve Yapısı",
    "Paragraf",
  ],
  [normalizeTrKey("Paragrafın Yapısı")]: [
    "Paragrafın Anlamı ve Yapısı",
    "Paragraf",
  ],
  [normalizeTrKey("Üslü İfadeler")]: ["Üslü Sayılar"],
  [normalizeTrKey("Köklü İfadeler")]: ["Köklü Sayılar"],
  [normalizeTrKey("Bölme Bölünebilme")]: ["Bölünebilme Kuralları"],
  [normalizeTrKey("Bölme - Bölünebilme")]: ["Bölünebilme Kuralları"],
  [normalizeTrKey("Üçgende Açıortay")]: ["Açıortay"],
  [normalizeTrKey("Üçgende Eşlik ve Benzerlik")]: ["Üçgende Benzerlik"],
  [normalizeTrKey("Üçgende Açı- Kenar Bağıntıları")]: [
    "Üçgende Açılar",
    "Açı Kenar Bağıntıları",
  ],
  [normalizeTrKey("Dörtgenler-Deltoid")]: ["Dörtgenler", "Deltoid"],
  [normalizeTrKey("Prizmalar")]: ["Katı Cisimler"],
};

export interface CurriculumTopicMatchRow {
  id: number;
  subjectId: string;
  topicName: string;
}

function topicTokenKey(value: string): string {
  return cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 0 && token !== "ve" && token !== "ile")
    .sort()
    .join(" ");
}

export function curriculumSubjectIdFor(
  subjectName: AnalysisSubjectName,
): string {
  return ANALYSIS_SUBJECT_ID[subjectName];
}

export function findCurriculumTopicId(
  topicName: string,
  subjectName: AnalysisSubjectName,
  rows: readonly CurriculumTopicMatchRow[],
): number | null {
  const subjectId = ANALYSIS_SUBJECT_ID[subjectName];
  const candidates = rows.filter((row) => row.subjectId === subjectId);
  if (candidates.length === 0) return null;
  const normalized = normalizeTrKey(topicName);

  const exact = candidates.find(
    (row) => normalizeTrKey(row.topicName) === normalized,
  );
  if (exact) return exact.id;

  const aliases = TOPIC_ALIAS_TARGETS[normalized] ?? [];
  for (const alias of aliases) {
    const aliasKey = normalizeTrKey(alias);
    const match = candidates.find(
      (row) => normalizeTrKey(row.topicName) === aliasKey,
    );
    if (match) return match.id;
  }

  // "Hareket ve Kuvvet" / "Kuvvet ve Hareket" gibi kelime sırası değişen
  // konu adlarını yakalar.
  const tokenKey = topicTokenKey(topicName);
  if (tokenKey) {
    const tokenMatch = candidates.find(
      (row) => topicTokenKey(row.topicName) === tokenKey,
    );
    if (tokenMatch) return tokenMatch.id;
  }

  if (normalized.includes("PARAGRAF")) {
    const paragraph = candidates.find((row) =>
      normalizeTrKey(row.topicName).includes(normalizeTrKey("Paragraf")),
    );
    if (paragraph) return paragraph.id;
  }
  if (normalized.includes("PROBLEM")) {
    const problem = candidates.find(
      (row) => normalizeTrKey(row.topicName) === normalizeTrKey("Problemler"),
    );
    if (problem) return problem.id;
  }
  if (
    normalized.includes(normalizeTrKey("Bölme")) ||
    normalized.includes(normalizeTrKey("Bölünebilme"))
  ) {
    const divisibilityKey = normalizeTrKey("Bölünebilme");
    const divisibility = candidates.find((row) =>
      normalizeTrKey(row.topicName).includes(divisibilityKey),
    );
    if (divisibility) return divisibility.id;
  }

  for (const alias of aliases) {
    const aliasKey = normalizeTrKey(alias);
    const match = candidates.find((row) => {
      const key = normalizeTrKey(row.topicName);
      return key.includes(aliasKey) || aliasKey.includes(key);
    });
    if (match) return match.id;
  }

  return null;
}

function isSameWords(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const firstKey = normalizeTrKey(a.join(" "));
  if (firstKey.length < 3) return false;
  return firstKey === normalizeTrKey(b.join(" "));
}

export function cleanExamName(value: unknown): string {
  let name = cleanText(value);
  if (!name) return "";
  for (let guard = 0; guard < 4; guard += 1) {
    const parts = name.split(" ");
    if (parts.length % 2 !== 0 || parts.length < 2) break;
    const half = parts.length / 2;
    const first = parts.slice(0, half).join(" ");
    const second = parts.slice(half).join(" ");
    if (normalizeTrKey(first) !== normalizeTrKey(second)) break;
    name = first;
  }
  // Excel'den "ÖZDEBİR İLK PROVA TYT ÖZDEBİR İLK PROVA TYT (T1226)" gibi
  // kelime sayısı tek olan (bu yüzden ikiye bölünemeyen) adlar da gelebilir.
  // Burada baştan itibaren art arda iki kez tekrarlanan en uzun kelime bloğu
  // bulunup ikinci kopyası atılır; kuyruktaki "(T1226)" benzeri kod korunur.
  for (let guard = 0; guard < 4; guard += 1) {
    const words = name.split(" ");
    let removed = false;
    for (let len = Math.floor(words.length / 2); len >= 2; len -= 1) {
      const firstBlock = words.slice(0, len);
      const secondBlock = words.slice(len, len * 2);
      if (!isSameWords(firstBlock, secondBlock)) continue;
      name = [...firstBlock, ...words.slice(len * 2)].join(" ");
      removed = true;
      break;
    }
    if (!removed) break;
  }
  return cleanText(name);
}

function parseExamDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
        parsed.d,
      ).padStart(2, "0")}`;
    }
  }
  const text = cleanText(value);
  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${year}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return text || null;
}

function findColumn(
  accessor: HeaderAccessor,
  aliases: readonly string[],
): number | null {
  for (const alias of aliases) {
    const key = normalizeTrKey(alias);
    const index = accessor.indexByKey.get(key);
    if (index !== undefined) return index;
  }
  for (const alias of aliases) {
    const key = normalizeTrKey(alias);
    if (key.length < 4) continue;
    for (const [headerKey, index] of accessor.indexByKey) {
      if (headerKey.includes(key)) return index;
    }
  }
  return null;
}

function cellText(row: CellRow, index: number | null): string {
  if (index === null) return "";
  return cleanText(row[index]);
}

function cellNumber(row: CellRow, index: number | null): number {
  if (index === null) return 0;
  return toNumber(row[index]);
}

function buildAccessor(
  matrix: unknown[][],
  requiredAliases: readonly (readonly string[])[],
  minMatches = 2,
): HeaderAccessor | null {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 30); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const indexByKey = new Map<string, number>();
    for (let column = 0; column < row.length; column += 1) {
      const key = normalizeTrKey(row[column]);
      if (key && !indexByKey.has(key)) indexByKey.set(key, column);
    }
    const accessor = { headerRow: rowIndex, indexByKey };
    const matches = requiredAliases.filter(
      (aliases) => findColumn(accessor, aliases) !== null,
    ).length;
    if (matches >= minMatches) return accessor;
  }
  return null;
}

function parseWorkbook(base64: string, label: string): XLSX.WorkBook {
  const payload = base64.includes(",")
    ? base64.slice(base64.indexOf(",") + 1)
    : base64;
  if (!payload.trim()) {
    throw new ExamAnalysisParseError(`${label} dosyası boş.`);
  }
  try {
    return XLSX.read(payload, { type: "base64", cellDates: true });
  } catch {
    throw new ExamAnalysisParseError(
      `${label} dosyası Excel (.xlsx) olarak okunamadı.`,
    );
  }
}

function readSheets(workbook: XLSX.WorkBook): SheetMatrix[] {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const matrix = sheet
      ? (XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: null,
          raw: true,
          blankrows: false,
        }) as unknown[][])
      : [];
    return { name, matrix };
  }).filter((sheet) => sheet.matrix.length > 0);
}

function findSheet(
  sheets: SheetMatrix[],
  namePart: string,
  requiredAliases: readonly (readonly string[])[],
): SheetMatrix | null {
  const key = normalizeTrKey(namePart);
  const byName = sheets.find((sheet) => normalizeTrKey(sheet.name).includes(key));
  if (byName) return byName;
  const minMatches = Math.min(requiredAliases.length, 3);
  return (
    sheets.find(
      (sheet) =>
        buildAccessor(sheet.matrix, requiredAliases, minMatches) !== null,
    ) ?? null
  );
}

function ensureStudent(
  students: Map<string, MutableStudent>,
  name: string,
  studentNumber?: string,
): MutableStudent | null {
  const displayName = cleanText(name);
  const key = normalizePersonName(displayName);
  if (!key) return null;
  let student = students.get(key);
  if (!student) {
    student = {
      key,
      name: displayName,
      studentNumber: normalizeStudentNumber(studentNumber) || null,
      exams: [],
      topics: new Map(),
    };
    students.set(key, student);
  } else if (!student.studentNumber && studentNumber) {
    student.studentNumber = normalizeStudentNumber(studentNumber) || null;
  }
  return student;
}

function ensureTopic(
  student: MutableStudent,
  subjectName: AnalysisSubjectName,
  topicName: string,
): MutableTopic | null {
  const topic = canonicalTopicName(subjectName, topicName);
  if (!topic) return null;
  const key = `${subjectName}|${normalizeTrKey(topic)}`;
  let row = student.topics.get(key);
  if (!row) {
    row = {
      subjectGroup: subjectGroupFor(subjectName),
      subjectName,
      topicName: topic,
      totalQuestions: 0,
      correct: 0,
      wrong: 0,
      blank: 0,
      net: 0,
      successPct: 0,
      statusLabel: "🔴 Acil Çalış",
      priorityLevel: null,
      priorityOrder: null,
      lostPoints: 0,
      outcomes: [],
      hasSourceCounts: false,
    };
    student.topics.set(key, row);
  }
  return row;
}

function addCounts(
  target: MutableTopic | ParsedExamAnalysisOutcome,
  counts: {
    totalQuestions: number;
    correct: number;
    wrong: number;
    blank: number;
  },
): void {
  target.totalQuestions += counts.totalQuestions;
  target.correct += counts.correct;
  target.wrong += counts.wrong;
  target.blank += counts.blank;
}

function finaliseOutcome(
  outcome: ParsedExamAnalysisOutcome,
): ParsedExamAnalysisOutcome {
  outcome.net = round2(outcome.correct - outcome.wrong * 0.25);
  outcome.totalQuestions = Math.max(
    outcome.totalQuestions,
    outcome.correct + outcome.wrong + outcome.blank,
  );
  outcome.successPct =
    outcome.totalQuestions > 0
      ? Math.round((outcome.correct / outcome.totalQuestions) * 100)
      : 0;
  outcome.statusLabel = statusForSuccess(outcome.successPct);
  return outcome;
}

function finaliseTopic(topic: MutableTopic): void {
  topic.net = round2(topic.correct - topic.wrong * 0.25);
  topic.totalQuestions = Math.max(
    topic.totalQuestions,
    topic.correct + topic.wrong + topic.blank,
  );
  topic.successPct =
    topic.totalQuestions > 0
      ? Math.round((topic.correct / topic.totalQuestions) * 100)
      : 0;
  topic.statusLabel = statusForSuccess(topic.successPct);
  topic.outcomes = topic.outcomes.map(finaliseOutcome);
}

function addOutcome(
  topic: MutableTopic,
  kazanimName: string,
  counts: {
    totalQuestions: number;
    correct: number;
    wrong: number;
    blank: number;
  },
): void {
  const name = cleanText(kazanimName);
  const key = normalizeTrKey(name);
  if (!key) return;
  let outcome = topic.outcomes.find(
    (item) => normalizeTrKey(item.kazanimName) === key,
  );
  if (!outcome) {
    outcome = {
      kazanimName: name,
      totalQuestions: 0,
      correct: 0,
      wrong: 0,
      blank: 0,
      net: 0,
      successPct: 0,
      statusLabel: "🔴 Acil Çalış",
    };
    topic.outcomes.push(outcome);
  }
  addCounts(outcome, counts);
}

const SUBJECT_SUMMARY_ALIASES = {
  student: ["Öğrenci Adı", "Öğrenci", "Adı"],
  subject: ["Ders", "Ders Adı"],
  topic: ["Konu", "Konu Adı"],
  total: ["Soru Sayısı", "Soru Sayisi", "Soru"],
  correct: ["Doğru", "Dogru"],
  wrong: ["Yanlış", "Yanlis"],
  blank: ["Boş", "Bos"],
  net: ["Net"],
  success: ["Başarı (%)", "Basari (%)", "Başarı", "Basari", "Yüzde", "Yuzde"],
  status: ["Durum"],
  outcome: ["Kazanım", "Kazanim", "Alt Kazanım", "Alt Kazanim"],
  number: ["Numara", "Öğrenci No", "Ogrenci No", "Öğrenci Numarası", "Ogrenci Numarasi"],
  examName: ["Sınav Adı", "Sinav Adi", "Sınav", "Sinav"],
  examDate: ["Sınav Tarihi", "Sinav Tarihi", "Tarih"],
  examNet: ["Toplam Net", "Toplam Neti"],
  lostPoints: ["Kayıp Puan", "Kayip Puan", "Kayıp Puanı", "Kayip Puani"],
  priority: ["Oncelik", "Öncelik"],
  priorityOrder: ["Oncelik Sira", "Öncelik Sırası", "Öncelik Sıra"],
} as const;

const SUBJECT_REQUIRED = [
  SUBJECT_SUMMARY_ALIASES.student,
  SUBJECT_SUMMARY_ALIASES.subject,
  SUBJECT_SUMMARY_ALIASES.topic,
  SUBJECT_SUMMARY_ALIASES.correct,
] as const;

const DETAIL_REQUIRED = [
  SUBJECT_SUMMARY_ALIASES.student,
  SUBJECT_SUMMARY_ALIASES.topic,
  SUBJECT_SUMMARY_ALIASES.outcome,
] as const;

const EXAM_REQUIRED = [
  SUBJECT_SUMMARY_ALIASES.student,
  SUBJECT_SUMMARY_ALIASES.examName,
] as const;

const PRIORITY_REQUIRED = [
  SUBJECT_SUMMARY_ALIASES.student,
  SUBJECT_SUMMARY_ALIASES.subject,
  SUBJECT_SUMMARY_ALIASES.topic,
  SUBJECT_SUMMARY_ALIASES.lostPoints,
] as const;

function parseConsolidated(
  workbook: XLSX.WorkBook,
  students: Map<string, MutableStudent>,
  warnings: string[],
): void {
  const sheets = readSheets(workbook);
  const summarySheet = findSheet(sheets, "Konu Özet", SUBJECT_REQUIRED);
  if (!summarySheet) {
    throw new ExamAnalysisParseError(
      'Birleştirilmiş Karne dosyasında "Konu Özet" sayfası bulunamadı.',
    );
  }
  const summaryHeader = buildAccessor(
    summarySheet.matrix,
    SUBJECT_REQUIRED,
    3,
  );
  if (!summaryHeader) {
    throw new ExamAnalysisParseError(
      '"Konu Özet" sayfasında öğrenci, ders, konu ve doğru sütunları bulunamadı.',
    );
  }

  const summaryCols = {
    student: findColumn(summaryHeader, SUBJECT_SUMMARY_ALIASES.student),
    subject: findColumn(summaryHeader, SUBJECT_SUMMARY_ALIASES.subject),
    topic: findColumn(summaryHeader, SUBJECT_SUMMARY_ALIASES.topic),
    total: findColumn(summaryHeader, SUBJECT_SUMMARY_ALIASES.total),
    correct: findColumn(summaryHeader, SUBJECT_SUMMARY_ALIASES.correct),
    wrong: findColumn(summaryHeader, SUBJECT_SUMMARY_ALIASES.wrong),
    blank: findColumn(summaryHeader, SUBJECT_SUMMARY_ALIASES.blank),
  };

  for (let index = summaryHeader.headerRow + 1; index < summarySheet.matrix.length; index += 1) {
    const row = summarySheet.matrix[index] ?? [];
    const studentName = cellText(row, summaryCols.student);
    const topicName = cellText(row, summaryCols.topic);
    const rawSubject = cellText(row, summaryCols.subject);
    if (!studentName || !topicName || !rawSubject) continue;

    const student = ensureStudent(students, studentName);
    if (!student) continue;
    const subjectName = canonicalSubjectFor(rawSubject, topicName);
    const topic = ensureTopic(student, subjectName, topicName);
    if (!topic) continue;

    const counts = {
      totalQuestions: cellNumber(row, summaryCols.total),
      correct: cellNumber(row, summaryCols.correct),
      wrong: cellNumber(row, summaryCols.wrong),
      blank: cellNumber(row, summaryCols.blank),
    };
    addCounts(topic, counts);
    topic.hasSourceCounts = true;
  }

  const detailSheet = findSheet(sheets, "Konu Detay", DETAIL_REQUIRED);
  if (detailSheet) {
    const detailHeader = buildAccessor(detailSheet.matrix, DETAIL_REQUIRED, 3);
    if (detailHeader) {
      const detailCols = {
        student: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.student),
        subject: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.subject),
        topic: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.topic),
        outcome: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.outcome),
        total: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.total),
        correct: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.correct),
        wrong: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.wrong),
        blank: findColumn(detailHeader, SUBJECT_SUMMARY_ALIASES.blank),
      };

      for (let index = detailHeader.headerRow + 1; index < detailSheet.matrix.length; index += 1) {
        const row = detailSheet.matrix[index] ?? [];
        const studentName = cellText(row, detailCols.student);
        const topicName = cellText(row, detailCols.topic);
        const outcomeName = cellText(row, detailCols.outcome);
        const rawSubject = cellText(row, detailCols.subject);
        if (!studentName || !topicName || !outcomeName) continue;

        const student = ensureStudent(students, studentName);
        if (!student) continue;
        const subjectName = canonicalSubjectFor(rawSubject || "Matematik", topicName);
        const topic = ensureTopic(student, subjectName, topicName);
        if (!topic) continue;
        addOutcome(topic, outcomeName, {
          totalQuestions: cellNumber(row, detailCols.total),
          correct: cellNumber(row, detailCols.correct),
          wrong: cellNumber(row, detailCols.wrong),
          blank: cellNumber(row, detailCols.blank),
        });
      }
    }
  } else {
    warnings.push("Birleştirilmiş Karne dosyasında Konu Detay sayfası bulunamadı.");
  }

  const examSheet = findSheet(sheets, "Sınav Bilgileri", EXAM_REQUIRED);
  if (!examSheet) {
    warnings.push("Birleştirilmiş Karne dosyasında Sınav Bilgileri sayfası bulunamadı.");
    return;
  }
  const examHeader = buildAccessor(examSheet.matrix, EXAM_REQUIRED, 2);
  if (!examHeader) return;
  const examCols = {
    student: findColumn(examHeader, SUBJECT_SUMMARY_ALIASES.student),
    examName: findColumn(examHeader, SUBJECT_SUMMARY_ALIASES.examName),
    examDate: findColumn(examHeader, SUBJECT_SUMMARY_ALIASES.examDate),
    totalNet: findColumn(examHeader, SUBJECT_SUMMARY_ALIASES.examNet),
  };

  for (let index = examHeader.headerRow + 1; index < examSheet.matrix.length; index += 1) {
    const row = examSheet.matrix[index] ?? [];
    const studentName = cellText(row, examCols.student);
    const examName = cleanExamName(cellText(row, examCols.examName));
    if (!studentName || !examName) continue;
    const student = ensureStudent(students, studentName);
    if (!student) continue;
    const exam = {
      examName,
      examDate: parseExamDate(row[examCols.examDate ?? -1]),
      totalNet: round2(cellNumber(row, examCols.totalNet)),
    };
    const duplicate = student.exams.some(
      (item) =>
        normalizeTrKey(item.examName) === normalizeTrKey(exam.examName) &&
        item.examDate === exam.examDate,
    );
    if (!duplicate) student.exams.push(exam);
  }
}

function parsePriority(
  workbook: XLSX.WorkBook,
  students: Map<string, MutableStudent>,
): void {
  const sheets = readSheets(workbook);
  const prioritySheet =
    findSheet(sheets, "Analiz", PRIORITY_REQUIRED) ??
    sheets.find(
      (sheet) => buildAccessor(sheet.matrix, PRIORITY_REQUIRED, 3) !== null,
    ) ??
    null;
  if (!prioritySheet) {
    throw new ExamAnalysisParseError(
      'Öncelikli Konu Listesi dosyasında "Analiz" sayfası bulunamadı.',
    );
  }
  const header = buildAccessor(prioritySheet.matrix, PRIORITY_REQUIRED, 3);
  if (!header) {
    throw new ExamAnalysisParseError(
      "Öncelikli Konu Listesi dosyasında Adi, Ders, Konu ve Kayıp Puan sütunları bulunamadı.",
    );
  }
  const cols = {
    student: findColumn(header, ["Adi", "Adı", "Öğrenci Adı"]),
    number: findColumn(header, SUBJECT_SUMMARY_ALIASES.number),
    subject: findColumn(header, SUBJECT_SUMMARY_ALIASES.subject),
    topic: findColumn(header, SUBJECT_SUMMARY_ALIASES.topic),
    total: findColumn(header, SUBJECT_SUMMARY_ALIASES.total),
    correct: findColumn(header, SUBJECT_SUMMARY_ALIASES.correct),
    wrong: findColumn(header, SUBJECT_SUMMARY_ALIASES.wrong),
    blank: findColumn(header, SUBJECT_SUMMARY_ALIASES.blank),
    lostPoints: findColumn(header, SUBJECT_SUMMARY_ALIASES.lostPoints),
    priority: findColumn(header, SUBJECT_SUMMARY_ALIASES.priority),
    priorityOrder: findColumn(header, SUBJECT_SUMMARY_ALIASES.priorityOrder),
  };

  for (let index = header.headerRow + 1; index < prioritySheet.matrix.length; index += 1) {
    const row = prioritySheet.matrix[index] ?? [];
    const studentName = cellText(row, cols.student);
    const topicName = cellText(row, cols.topic);
    const rawSubject = cellText(row, cols.subject);
    if (!studentName || !topicName || !rawSubject) continue;

    const studentNumber = cellText(row, cols.number);
    const student = ensureStudent(students, studentName, studentNumber);
    if (!student) continue;
    const subjectName = canonicalSubjectFor(rawSubject, topicName);
    const topic = ensureTopic(student, subjectName, topicName);
    if (!topic) continue;

    if (!topic.hasSourceCounts) {
      addCounts(topic, {
        totalQuestions: cellNumber(row, cols.total),
        correct: cellNumber(row, cols.correct),
        wrong: cellNumber(row, cols.wrong),
        blank: cellNumber(row, cols.blank),
      });
      topic.hasSourceCounts = true;
    }

    const priorityLevel = Math.round(cellNumber(row, cols.priority));
    if (priorityLevel >= 1 && priorityLevel <= 3) {
      topic.priorityLevel = priorityLevel;
    }
    const priorityOrder = Math.round(cellNumber(row, cols.priorityOrder));
    if (priorityOrder > 0) topic.priorityOrder = priorityOrder;
    topic.lostPoints = round2(Math.max(topic.lostPoints, cellNumber(row, cols.lostPoints)));
  }
}

export function parseExamAnalysisWorkbooks(
  consolidatedBase64: string,
  priorityBase64: string,
): ExamAnalysisParseResult {
  const consolidated = parseWorkbook(
    consolidatedBase64,
    "Birleştirilmiş Karne",
  );
  const priority = parseWorkbook(
    priorityBase64,
    "Öncelikli Konu Listesi",
  );
  const students = new Map<string, MutableStudent>();
  const warnings: string[] = [];

  parseConsolidated(consolidated, students, warnings);
  parsePriority(priority, students);

  const parsedStudents: ParsedStudentAnalysis[] = [];
  let topicCount = 0;
  let outcomeCount = 0;
  let priorityTopicCount = 0;
  let examCount = 0;

  for (const student of students.values()) {
    const topics = [...student.topics.values()];
    const cleanedTopics: ParsedTopicAnalysis[] = [];
    for (const topic of topics) {
      finaliseTopic(topic);
      const { hasSourceCounts: _hasSourceCounts, ...cleaned } = topic;
      cleanedTopics.push(cleaned);
      topicCount += 1;
      outcomeCount += cleaned.outcomes.length;
      if (cleaned.priorityLevel !== null) priorityTopicCount += 1;
    }
    cleanedTopics.sort(
      (a, b) =>
        (a.priorityLevel ?? 99) - (b.priorityLevel ?? 99) ||
        (a.priorityOrder ?? 9999) - (b.priorityOrder ?? 9999) ||
        b.lostPoints - a.lostPoints ||
        a.subjectName.localeCompare(b.subjectName, "tr") ||
        a.topicName.localeCompare(b.topicName, "tr"),
    );
    examCount += student.exams.length;
    if (cleanedTopics.length === 0 && student.exams.length === 0) continue;
    parsedStudents.push({
      key: student.key,
      name: student.name,
      studentNumber: student.studentNumber,
      exams: student.exams,
      topics: cleanedTopics,
    });
  }

  if (parsedStudents.length === 0) {
    throw new ExamAnalysisParseError(
      "Excel dosyalarında kaydedilecek öğrenci, konu veya deneme satırı bulunamadı.",
    );
  }

  parsedStudents.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return {
    students: parsedStudents,
    counts: {
      studentCount: parsedStudents.length,
      examCount,
      topicCount,
      outcomeCount,
      priorityTopicCount,
    },
    warnings,
  };
}

export function buildAnalysisTopicNote(input: {
  periodTitle: string;
  priorityLevel: number | null;
  lostPoints: number;
  outcomes: Array<{ kazanimName: string; successPct: number }>;
}): string {
  const priorityText =
    input.priorityLevel === 1
      ? "1. Öncelik"
      : input.priorityLevel === 2
        ? "2. Öncelik"
        : input.priorityLevel === 3
          ? "3. Öncelik"
          : "Analiz Önceliği";
  const weak = input.outcomes
    .filter((outcome) => outcome.successPct < 50)
    .slice(0, 4)
    .map((outcome) => `${outcome.kazanimName} (%${outcome.successPct})`);
  const weakText =
    weak.length > 0
      ? ` • Odaklanılacak Alt Kazanımlar: ${weak.join(", ")}`
      : "";
  return `🎯 ${input.periodTitle} • ${priorityText} (${formatLostPoints(
    input.lostPoints,
  )} Kayıp Puan)${weakText}`;
}
