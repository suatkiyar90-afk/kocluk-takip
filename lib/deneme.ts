import { z } from "zod";
import { addDaysISO } from "@/lib/week-utils";
import { MAX_COUNT } from "@/lib/daily-entry-list";

export const denemeTypeOptions = [
  { key: "tyt", label: "TYT Denemesi" },
  { key: "ayt", label: "AYT Denemesi" },
  { key: "brans", label: "Branş Denemesi" },
] as const;

export type DenemeBaseType = (typeof denemeTypeOptions)[number]["key"];

export const bransSubjects = [
  { id: "turkce", name: "Türkçe" },
  { id: "matematik", name: "Matematik" },
  { id: "geometri", name: "Geometri" },
  { id: "fizik", name: "Fizik" },
  { id: "kimya", name: "Kimya" },
  { id: "biyoloji", name: "Biyoloji" },
  { id: "edebiyat", name: "Edebiyat" },
  { id: "tarih", name: "Tarih" },
  { id: "cografya", name: "Coğrafya" },
  { id: "felsefe", name: "Felsefe" },
  { id: "din-kulturu", name: "Din Kültürü" },
  { id: "ingilizce", name: "İngilizce" },
] as const;

export type BransSubjectId = (typeof bransSubjects)[number]["id"];

export interface ParsedDenemeKey {
  type: DenemeBaseType;
  bransSubjectId: BransSubjectId | null;
}

export function buildDenemeKey(type: "tyt" | "ayt"): string;
export function buildDenemeKey(type: "brans", subjectId: BransSubjectId): string;
export function buildDenemeKey(
  type: DenemeBaseType,
  subjectId?: BransSubjectId,
): string {
  if (type === "brans") {
    return `brans:${subjectId ?? ""}`;
  }
  return type;
}

export function parseDenemeKey(key: unknown): ParsedDenemeKey | null {
  if (typeof key !== "string") return null;
  if (key === "tyt" || key === "ayt") {
    return { type: key, bransSubjectId: null };
  }
  if (key.startsWith("brans:")) {
    const subjectId = key.slice("brans:".length);
    const match = bransSubjects.find((s) => s.id === subjectId);
    if (!match) return null;
    return { type: "brans", bransSubjectId: match.id };
  }
  return null;
}

export function isValidDenemeKey(key: unknown): boolean {
  return parseDenemeKey(key) !== null;
}

export function getDenemeLabel(key: unknown): string | null {
  const parsed = parseDenemeKey(key);
  if (parsed === null) return null;
  if (parsed.type === "brans") {
    const subject = bransSubjects.find((s) => s.id === parsed.bransSubjectId);
    if (!subject) return null;
    return `${subject.name} Branş Denemesi`;
  }
  return parsed.type === "tyt" ? "TYT Denemesi" : "AYT Denemesi";
}

export const DENEME_RULES = {
  tyt: {
    totalQuestions: 120,
    minSolved: 1,
  },
  ayt: {
    maxSolved: 160,
    minSolved: 1,
  },
  brans: {
    maxSolved: 120,
    minSolved: 1,
  },
} as const;

export const MAX_DAY_ATTEMPTS = 10;
export const MAX_WEEK_TARGET_COUNT = 14;
export const MIN_WEEK_TARGET_COUNT = 1;
export const MAX_DENEME_TARGET_ROWS = 10;

export interface DenemeCounts {
  correct: number;
  wrong: number;
  blank?: number;
}

export function resolveTytBlank(correct: number, wrong: number): number {
  return DENEME_RULES.tyt.totalQuestions - correct - wrong;
}

export function validateDenemeCounts(
  denemeKey: string,
  counts: DenemeCounts,
): string | null {
  const parsed = parseDenemeKey(denemeKey);
  if (parsed === null) {
    return "Geçersiz deneme türü.";
  }

  const { correct, wrong, blank } = counts;
  for (const [name, value] of [
    ["Doğru", correct],
    ["Yanlış", wrong],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_COUNT) {
      return `${name} değeri 0 ile ${MAX_COUNT} arasında tam sayı olmalı.`;
    }
  }

  if (parsed.type === "tyt") {
    if (correct + wrong > DENEME_RULES.tyt.totalQuestions) {
      return `TYT denemesinde Doğru + Yanlış en fazla ${DENEME_RULES.tyt.totalQuestions} olabilir.`;
    }
    if (correct + wrong < DENEME_RULES.tyt.minSolved) {
      return "Deneme toplamı en az 1 soru olmalı.";
    }
    return null;
  }

  if (
    blank === undefined ||
    !Number.isInteger(blank) ||
    blank < 0 ||
    blank > MAX_COUNT
  ) {
    return `Boş değeri 0 ile ${MAX_COUNT} arasında tam sayı olmalı.`;
  }

  const rules = parsed.type === "ayt" ? DENEME_RULES.ayt : DENEME_RULES.brans;
  const solved = correct + wrong + blank;
  if (solved < rules.minSolved) {
    return "Deneme toplamı en az 1 soru olmalı.";
  }
  if (solved > rules.maxSolved) {
    return parsed.type === "ayt"
      ? `AYT denemesinde Doğru + Yanlış + Boş en fazla ${rules.maxSolved} olabilir.`
      : `Branş denemesinde Doğru + Yanlış + Boş en fazla ${rules.maxSolved} olabilir.`;
  }
  return null;
}

export const denemeAttemptSchema = z
  .object({
    denemeKey: z
      .string()
      .refine(isValidDenemeKey, "Geçersiz deneme türü."),
    correct: z
      .number()
      .int("Doğru tam sayı olmalı.")
      .min(0, "Negatif değer girilemez.")
      .max(MAX_COUNT, `Doğru en fazla ${MAX_COUNT} olabilir.`),
    wrong: z
      .number()
      .int("Yanlış tam sayı olmalı.")
      .min(0, "Negatif değer girilemez.")
      .max(MAX_COUNT, `Yanlış en fazla ${MAX_COUNT} olabilir.`),
    blank: z
      .number()
      .int("Boş tam sayı olmalı.")
      .min(0, "Negatif değer girilemez.")
      .max(MAX_COUNT, `Boş en fazla ${MAX_COUNT} olabilir.`)
      .optional(),
  })
  .superRefine(
    (
      row: { denemeKey: string; correct: number; wrong: number; blank?: number },
      ctx,
    ) => {
      const message = validateDenemeCounts(row.denemeKey, row);
      if (message !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
        });
      }
    },
  );

export type DenemeAttemptInput = z.infer<typeof denemeAttemptSchema>;

export const denemeTargetRowSchema = z.object({
  denemeKey: z
    .string()
    .refine(isValidDenemeKey, "Geçersiz deneme türü."),
  targetCount: z
    .number()
    .int("Adet tam sayı olmalı.")
    .min(MIN_WEEK_TARGET_COUNT, `Adet en az ${MIN_WEEK_TARGET_COUNT} olmalı.`)
    .max(
      MAX_WEEK_TARGET_COUNT,
      `Adet en fazla ${MAX_WEEK_TARGET_COUNT} olabilir.`,
    ),
});

export type DenemeTargetRow = z.infer<typeof denemeTargetRowSchema>;

export function mergeDenemeTargetRows(
  rows: DenemeTargetRow[],
): { rows: DenemeTargetRow[]; error: string | null } {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const total = (merged.get(row.denemeKey) ?? 0) + row.targetCount;
    if (total > MAX_WEEK_TARGET_COUNT) {
      return {
        rows: [],
        error: `Aynı deneme türünün toplam adedi en fazla ${MAX_WEEK_TARGET_COUNT} olabilir.`,
      };
    }
    merged.set(row.denemeKey, total);
  }
  return {
    rows: [...merged.entries()].map(([denemeKey, targetCount]) => ({
      denemeKey,
      targetCount,
    })),
    error: null,
  };
}

export interface DenemeTargetLike {
  denemeKey: string;
  targetCount: number;
}

export interface DenemeAttemptLike {
  date: string;
  denemeKey: string;
}

export interface DenemeProgressRow {
  denemeKey: string;
  targetCount: number;
  solvedCount: number;
  reached: boolean;
}

export function computeDenemeProgress(
  weekStart: string,
  targets: DenemeTargetLike[],
  attempts: DenemeAttemptLike[],
): DenemeProgressRow[] {
  const weekEnd = addDaysISO(weekStart, 6);
  const attemptsInWeek = attempts.filter(
    (attempt) => attempt.date >= weekStart && attempt.date <= weekEnd,
  );
  return targets.map((target) => {
    const solvedCount = attemptsInWeek.filter(
      (attempt) => attempt.denemeKey === target.denemeKey,
    ).length;
    return {
      denemeKey: target.denemeKey,
      targetCount: target.targetCount,
      solvedCount,
      reached: solvedCount >= target.targetCount,
    };
  });
}
