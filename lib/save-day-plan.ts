import { z } from "zod";
import { examTypes } from "@/components/quiz-entry/weekly-quiz-schema";
import { MAX_DAY_ENTRIES, MAX_COUNT } from "@/lib/daily-entry-list";

export const saveDayRowSchema = z
  .object({
    topicId: z.number().int().positive("Geçersiz konu."),
    examType: z.enum(examTypes),
    subjectId: z.string().min(1).max(50),
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
      .max(MAX_COUNT, `Boş en fazla ${MAX_COUNT} olabilir.`),
  })
  .refine(
    (row) => row.correct + row.wrong + row.blank > 0,
    { message: "Satır toplamı en az 1 soru olmalı." },
  );

export const saveDaySchema = z
  .object({
    entries: z
      .array(saveDayRowSchema)
      .max(MAX_DAY_ENTRIES, `En fazla ${MAX_DAY_ENTRIES} satır kaydedilebilir.`),
    summary: z
      .string()
      .max(2000, "Günün özeti en fazla 2000 karakter olabilir."),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    value.entries.forEach((entry, index) => {
      if (seen.has(entry.topicId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries", index, "topicId"],
          message: "Aynı konu listede birden fazla kez olamaz.",
        });
      }
      seen.add(entry.topicId);
    });
  });

export type SaveDayInput = z.infer<typeof saveDaySchema>;
export type SaveDayRow = z.infer<typeof saveDayRowSchema>;

export interface ExistingRow {
  topicId: number;
}

export interface SaveDayPlan {
  upserts: SaveDayRow[];
  deleteTopicIds: number[];
  note: { op: "upsert"; value: string } | { op: "delete" };
}

export function planSaveDay(
  existing: ExistingRow[],
  input: SaveDayInput,
): SaveDayPlan {
  const payloadTopicIds = new Set(input.entries.map((row) => row.topicId));
  const deleteTopicIds = existing
    .filter((row) => !payloadTopicIds.has(row.topicId))
    .map((row) => row.topicId);
  const summary = input.summary.trim();
  const note =
    summary.length > 0
      ? ({ op: "upsert", value: summary } as const)
      : ({ op: "delete" } as const);
  return { upserts: input.entries, deleteTopicIds, note };
}
