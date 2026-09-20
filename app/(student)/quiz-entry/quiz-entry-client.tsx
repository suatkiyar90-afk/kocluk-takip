"use client";

import { toast } from "sonner";
import { WeeklyQuizEntryForm } from "@/components/quiz-entry/weekly-quiz-entry-form";
import { saveWeeklyQuizEntries } from "@/app/actions/weekly-quiz-actions";
import type { EntryValues, WeeklyQuizFormValues } from "@/components/quiz-entry/weekly-quiz-schema";

interface QuizEntryClientProps {
  initialEntries: EntryValues[];
  weekStart: string;
}

export function QuizEntryClient({
  initialEntries,
  weekStart,
}: QuizEntryClientProps) {
  const handleSubmit = async (values: WeeklyQuizFormValues) => {
    const result = await saveWeeklyQuizEntries(
      { ...values, weekStart },
      weekStart,
    );
    if (result.success === true) {
      const total = values.categories.reduce(
        (sum, row) => sum + row.correct + row.wrong + row.blank,
        0,
      );
      toast.success(`${total} soru kaydedildi.`);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <WeeklyQuizEntryForm
      defaultWeekStart={weekStart}
      initialEntries={initialEntries}
      onSubmit={handleSubmit}
    />
  );
}