import { z } from "zod";
import { examTypes } from "./weekly-quiz-schema";

const countSchema = z
  .number({ invalid_type_error: "Sayı girin" })
  .int("Tam sayı girin")
  .min(0, "Negatif değer girilemez")
  .max(500, "En fazla 500 girilebilir");

export const dailyEntryRowSchema = z
  .object({
    examType: z.enum(examTypes),
    subjectId: z.string().min(1, "Ders seçin").max(50),
    topicId: z
      .number({ invalid_type_error: "Konu seçin" })
      .int("Konu seçin")
      .positive("Konu seçin"),
    correct: countSchema,
    wrong: countSchema,
    blank: countSchema,
  })
  .superRefine((row, ctx) => {
    if (row.correct + row.wrong + row.blank < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correct"],
        message: "En az 1 soru girin.",
      });
    }
  });

export const dailyEntriesArraySchema = z
  .array(dailyEntryRowSchema)
  .min(1, "En az bir konu satırı ekleyin.")
  .max(30, "En fazla 30 satır eklenebilir.")
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const key = `${row.examType}:${row.subjectId}:${row.topicId}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "topicId"],
          message: "Aynı konu listede iki kez olamaz.",
        });
      }
      seen.add(key);
    });
  });

export const dailyEntriesFormSchema = z.object({
  entries: dailyEntriesArraySchema,
});

export const dailyEntriesPayloadSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-AA formatında olmalı."),
  entries: dailyEntriesArraySchema,
});

export type DailyEntryRowInput = z.infer<typeof dailyEntryRowSchema>;
export type DailyEntriesFormValues = z.infer<typeof dailyEntriesFormSchema>;
export type DailyEntriesPayload = z.infer<typeof dailyEntriesPayloadSchema>;
