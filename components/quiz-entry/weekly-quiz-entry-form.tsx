"use client";

import { useMemo, useState } from "react";
import {
  FormProvider,
  useController,
  useFieldArray,
  useForm,
  useFormContext,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  buildDefaultValues,
  examTypes,
  getSubject,
  mergeInitialEntries,
  netScore,
  weeklyQuizSchema,
  type EntryValues,
  type ExamType,
  type SubjectDef,
  type WeeklyQuizFormValues,
} from "./weekly-quiz-schema";

type CountField = "correct" | "wrong" | "blank";

const stepperMeta: Record<
  CountField,
  { label: string; buttonClass: string; accentClass: string }
> = {
  correct: {
    label: "Doğru",
    buttonClass: "border-green-200 bg-green-50 text-green-700 active:bg-green-200",
    accentClass: "text-green-600",
  },
  wrong: {
    label: "Yanlış",
    buttonClass: "border-red-200 bg-red-50 text-red-700 active:bg-red-200",
    accentClass: "text-red-600",
  },
  blank: {
    label: "Boş",
    buttonClass: "border-stone-200 bg-stone-50 text-stone-600 active:bg-stone-300",
    accentClass: "text-stone-500",
  },
};

function getRowError(
  errors: FieldErrors<WeeklyQuizFormValues>,
  index: number,
): string | undefined {
  const row = errors.categories?.[index];
  return typeof row === "object" && row !== null && "message" in row
    ? String(row.message)
    : undefined;
}

function CountStepper({
  index,
  field,
}: {
  index: number;
  field: CountField;
}) {
  const { control } = useFormContext<WeeklyQuizFormValues>();
  const {
    field: f,
    fieldState,
  } = useController({
    control,
    name: `categories.${index}.${field}`,
  });
  const meta = stepperMeta[field];
  const clamp = (value: number) => Math.max(0, Math.floor(value));

  return (
    <div>
      <p
        className={`mb-1.5 text-center text-xs font-semibold uppercase tracking-wide ${meta.accentClass}`}
      >
        {meta.label}
      </p>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1.5">
        <button
          type="button"
          aria-label={`${meta.label} azalt`}
          disabled={f.value <= 0}
          onClick={() => f.onChange(clamp(f.value - 1))}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl font-bold transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation select-none ${meta.buttonClass}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          autoComplete="off"
          aria-label={meta.label}
          value={f.value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            f.onChange(Number.isNaN(n) ? 0 : n);
          }}
          className="h-11 w-full rounded-xl border border-gray-200 bg-white text-center text-lg font-bold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="button"
          aria-label={`${meta.label} artır`}
          onClick={() => f.onChange(clamp(f.value + 1))}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl font-bold transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation select-none ${meta.buttonClass}`}
        >
          +
        </button>
      </div>
      {fieldState.error && (
        <p className="mt-1.5 text-center text-xs font-medium text-red-600">
          {fieldState.error.message}
        </p>
      )}
    </div>
  );
}

function SubjectCard({
  index,
  subject,
}: {
  index: number;
  subject: SubjectDef;
}) {
  const { watch, formState } = useFormContext<WeeklyQuizFormValues>();
  const entry = watch(`categories.${index}`);
  const correct = entry?.correct ?? 0;
  const wrong = entry?.wrong ?? 0;
  const blank = entry?.blank ?? 0;
  const total = correct + wrong + blank;
  const net = netScore(correct, wrong);
  const rowError = getRowError(formState.errors, index);
  const countText = total > 0 ? `Çözülen: ${total}` : "Henüz soru girilmedi";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {subject.name}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">{countText}</p>
        </div>
        <div className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
          Net:{" "}
          {net.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <CountStepper index={index} field="correct" />
        <CountStepper index={index} field="wrong" />
        <CountStepper index={index} field="blank" />
      </div>
      {rowError && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {rowError}
        </p>
      )}
    </div>
  );
}

interface WeeklyQuizEntryFormProps {
  defaultWeekStart?: string;
  initialEntries?: EntryValues[];
  onSubmit?: (values: WeeklyQuizFormValues) => void | Promise<void>;
}

export function WeeklyQuizEntryForm({
  defaultWeekStart,
  initialEntries,
  onSubmit,
}: WeeklyQuizEntryFormProps) {
  const methods = useForm<WeeklyQuizFormValues>({
    resolver: zodResolver(weeklyQuizSchema),
    defaultValues: mergeInitialEntries(
      buildDefaultValues(defaultWeekStart),
      initialEntries,
    ),
    mode: "onTouched",
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = methods;

  const { fields } = useFieldArray({ control, name: "categories" });
  const [activeTab, setActiveTab] = useState<ExamType>("TYT");

  const rows = watch("categories");
  const tabStats = useMemo(() => {
    const stats: Record<ExamType, { solved: number; net: number }> = {
      TYT: { solved: 0, net: 0 },
      AYT: { solved: 0, net: 0 },
    };
    for (const row of rows ?? []) {
      const s = stats[row.examType];
      s.solved += row.correct + row.wrong + row.blank;
      s.net += netScore(row.correct, row.wrong);
    }
    return stats;
  }, [rows]);

  const handleFormSubmit = handleSubmit(async (values) => {
    if (onSubmit) {
      await onSubmit(values);
    } else {
      console.log("Haftalık soru kaydı:", values);
    }
  });

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        onSubmit={handleFormSubmit}
        className="mx-auto w-full max-w-md pb-4"
      >
        <div className="mb-5">
          <label
            htmlFor="weekStart"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            Hafta Başlangıcı
          </label>
          <input
            id="weekStart"
            type="date"
            {...register("weekStart")}
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base font-medium text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          />
          {errors.weekStart && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {errors.weekStart.message}
            </p>
          )}
        </div>

        <div
          role="tablist"
          className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1"
        >
          {examTypes.map((t) => {
            const active = activeTab === t;
            const stats = tabStats[t];
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t)}
                className={`h-12 rounded-xl text-sm font-semibold transition-colors touch-manipulation ${
                  active ? "bg-white text-indigo-700 shadow" : "text-gray-500"
                }`}
              >
                {t} · {stats.solved}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs font-medium text-gray-500">
          {activeTab} toplam net:{" "}
          <span className="font-bold text-indigo-700">
            {tabStats[activeTab].net.toLocaleString("tr-TR", {
              maximumFractionDigits: 2,
            })}
          </span>
        </p>

        <div className="mt-4 space-y-4">
          {fields.map((row, index) => {
            if (row.examType !== activeTab) return null;
            const subject = getSubject(row.examType, row.subjectId);
            if (!subject) return null;
            return (
              <SubjectCard key={row.id} index={index} subject={subject} />
            );
          })}
        </div>

        <div className="sticky bottom-0 -mx-4 mt-6 border-t border-gray-200 bg-gradient-to-t from-white via-white to-white/90 px-4 pb-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-60 touch-manipulation"
          >
            {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {!isSubmitting && Object.keys(errors).length > 0 && (
            <p className="mt-2 text-center text-xs font-medium text-red-600">
              Lütfen yukarıdaki hataları düzeltin.
            </p>
          )}
        </div>
      </form>
    </FormProvider>
  );
}