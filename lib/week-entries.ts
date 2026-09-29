import { netScore } from "@/components/quiz-entry/weekly-quiz-schema";
import { addDaysISO } from "./week-utils";

export interface DailyEntryLike {
  date: string;
  correct: number;
  wrong: number;
  blank: number;
}

export interface WeekEntryTotals {
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  net: number;
  hasEntries: boolean;
  lastEntryDate: string | null;
}

export function weekEndOf(weekStart: string): string {
  return addDaysISO(weekStart, 6);
}

export function isDateInWeek(date: string, weekStart: string): boolean {
  return date >= weekStart && date <= weekEndOf(weekStart);
}

export function aggregateWeekEntries(
  entries: DailyEntryLike[],
  weekStart: string,
): WeekEntryTotals {
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let hasEntries = false;
  let lastEntryDate: string | null = null;

  for (const entry of entries) {
    if (!isDateInWeek(entry.date, weekStart)) continue;
    hasEntries = true;
    correct += entry.correct;
    wrong += entry.wrong;
    blank += entry.blank;
    if (lastEntryDate === null || entry.date > lastEntryDate) {
      lastEntryDate = entry.date;
    }
  }

  return {
    correct,
    wrong,
    blank,
    total: correct + wrong + blank,
    net: netScore(correct, wrong),
    hasEntries,
    lastEntryDate,
  };
}
