import {
  ALL_SUBJECTS,
  examTypes,
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";

export interface ListEntry {
  topicId: number;
  subjectId: string;
  subjectName: string;
  examType: ExamType;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
}

export const MAX_DAY_ENTRIES = 30;
export const MAX_COUNT = 300;

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_COUNT, Math.max(0, Math.floor(n)));
}

export function entryQuestions(entry: ListEntry): number {
  return entry.correct + entry.wrong + entry.blank;
}

export function entryNet(entry: ListEntry): number {
  return Math.round(netScore(entry.correct, entry.wrong) * 100) / 100;
}

export function addOrMergeEntry(
  list: ListEntry[],
  entry: ListEntry,
): { list: ListEntry[]; merged: boolean } {
  const index = list.findIndex((item) => item.topicId === entry.topicId);
  if (index === -1) {
    return { list: [...list, entry], merged: false };
  }
  const current = list[index];
  const next = [...list];
  next[index] = {
    ...current,
    correct: clampCount(current.correct + entry.correct),
    wrong: clampCount(current.wrong + entry.wrong),
    blank: clampCount(current.blank + entry.blank),
  };
  return { list: next, merged: true };
}

export function removeEntry(list: ListEntry[], topicId: number): ListEntry[] {
  return list.filter((item) => item.topicId !== topicId);
}

export function restoreEntry(
  list: ListEntry[],
  entry: ListEntry,
  index: number,
): ListEntry[] {
  if (list.some((item) => item.topicId === entry.topicId)) return list;
  const target = Math.min(Math.max(index, 0), list.length);
  const next = [...list];
  next.splice(target, 0, entry);
  return next;
}

export interface ListTotals {
  topics: number;
  questions: number;
  net: number;
}

export function listTotals(list: ListEntry[]): ListTotals {
  let questions = 0;
  let net = 0;
  for (const entry of list) {
    questions += entryQuestions(entry);
    net += netScore(entry.correct, entry.wrong);
  }
  return {
    topics: list.length,
    questions,
    net: Math.round(net * 100) / 100,
  };
}

export interface EntryGroup {
  key: string;
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  entries: ListEntry[];
  questions: number;
  net: number;
}

function groupRank(group: {
  examType: ExamType;
  subjectId: string;
}): number {
  const examRank = examTypes.indexOf(group.examType);
  const subjectRank = ALL_SUBJECTS[group.examType].findIndex(
    (subject) => subject.id === group.subjectId,
  );
  return examRank * 100 + (subjectRank === -1 ? 99 : subjectRank);
}

export function groupEntriesBySubject(list: ListEntry[]): EntryGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, EntryGroup>();
  for (const entry of list) {
    const key = `${entry.examType}:${entry.subjectId}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        examType: entry.examType,
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        entries: [],
        questions: 0,
        net: 0,
      };
      byKey.set(key, group);
      order.push(key);
    }
    group.entries.push(entry);
    group.questions += entryQuestions(entry);
    group.net += netScore(entry.correct, entry.wrong);
  }
  const groups = order.map((key) => byKey.get(key)!);
  for (const group of groups) {
    group.net = Math.round(group.net * 100) / 100;
  }
  return groups.sort((a, b) => groupRank(a) - groupRank(b));
}

export function validateEntryList(list: ListEntry[]): string | null {
  if (list.length > MAX_DAY_ENTRIES) {
    return `En fazla ${MAX_DAY_ENTRIES} satır eklenebilir.`;
  }
  const seen = new Set<number>();
  for (const entry of list) {
    if (!Number.isInteger(entry.topicId) || entry.topicId <= 0) {
      return "Geçersiz konu.";
    }
    if (seen.has(entry.topicId)) {
      return "Aynı konu listede birden fazla kez olamaz.";
    }
    seen.add(entry.topicId);
    for (const value of [entry.correct, entry.wrong, entry.blank]) {
      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > MAX_COUNT
      ) {
        return `Doğru, Yanlış ve Boş değerleri 0 ile ${MAX_COUNT} arasında olmalı.`;
      }
    }
    if (entryQuestions(entry) <= 0) {
      return "Her satırın toplamı en az 1 soru olmalı.";
    }
  }
  return null;
}

export interface EntryDraft {
  v: 1;
  date: string;
  entries: ListEntry[];
  attempts?: DraftAttempt[];
  summary: string;
  savedAt: string;
}

export interface DraftAttempt {
  denemeKey: string;
  correct: number;
  wrong: number;
  blank: number;
}

const MAX_DRAFT_ATTEMPTS = 10;

export function draftKey(studentId: string, date: string): string {
  return `daily-entry-draft:${studentId}:${date}`;
}

export function serializeDraft(draft: EntryDraft): string | null {
  try {
    return JSON.stringify(draft);
  } catch {
    return null;
  }
}

function isExamType(value: unknown): value is ExamType {
  return value === "TYT" || value === "AYT" || value === "YDT";
}

function isEntryLike(value: unknown): value is ListEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.topicId === "number" &&
    Number.isInteger(entry.topicId) &&
    typeof entry.subjectId === "string" &&
    typeof entry.subjectName === "string" &&
    isExamType(entry.examType) &&
    typeof entry.topicName === "string" &&
    typeof entry.correct === "number" &&
    Number.isInteger(entry.correct) &&
    typeof entry.wrong === "number" &&
    Number.isInteger(entry.wrong) &&
    typeof entry.blank === "number" &&
    Number.isInteger(entry.blank)
  );
}

function isDraftAttemptLike(value: unknown): value is DraftAttempt {
  if (typeof value !== "object" || value === null) return false;
  const attempt = value as Record<string, unknown>;
  return (
    typeof attempt.denemeKey === "string" &&
    attempt.denemeKey.length > 0 &&
    typeof attempt.correct === "number" &&
    Number.isInteger(attempt.correct) &&
    attempt.correct >= 0 &&
    typeof attempt.wrong === "number" &&
    Number.isInteger(attempt.wrong) &&
    attempt.wrong >= 0 &&
    typeof attempt.blank === "number" &&
    Number.isInteger(attempt.blank) &&
    attempt.blank >= 0
  );
}

export function parseDraft(raw: string | null): EntryDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EntryDraft>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.v !== 1 ||
      typeof parsed.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.entries) ||
      parsed.entries.length > MAX_DAY_ENTRIES ||
      !parsed.entries.every(isEntryLike)
    ) {
      return null;
    }
    const attempts =
      Array.isArray(parsed.attempts) &&
      parsed.attempts.length <= MAX_DRAFT_ATTEMPTS &&
      parsed.attempts.every(isDraftAttemptLike)
        ? parsed.attempts
        : undefined;
    return {
      v: 1,
      date: parsed.date,
      entries: parsed.entries,
      attempts,
      summary: parsed.summary,
      savedAt:
        typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

export function mergeDraftWithServer(
  draft: EntryDraft,
  server: ListEntry[],
): { entries: ListEntry[]; conflicts: number } {
  const serverByTopic = new Map(
    server.map((entry) => [entry.topicId, entry]),
  );
  let conflicts = 0;
  const merged = [...server];
  const mergedIndex = new Map(
    merged.map((entry, index) => [entry.topicId, index]),
  );
  for (const draftEntry of draft.entries) {
    const serverEntry = serverByTopic.get(draftEntry.topicId);
    if (serverEntry) {
      const differs =
        serverEntry.correct !== draftEntry.correct ||
        serverEntry.wrong !== draftEntry.wrong ||
        serverEntry.blank !== draftEntry.blank;
      if (differs) conflicts += 1;
      continue;
    }
    if (!mergedIndex.has(draftEntry.topicId)) {
      merged.push(draftEntry);
      mergedIndex.set(draftEntry.topicId, merged.length - 1);
    }
  }
  return { entries: merged, conflicts };
}
