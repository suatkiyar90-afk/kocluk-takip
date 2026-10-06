import type { ExamType } from "@/components/quiz-entry/weekly-quiz-schema";
import { netScore } from "@/components/quiz-entry/weekly-quiz-schema";
import { getDenemeLabel, parseDenemeKey } from "@/lib/deneme";
import {
  addDaysISO,
  isValidISODate,
  mondayOfISO,
  todayInIstanbul,
} from "@/lib/week-utils";

export const MAX_REPORT_DAYS = 366;

export type QuickRangeKind =
  | "this-week"
  | "last-week"
  | "last-7"
  | "last-30"
  | "this-month"
  | "last-month";

export type RangeValidation =
  | { ok: true; from: string; to: string }
  | { ok: false; message: string };

export function dayCountInclusive(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.round((end - start) / 86400000) + 1;
}

export function validateReportRange(
  from: string,
  to: string,
  now: Date = new Date(),
): RangeValidation {
  if (!isValidISODate(from) || !isValidISODate(to)) {
    return { ok: false, message: "Geçersiz tarih formatı." };
  }
  const today = todayInIstanbul(now);
  const end = to > today ? today : to;
  if (end < from) {
    return { ok: false, message: "Bitiş tarihi başlangıçtan önce olamaz." };
  }
  if (dayCountInclusive(from, end) > MAX_REPORT_DAYS) {
    return {
      ok: false,
      message: `Tarih aralığı en fazla ${MAX_REPORT_DAYS} gün olabilir.`,
    };
  }
  return { ok: true, from, to: end };
}

function isoToParts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function minIso(a: string, b: string): string {
  return a <= b ? a : b;
}

export function quickReportRange(
  kind: QuickRangeKind,
  now: Date = new Date(),
): { from: string; to: string } {
  const today = todayInIstanbul(now);
  const [year, month, day] = isoToParts(today);

  switch (kind) {
    case "this-week": {
      const monday = mondayOfISO(today);
      return { from: monday, to: minIso(addDaysISO(monday, 6), today) };
    }
    case "last-week": {
      const thisMonday = mondayOfISO(today);
      const monday = addDaysISO(thisMonday, -7);
      return { from: monday, to: addDaysISO(monday, 6) };
    }
    case "last-7":
      return { from: addDaysISO(today, -6), to: today };
    case "last-30":
      return { from: addDaysISO(today, -29), to: today };
    case "this-month": {
      const first = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
        lastDay,
      ).padStart(2, "0")}`;
      return { from: first, to: minIso(monthEnd, today) };
    }
    case "last-month": {
      const lastMonth = month === 1 ? 12 : month - 1;
      const lastMonthYear = month === 1 ? year - 1 : year;
      const lastDay = new Date(
        Date.UTC(lastMonthYear, lastMonth, 0),
      ).getUTCDate();
      return {
        from: `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`,
        to: `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-${String(
          lastDay,
        ).padStart(2, "0")}`,
      };
    }
    default:
      return { from: today, to: today };
  }
}

export function roundNet(value: number): number {
  return Math.round(value * 100) / 100;
}

export function successRate(
  correct: number,
  wrong: number,
  blank: number,
): number {
  const solved = correct + wrong + blank;
  if (solved <= 0) return 0;
  return Math.round((correct / solved) * 1000) / 10;
}

export interface ReportEntryRow {
  topicId: number;
  date: string;
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  topicName: string;
  sortOrder: number;
  correct: number;
  wrong: number;
  blank: number;
}

export interface ReportTopic {
  topicId: number;
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  topicName: string;
  sortOrder: number;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
  rate: number;
}

export interface ReportSubject {
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  minSort: number;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
  rate: number;
  topics: ReportTopic[];
}

const EXAM_TYPE_ORDER: Record<string, number> = { TYT: 0, AYT: 1, YDT: 2 };

export function buildSubjectBreakdown(rows: readonly ReportEntryRow[]): ReportSubject[] {
  const topicMap = new Map<
    number,
    {
      topic: ReportTopic;
      correct: number;
      wrong: number;
      blank: number;
    }
  >();

  for (const row of rows) {
    let acc = topicMap.get(row.topicId);
    if (!acc) {
      acc = {
        topic: {
          topicId: row.topicId,
          examType: row.examType,
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          topicName: row.topicName,
          sortOrder: row.sortOrder,
          correct: 0,
          wrong: 0,
          blank: 0,
          solved: 0,
          net: 0,
          rate: 0,
        },
        correct: 0,
        wrong: 0,
        blank: 0,
      };
      topicMap.set(row.topicId, acc);
    }
    acc.correct += row.correct;
    acc.wrong += row.wrong;
    acc.blank += row.blank;
  }

  const subjectMap = new Map<
    string,
    {
      examType: ExamType;
      subjectId: string;
      subjectName: string;
      minSort: number;
      correct: number;
      wrong: number;
      blank: number;
      topics: ReportTopic[];
    }
  >();

  for (const acc of topicMap.values()) {
    const solved = acc.correct + acc.wrong + acc.blank;
    const topic: ReportTopic = {
      ...acc.topic,
      correct: acc.correct,
      wrong: acc.wrong,
      blank: acc.blank,
      solved,
      net: roundNet(netScore(acc.correct, acc.wrong)),
      rate: successRate(acc.correct, acc.wrong, acc.blank),
    };

    const key = `${topic.examType}:${topic.subjectId}`;
    let subject = subjectMap.get(key);
    if (!subject) {
      subject = {
        examType: topic.examType,
        subjectId: topic.subjectId,
        subjectName: topic.subjectName,
        minSort: topic.sortOrder,
        correct: 0,
        wrong: 0,
        blank: 0,
        topics: [],
      };
      subjectMap.set(key, subject);
    }
    subject.correct += topic.correct;
    subject.wrong += topic.wrong;
    subject.blank += topic.blank;
    subject.minSort = Math.min(subject.minSort, topic.sortOrder);
    subject.topics.push(topic);
  }

  const subjects: ReportSubject[] = [...subjectMap.values()].map(
    (subject) => ({
      ...subject,
      solved: subject.correct + subject.wrong + subject.blank,
      net: roundNet(netScore(subject.correct, subject.wrong)),
      rate: successRate(subject.correct, subject.wrong, subject.blank),
      topics: subject.topics.sort((a, b) => {
        if (b.solved !== a.solved) return b.solved - a.solved;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.topicName.localeCompare(b.topicName, "tr");
      }),
    }),
  );

  subjects.sort((a, b) => {
    const ea = EXAM_TYPE_ORDER[a.examType] ?? 99;
    const eb = EXAM_TYPE_ORDER[b.examType] ?? 99;
    if (ea !== eb) return ea - eb;
    if (a.minSort !== b.minSort) return a.minSort - b.minSort;
    return a.subjectId.localeCompare(b.subjectId, "tr");
  });

  return subjects;
}

export interface ReportSummary {
  totalSolved: number;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  rate: number;
  daysWithData: number;
  totalDays: number;
  avgPerActiveDay: number;
  bestDay: { date: string; solved: number } | null;
}

export interface ReportDayRow {
  date: string;
  topicCount: number;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
}

export function buildDayRows(rows: readonly ReportEntryRow[]): ReportDayRow[] {
  const dayMap = new Map<
    string,
    {
      topics: Set<number>;
      correct: number;
      wrong: number;
      blank: number;
    }
  >();

  for (const row of rows) {
    let acc = dayMap.get(row.date);
    if (!acc) {
      acc = { topics: new Set<number>(), correct: 0, wrong: 0, blank: 0 };
      dayMap.set(row.date, acc);
    }
    acc.topics.add(row.topicId);
    acc.correct += row.correct;
    acc.wrong += row.wrong;
    acc.blank += row.blank;
  }

  return [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => {
      const solved = acc.correct + acc.wrong + acc.blank;
      return {
        date,
        topicCount: acc.topics.size,
        correct: acc.correct,
        wrong: acc.wrong,
        blank: acc.blank,
        solved,
        net: roundNet(netScore(acc.correct, acc.wrong)),
      };
    });
}

export function buildSummary(
  rows: readonly ReportEntryRow[],
  totalDays: number,
): ReportSummary {
  let correct = 0;
  let wrong = 0;
  let blank = 0;

  for (const row of rows) {
    correct += row.correct;
    wrong += row.wrong;
    blank += row.blank;
  }

  const dayRows = buildDayRows(rows);
  const totalSolved = correct + wrong + blank;
  let bestDay: { date: string; solved: number } | null = null;
  for (const day of dayRows) {
    if (bestDay === null || day.solved > bestDay.solved) {
      bestDay = { date: day.date, solved: day.solved };
    }
  }

  return {
    totalSolved,
    correct,
    wrong,
    blank,
    net: roundNet(netScore(correct, wrong)),
    rate: successRate(correct, wrong, blank),
    daysWithData: dayRows.length,
    totalDays,
    avgPerActiveDay:
      dayRows.length > 0
        ? Math.round((totalSolved / dayRows.length) * 10) / 10
        : 0,
    bestDay,
  };
}

export interface MockExamRow {
  id: number;
  examName: string;
  examDate: string;
  toplamNet: number;
  tytPuani: number;
}

export interface DenemeAttemptRow {
  id: number;
  date: string;
  denemeKey: string;
  label: string;
  type: string;
  correct: number;
  wrong: number;
  blank: number;
  solved: number;
  net: number;
}

export function buildDenemeAttemptRows(
  rows: readonly {
    id: number;
    date: string;
    denemeKey: string;
    correct: number;
    wrong: number;
    blank: number;
  }[],
): DenemeAttemptRow[] {
  return rows.map((row) => {
    const parsed = parseDenemeKey(row.denemeKey);
    return {
      id: row.id,
      date: row.date,
      denemeKey: row.denemeKey,
      label: getDenemeLabel(row.denemeKey) ?? row.denemeKey,
      type: parsed?.type ?? "",
      correct: row.correct,
      wrong: row.wrong,
      blank: row.blank,
      solved: row.correct + row.wrong + row.blank,
      net: roundNet(netScore(row.correct, row.wrong)),
    };
  });
}

export interface DenemeTypeSummary {
  type: string;
  label: string;
  count: number;
  avgNet: number;
}

export interface DenemeSummary {
  count: number;
  avgNet: number;
  byType: DenemeTypeSummary[];
}

const DENEME_TYPE_LABELS: Record<string, string> = {
  tyt: "TYT",
  ayt: "AYT",
  brans: "Branş",
};

export function buildDenemeSummary(
  rows: readonly DenemeAttemptRow[],
): DenemeSummary {
  if (rows.length === 0) {
    return { count: 0, avgNet: 0, byType: [] };
  }

  const byType = new Map<string, { count: number; netSum: number }>();
  let netSum = 0;
  for (const row of rows) {
    netSum += row.net;
    const key = row.type;
    const current = byType.get(key) ?? { count: 0, netSum: 0 };
    current.count += 1;
    current.netSum += row.net;
    byType.set(key, current);
  }

  return {
    count: rows.length,
    avgNet: roundNet(netSum / rows.length),
    byType: Array.from(byType.entries()).map(([type, value]) => ({
      type,
      label: DENEME_TYPE_LABELS[type] ?? type,
      count: value.count,
      avgNet: roundNet(value.netSum / value.count),
    })),
  };
}

export function filterMocksInRange<T extends { examDate: string }>(
  exams: readonly T[],
  from: string,
  to: string,
): T[] {
  return exams
    .filter((exam) => exam.examDate >= from && exam.examDate <= to)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));
}

export type MockExamWithDiff<T> = T & { netDiff: number | null };

export function withMockDiffs<T extends { toplamNet: number }>(
  exams: readonly T[],
): MockExamWithDiff<T>[] {
  let previous: number | null = null;
  return exams.map((exam) => {
    const diff =
      previous === null ? null : roundNet(exam.toplamNet - previous);
    previous = exam.toplamNet;
    return { ...exam, netDiff: diff };
  });
}

export function excelSafeCell(value: unknown): unknown {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function reportFileNumberPart(studentNumber: string | null): string {
  return (studentNumber ?? "").replace(/[^0-9a-zA-Z]/g, "") || "ogrenci";
}

export function reportFileName(
  studentNumber: string | null,
  from: string,
  to: string,
): string {
  return `rapor_${reportFileNumberPart(studentNumber)}_${from}_${to}`;
}

export function excelFileName(
  studentNumber: string | null,
  from: string,
  to: string,
): string {
  return `${reportFileName(studentNumber, from, to)}.xlsx`;
}

export interface ReportSheet {
  name: string;
  rows: unknown[][];
}

export interface SheetExportOptions {
  includeDailyDetail: boolean;
  includeNotes: boolean;
}

function safeRow(row: unknown[]): unknown[] {
  return row.map(excelSafeCell);
}

function formatLocalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}.${String(m).padStart(2, "0")}.${y}`;
}

export function buildReportSheets(report: {
  student: { name: string; studentNumber: string | null };
  range: { from: string; to: string };
  generatedAt: string;
  summary: ReportSummary;
  subjects: ReportSubject[];
  days: ReportDayRow[];
  notes: { date: string; note: string }[];
  mocks: (MockExamRow & { netDiff: number | null })[];
  denemeAttempts?: DenemeAttemptRow[];
}, options: SheetExportOptions): ReportSheet[] {
  const sheets: ReportSheet[] = [];

  const summarySheet: unknown[][] = [
    ["Öğrenci", report.student.name],
    ["Numara", report.student.studentNumber ?? ""],
    ["Başlangıç", formatLocalDate(report.range.from)],
    ["Bitiş", formatLocalDate(report.range.to)],
    [],
    ["Toplam Soru", report.summary.totalSolved],
    ["Doğru", report.summary.correct],
    ["Yanlış", report.summary.wrong],
    ["Boş", report.summary.blank],
    ["Net", report.summary.net],
    ["Başarı %", report.summary.rate],
    [
      "Veri Girilen Gün",
      `${report.summary.daysWithData} / ${report.summary.totalDays}`,
    ],
    ["Günlük Ortalama", report.summary.avgPerActiveDay],
    [
      "En Çok Soru Çözülen Gün",
      report.summary.bestDay
        ? `${formatLocalDate(report.summary.bestDay.date)} (${report.summary.bestDay.solved})`
        : "-",
    ],
  ];
  sheets.push({ name: "Özet", rows: summarySheet.map(safeRow) });

  const subjectRows: unknown[][] = [
    ["Sınav Türü", "Ders", "Konu", "Soru", "Doğru", "Yanlış", "Boş", "Net", "Başarı %"],
  ];
  for (const subject of report.subjects) {
    subjectRows.push([
      subject.examType,
      subject.subjectName,
      "TOPLAM",
      subject.solved,
      subject.correct,
      subject.wrong,
      subject.blank,
      subject.net,
      subject.rate,
    ]);
    for (const topic of subject.topics) {
      subjectRows.push([
        topic.examType,
        topic.subjectName,
        topic.topicName,
        topic.solved,
        topic.correct,
        topic.wrong,
        topic.blank,
        topic.net,
        topic.rate,
      ]);
    }
  }
  sheets.push({ name: "Ders-Konu", rows: subjectRows.map(safeRow) });

  if (options.includeDailyDetail) {
    const dayRows: unknown[][] = [
      ["Gün", "Konu Sayısı", "Soru", "Doğru", "Yanlış", "Boş", "Net"],
    ];
    for (const day of report.days) {
      dayRows.push([
        formatLocalDate(day.date),
        day.topicCount,
        day.solved,
        day.correct,
        day.wrong,
        day.blank,
        day.net,
      ]);
    }
    sheets.push({ name: "Günlük Detay", rows: dayRows.map(safeRow) });
  }

  if (options.includeNotes && report.notes.length > 0) {
    const noteRows: unknown[][] = [["Tarih", "Not"]];
    for (const note of report.notes) {
      noteRows.push([formatLocalDate(note.date), note.note]);
    }
    sheets.push({ name: "Günün Özeti", rows: noteRows.map(safeRow) });
  }

  const denemeRows = report.denemeAttempts ?? [];
  if (denemeRows.length > 0) {
    const rows: unknown[][] = [
      ["Tarih", "Deneme", "Doğru", "Yanlış", "Boş", "Çözülen", "Net"],
    ];
    for (const attempt of denemeRows) {
      rows.push([
        formatLocalDate(attempt.date),
        attempt.label,
        attempt.correct,
        attempt.wrong,
        attempt.blank,
        attempt.solved,
        attempt.net,
      ]);
    }
    sheets.push({ name: "Öğrenci Denemeleri", rows: rows.map(safeRow) });
  }

  if (report.mocks.length > 0) {
    const mockRows: unknown[][] = [
      [
        "Tarih",
        "Deneme",
        "Toplam Net",
        "Net Farkı",
        "TYT Puanı",
      ],
    ];
    for (const mock of report.mocks) {
      mockRows.push([
        formatLocalDate(mock.examDate),
        mock.examName,
        mock.toplamNet,
        mock.netDiff === null ? "-" : mock.netDiff,
        mock.tytPuani,
      ]);
    }
    sheets.push({ name: "Deneme Sonuçları", rows: mockRows.map(safeRow) });
  }

  return sheets;
}
