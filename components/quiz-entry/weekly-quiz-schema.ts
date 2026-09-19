import { z } from "zod";

export const examTypes = ["TYT", "AYT"] as const;
export type ExamType = (typeof examTypes)[number];

export interface SubjectDef {
  id: string;
  name: string;
  maxQuestions: number;
}

export const TYT_SUBJECTS: SubjectDef[] = [
  { id: "turkce", name: "Türkçe", maxQuestions: 40 },
  { id: "sosyal", name: "Sosyal Bilimler", maxQuestions: 20 },
  { id: "matematik", name: "Temel Matematik", maxQuestions: 40 },
  { id: "fen", name: "Fen Bilimleri", maxQuestions: 20 },
];

export const AYT_SUBJECTS: SubjectDef[] = [
  { id: "edebiyat", name: "Türk Dili ve Edebiyatı", maxQuestions: 24 },
  { id: "tarih1", name: "Tarih (S1)", maxQuestions: 10 },
  { id: "cografya1", name: "Coğrafya (S1)", maxQuestions: 6 },
  { id: "matematik-ayt", name: "Matematik", maxQuestions: 40 },
  { id: "fizik", name: "Fizik", maxQuestions: 14 },
  { id: "kimya", name: "Kimya", maxQuestions: 13 },
  { id: "biyoloji", name: "Biyoloji", maxQuestions: 13 },
  { id: "tarih2", name: "Tarih (S2)", maxQuestions: 11 },
  { id: "cografya2", name: "Coğrafya (S2)", maxQuestions: 12 },
  { id: "felsefe", name: "Felsefe", maxQuestions: 6 },
  { id: "din", name: "Din Kültürü ve Ahlak Bilgisi", maxQuestions: 6 },
];

export const ALL_SUBJECTS: Record<ExamType, SubjectDef[]> = {
  TYT: TYT_SUBJECTS,
  AYT: AYT_SUBJECTS,
};

export const countField = z
  .coerce.number()
  .int("Tam sayı girin")
  .min(0, "Negatif değer girilemez");

export const baseEntrySchema = z.object({
  examType: z.enum(examTypes),
  subjectId: z.string().min(1, "Ders seçilmedi"),
  correct: countField,
  wrong: countField,
  blank: countField,
});

export type EntryValues = z.infer<typeof baseEntrySchema>;

export const weeklyQuizSchema = z.object({
  weekStart: z.string().min(1, "Hafta başlangıç tarihi gerekli"),
  categories: z.array(baseEntrySchema),
});

export type WeeklyQuizFormValues = z.infer<typeof weeklyQuizSchema>;

export function buildDefaultValues(
  weekStart?: string,
): WeeklyQuizFormValues {
  const date = weekStart ?? new Date().toISOString().slice(0, 10);
  const entry =
    (examType: ExamType) =>
    (s: SubjectDef): EntryValues => ({
      examType,
      subjectId: s.id,
      correct: 0,
      wrong: 0,
      blank: 0,
    });
  return {
    weekStart: date,
    categories: [
      ...TYT_SUBJECTS.map(entry("TYT")),
      ...AYT_SUBJECTS.map(entry("AYT")),
    ],
  };
}

export function getSubject(
  examType: ExamType,
  subjectId: string,
): SubjectDef | undefined {
  return ALL_SUBJECTS[examType].find((s) => s.id === subjectId);
}

export function mergeInitialEntries(
  base: WeeklyQuizFormValues,
  entries: EntryValues[] | undefined,
): WeeklyQuizFormValues {
  if (!entries || entries.length === 0) return base;
  const byKey = new Map<string, EntryValues>();
  for (const e of entries) {
    byKey.set(`${e.examType}:${e.subjectId}`, e);
  }
  return {
    ...base,
    categories: base.categories.map(
      (c) => byKey.get(`${c.examType}:${c.subjectId}`) ?? c,
    ),
  };
}

export function netScore(correct: number, wrong: number): number {
  return correct - wrong / 4;
}