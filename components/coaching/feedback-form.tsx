"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  coachingFeedbackSchema,
  type CoachingFeedbackInput,
} from "./feedback-schema";
import { saveCoachingFeedback } from "@/app/actions/teacher-actions";

interface FeedbackFormProps {
  studentId: string;
  initialComment?: string;
}

export function FeedbackForm({
  studentId,
  initialComment,
}: FeedbackFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CoachingFeedbackInput>({
    resolver: zodResolver(coachingFeedbackSchema),
    defaultValues: { studentId, comment: initialComment ?? "" },
    mode: "onTouched",
  });

  const commentLength = (watch("comment") ?? "").length;

  const onSubmit = handleSubmit(async (values) => {
    const result = await saveCoachingFeedback(values);
    if (result.success) {
      toast.success("Dönüt kaydedildi.");
      reset(values, { keepDirty: false });
    } else {
      toast.error(result.message);
    }
  });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-gray-900">
        Haftalık Dönüt
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Öğrencinin bu haftaki çalışmasına yazılı değerlendirme bırak.
      </p>

      <textarea
        {...register("comment")}
        rows={4}
        maxLength={2000}
        placeholder="Öğrencinin hangi alanda ilerlediğini ve hangi konularda eksik kaldığını yaz…"
        className="mt-3 h-32 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        {errors.comment ? (
          <p className="text-xs font-medium text-red-600">
            {errors.comment.message}
          </p>
        ) : (
          <span />
        )}
        <span
          className={`text-xs font-medium ${
            commentLength > 1900 ? "text-red-600" : "text-gray-400"
          }`}
        >
          {commentLength}/2000
        </span>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !isDirty}
        className="mt-4 h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
      >
        {isSubmitting ? "Kaydediliyor…" : "Dönütü Kaydet"}
      </button>
    </form>
  );
}