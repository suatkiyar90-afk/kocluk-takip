import { z } from "zod";

export const coachingFeedbackSchema = z.object({
  studentId: z.string().min(1, "Öğrenci seçilmedi"),
  comment: z
    .string()
    .trim()
    .min(1, "Dönüt boş olamaz")
    .max(2000, "Dönüt en fazla 2000 karakter olabilir"),
});

export type CoachingFeedbackInput = z.infer<typeof coachingFeedbackSchema>;