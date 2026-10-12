import { successRate } from "@/lib/report-utils";
import { addDaysISO } from "@/lib/week-utils";

export interface DailySubjectRow {
  date: string;
  subjectId: string;
  correct: number;
  wrong: number;
  blank: number;
}

export interface SubjectTrend {
  subjectName: string;
  fromPct: number;
  toPct: number;
  delta: number;
}

export interface DenemeTrend {
  oldAvg: number;
  newAvg: number;
}

export interface DayTotal {
  date: string;
  total: number;
}

export type RecordScope = "all-time" | "week";

export interface DayRecord {
  scope: RecordScope;
  total: number;
}

export function countDaysEntered(dates: string[], weekStart: string): number {
  const weekEnd = addDaysISO(weekStart, 6);
  const days = new Set<string>();
  for (const date of dates) {
    if (date >= weekStart && date <= weekEnd) days.add(date);
  }
  return days.size;
}

export interface RingMotivation {
  complete: boolean;
  message: string | null;
}

export function ringMotivation(
  targetPct: number | null,
  daysEntered: number,
): RingMotivation {
  const pct = targetPct ?? (daysEntered / 7) * 100;
  if (pct >= 100) {
    return { complete: true, message: "Hedef Tamamlandı 🚀" };
  }
  if (pct >= 70) {
    return {
      complete: false,
      message: "Çok iyi gidiyorsun, hedefe çok az kaldı!",
    };
  }
  return { complete: false, message: null };
}

function weekIndexOf(date: string, weekStart: string): number {
  if (date >= weekStart) return 2;
  if (date >= addDaysISO(weekStart, -7)) return 1;
  if (date >= addDaysISO(weekStart, -14)) return 0;
  return -1;
}

interface WeekAccumulator {
  correct: number;
  wrong: number;
  blank: number;
}

export function computeSubjectTrends(
  rows: DailySubjectRow[],
  subjectNames: ReadonlyMap<string, string>,
  weekStart: string,
): SubjectTrend[] {
  const bySubject = new Map<string, Map<number, WeekAccumulator>>();

  for (const row of rows) {
    const weekIndex = weekIndexOf(row.date, weekStart);
    if (weekIndex < 0) continue;
    let weeks = bySubject.get(row.subjectId);
    if (!weeks) {
      weeks = new Map<number, WeekAccumulator>();
      bySubject.set(row.subjectId, weeks);
    }
    const acc = weeks.get(weekIndex) ?? { correct: 0, wrong: 0, blank: 0 };
    acc.correct += row.correct;
    acc.wrong += row.wrong;
    acc.blank += row.blank;
    weeks.set(weekIndex, acc);
  }

  const trends: SubjectTrend[] = [];
  for (const [subjectId, weeks] of bySubject) {
    const weeksWithData = [...weeks.keys()]
      .filter((index) => {
        const acc = weeks.get(index)!;
        return acc.correct + acc.wrong + acc.blank > 0;
      })
      .sort((a, b) => a - b);
    if (weeksWithData.length < 2) continue;

    const fromIndex = weeksWithData[0];
    const toIndex = weeksWithData[weeksWithData.length - 1];
    if (fromIndex >= toIndex) continue;

    const fromAcc = weeks.get(fromIndex)!;
    const toAcc = weeks.get(toIndex)!;
    const fromPct = successRate(fromAcc.correct, fromAcc.wrong, fromAcc.blank);
    const toPct = successRate(toAcc.correct, toAcc.wrong, toAcc.blank);

    trends.push({
      subjectName: subjectNames.get(subjectId) ?? subjectId,
      fromPct,
      toPct,
      delta: Math.round((toPct - fromPct) * 10) / 10,
    });
  }

  trends.sort((a, b) => b.delta - a.delta || b.toPct - a.toPct);
  return trends.slice(0, 4);
}

export function computeDenemeTrend(
  netsNewestFirst: number[],
): DenemeTrend | null {
  if (netsNewestFirst.length < 4) return null;
  const recent = netsNewestFirst.slice(0, 3);
  const older = netsNewestFirst.slice(3, 6);
  if (older.length === 0) return null;
  const avg = (values: number[]): number =>
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10;
  return { newAvg: avg(recent), oldAvg: avg(older) };
}

export function computeRecord(
  today: string,
  weekStart: string,
  dayTotals: DayTotal[],
): DayRecord | null {
  const todayTotal = dayTotals.find((day) => day.date === today)?.total ?? 0;
  if (todayTotal <= 0) return null;

  const others = dayTotals.filter((day) => day.date !== today);
  const allTimeMax = others.reduce(
    (max, day) => (day.total > max ? day.total : max),
    0,
  );
  if (todayTotal > allTimeMax) {
    return { scope: "all-time", total: todayTotal };
  }

  const weekEnd = addDaysISO(weekStart, 6);
  const weekOthers = others.filter(
    (day) => day.date >= weekStart && day.date <= weekEnd,
  );
  if (weekOthers.length === 0) return null;
  const weekMax = weekOthers.reduce(
    (max, day) => (day.total > max ? day.total : max),
    0,
  );
  if (todayTotal > weekMax) {
    return { scope: "week", total: todayTotal };
  }

  return null;
}

export interface WeeklySummaryStats {
  daysEntered: number;
  totalQuestions: number;
  bestSubject: SubjectTrend | null;
}

export function summarizeLastWeek(
  rows: DailySubjectRow[],
  subjectNames: ReadonlyMap<string, string>,
  weekStart: string,
): WeeklySummaryStats {
  const lastWeekStart = addDaysISO(weekStart, -7);
  const lastWeekEnd = addDaysISO(weekStart, -1);
  const lastWeekRows = rows.filter(
    (row) => row.date >= lastWeekStart && row.date <= lastWeekEnd,
  );
  const daysEntered = countDaysEntered(
    lastWeekRows.map((row) => row.date),
    lastWeekStart,
  );
  const totalQuestions = lastWeekRows.reduce(
    (sum, row) => sum + row.correct + row.wrong + row.blank,
    0,
  );
  const trends = computeSubjectTrends(rows, subjectNames, lastWeekStart);
  const bestSubject = trends.find((trend) => trend.delta > 0) ?? null;
  return { daysEntered, totalQuestions, bestSubject };
}
