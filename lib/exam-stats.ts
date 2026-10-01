import type { MockExamRecord } from "@/app/actions/mock-exam-actions";
import { MOCK_EXAM_BRANCHES } from "@/components/exams/mock-exam-history";

export interface SubjectRow {
  label: string;
  last: number;
  prev: number;
  delta: number | null;
}

export interface TimelinePoint {
  date: string;
  puan: number;
  net: number;
}

export function buildTimeline(records: MockExamRecord[]): TimelinePoint[] {
  return [...records].reverse().map((r) => ({
    date: r.examDate,
    puan: r.tytPuani,
    net: r.toplamNet,
  }));
}

export function buildSubjectRows(records: MockExamRecord[]): SubjectRow[] {
  const lastRecord = records[0];
  if (!lastRecord) {
    return [];
  }
  const prevRecord = records[1];
  return MOCK_EXAM_BRANCHES.map((b) => {
    const last = lastRecord[b.key];
    const prev = prevRecord ? prevRecord[b.key] : 0;
    const delta = prevRecord
      ? Math.round((last - prevRecord[b.key]) * 100) / 100
      : null;
    return {
      label: b.label,
      last,
      prev,
      delta,
    };
  });
}

export function hasPreviousExam(records: MockExamRecord[]): boolean {
  return records.length >= 2;
}
