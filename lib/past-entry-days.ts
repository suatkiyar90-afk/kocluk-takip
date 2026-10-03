import { addDaysISO } from "@/lib/week-utils";
import {
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";

export interface PastRowInput {
  id: number;
  date: string;
  examType: ExamType;
  subjectName: string;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
}

export interface PastTopicEntry {
  id: number;
  examType: ExamType;
  subjectName: string;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
  questions: number;
  net: number;
}

export interface PastDayGroup {
  date: string;
  label: string;
  isYesterday: boolean;
  summary: string | null;
  topics: PastTopicEntry[];
  questions: number;
  net: number;
}

export interface PastDayPage {
  days: PastDayGroup[];
  hasMore: boolean;
  nextCursor: string | null;
}

function roundNet(value: number): number {
  return Math.round(value * 100) / 100;
}

export function dayLabel(
  date: string,
  today: string,
): { label: string; isYesterday: boolean } {
  const yesterday = addDaysISO(today, -1);
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (date === yesterday) {
    const short = parsed.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return { label: `Dün · ${short}`, isYesterday: true };
  }
  const full = parsed.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const weekday = parsed.toLocaleDateString("tr-TR", { weekday: "long" });
  return { label: `${full}, ${weekday}`, isYesterday: false };
}

export function groupPastRows(
  rows: PastRowInput[],
  notes: Record<string, string>,
  today: string,
): PastDayGroup[] {
  const byDate = new Map<string, PastTopicEntry[]>();
  for (const row of rows) {
    if (row.date >= today) continue;
    const questions = row.correct + row.wrong + row.blank;
    const entry: PastTopicEntry = {
      id: row.id,
      examType: row.examType,
      subjectName: row.subjectName,
      topicName: row.topicName,
      correct: row.correct,
      wrong: row.wrong,
      blank: row.blank,
      questions,
      net: roundNet(netScore(row.correct, row.wrong)),
    };
    const list = byDate.get(row.date);
    if (list) {
      list.push(entry);
    } else {
      byDate.set(row.date, [entry]);
    }
  }

  const groups: PastDayGroup[] = [];
  for (const [date, topics] of byDate) {
    let questions = 0;
    let net = 0;
    for (const topic of topics) {
      questions += topic.questions;
      net += netScore(topic.correct, topic.wrong);
    }
    const { label, isYesterday } = dayLabel(date, today);
    groups.push({
      date,
      label,
      isYesterday,
      summary: notes[date] ?? null,
      topics,
      questions,
      net: roundNet(net),
    });
  }
  groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return groups;
}

export function paginatePastGroups(
  groups: PastDayGroup[],
  limit: number,
): PastDayPage {
  const take = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 7;
  const days = groups.slice(0, take);
  const hasMore = groups.length > take;
  return {
    days,
    hasMore,
    nextCursor: days.length > 0 ? days[days.length - 1].date : null,
  };
}
