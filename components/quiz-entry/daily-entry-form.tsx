"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getRecentDailyTopics,
  saveDailyEntries,
} from "@/app/actions/quiz-actions";
import {
  dailyEntriesFormSchema,
  type DailyEntriesFormValues,
  type DailyEntryRowInput,
} from "@/components/quiz-entry/daily-entry-schema";
import {
  examTypes,
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";
import type {
  RecentDailyTopic,
  SubjectOptions,
} from "@/components/quiz-entry/daily-entry-types";

type CountField = "correct" | "wrong" | "blank";

const MAX_ROWS = 30;

const EMPTY_ROW: DailyEntryRowInput = {
  examType: "TYT",
  subjectId: "",
  topicId: 0,
  correct: 0,
  wrong: 0,
  blank: 0,
};

const stepperMeta: Record<
  CountField,
  { label: string; buttonClass: string; accentClass: string }
> = {
  correct: {
    label: "Doğru",
    buttonClass:
      "border-green-200 bg-green-50 text-green-700 active:bg-green-200",
    accentClass: "text-green-600",
  },
  wrong: {
    label: "Yanlış",
    buttonClass: "border-red-200 bg-red-50 text-red-700 active:bg-red-200",
    accentClass: "text-red-600",
  },
  blank: {
    label: "Boş",
    buttonClass:
      "border-stone-200 bg-stone-50 text-stone-600 active:bg-stone-300",
    accentClass: "text-stone-500",
  },
};

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500";
const selectClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

function toCount(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function CountStepper({
  field,
  value,
  onChange,
}: {
  field: CountField;
  value: number;
  onChange: (value: number) => void;
}) {
  const meta = stepperMeta[field];
  const clamp = (n: number) => Math.max(0, Math.floor(n));

  return (
    <div>
      <p
        className={`mb-1.5 text-center text-xs font-semibold uppercase tracking-wide ${meta.accentClass}`}
      >
        {meta.label}
      </p>
      <div className="grid grid-cols-[2.75rem_minmax(5rem,1fr)_2.75rem] items-center gap-1.5">
        <button
          type="button"
          aria-label={`${meta.label} azalt`}
          disabled={value <= 0}
          onClick={() => onChange(clamp(value - 1))}
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
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            onChange(Number.isNaN(n) ? 0 : n);
          }}
          className="h-11 w-full min-w-[5rem] rounded-xl border border-gray-200 bg-white px-3 text-center text-lg font-bold text-gray-900 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="button"
          aria-label={`${meta.label} artır`}
          onClick={() => onChange(clamp(value + 1))}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl font-bold transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation select-none ${meta.buttonClass}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

interface DailyEntryFormProps {
  date: string;
  subjects: SubjectOptions;
  onSaved?: () => void;
}

export function DailyEntryForm({
  date,
  subjects,
  onSaved,
}: DailyEntryFormProps) {
  const router = useRouter();
  const [examTab, setExamTab] = useState<ExamType>("TYT");
  const [recent, setRecent] = useState<RecentDailyTopic[]>([]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DailyEntriesFormValues>({
    resolver: zodResolver(dailyEntriesFormSchema),
    defaultValues: { entries: [] },
    mode: "onTouched",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "entries",
  });

  const rows = watch("entries") ?? [];
  const hasChanges = JSON.stringify(rows) !== "[]";

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  useEffect(() => {
    let active = true;
    void getRecentDailyTopics().then((result) => {
      if (active && result.success === true) {
        setRecent(result.data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function refreshRecent() {
    void getRecentDailyTopics().then((result) => {
      if (result.success === true) {
        setRecent(result.data);
      }
    });
  }

  function addRow(partial?: Partial<DailyEntryRowInput>) {
    if (fields.length >= MAX_ROWS) {
      toast.error(`En fazla ${MAX_ROWS} satır ekleyebilirsin.`);
      return;
    }
    const candidate: DailyEntryRowInput = {
      ...EMPTY_ROW,
      examType: examTab,
      ...partial,
    };
    if (candidate.topicId > 0) {
      const duplicate = rows.some(
        (row) =>
          row &&
          row.examType === candidate.examType &&
          row.subjectId === candidate.subjectId &&
          row.topicId === candidate.topicId,
      );
      if (duplicate) {
        toast("Bu konu zaten listede.");
        return;
      }
    }
    append(candidate);
  }

  function addRecent(topic: RecentDailyTopic) {
    addRow({
      examType: topic.examType,
      subjectId: topic.subjectId,
      topicId: topic.topicId,
    });
  }

  function changeSubject(index: number, subjectId: string) {
    setValue(`entries.${index}.subjectId`, subjectId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(`entries.${index}.topicId`, 0, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function changeTopic(index: number, topicId: string) {
    setValue(`entries.${index}.topicId`, topicId === "" ? 0 : Number(topicId), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function changeCount(index: number, field: CountField, value: number) {
    setValue(`entries.${index}.${field}`, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  let totalCorrect = 0;
  let totalWrong = 0;
  let totalBlank = 0;
  for (const row of rows) {
    if (!row) continue;
    totalCorrect += toCount(row.correct);
    totalWrong += toCount(row.wrong);
    totalBlank += toCount(row.blank);
  }
  const totalQuestions = totalCorrect + totalWrong + totalBlank;
  const net = netScore(totalCorrect, totalWrong);

  const onSubmit = handleSubmit(async (values) => {
    const result = await saveDailyEntries({
      date,
      entries: values.entries,
    });
    if (result.success === true) {
      toast.success(
        `Gün kaydedildi. ${result.data.saved} satır işlendi.`,
      );
      reset({ entries: [] });
      refreshRecent();
      if (onSaved) {
        onSaved();
      } else {
        router.refresh();
      }
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
      <p className={labelClass}>Sınav Türü</p>
      <div
        role="tablist"
        className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1"
      >
        {examTypes.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={examTab === t}
            onClick={() => setExamTab(t)}
            className={`h-12 rounded-xl text-sm font-semibold transition-colors touch-manipulation ${
              examTab === t ? "bg-white text-indigo-700 shadow" : "text-gray-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-gray-400">
        Yeni satırlar bu sınav türüyle eklenir.
      </p>

      {recent.length > 0 ? (
        <div className="mt-4">
          <p className={labelClass}>Son kullandığım konular</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {recent.map((topic) => (
              <button
                key={`${topic.examType}:${topic.subjectId}:${topic.topicId}`}
                type="button"
                onClick={() => addRecent(topic)}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 pl-2 pr-3.5 text-xs font-bold text-indigo-700 transition active:scale-95 touch-manipulation"
              >
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {topic.examType}
                </span>
                <span className="max-w-[14rem] truncate">
                  {topic.subjectName} · {topic.topicName}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => addRow()}
        disabled={fields.length >= MAX_ROWS}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 text-sm font-bold text-indigo-600 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
      >
        + Konu Ekle
      </button>

      {fields.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm font-medium text-gray-500">
          Henüz satır yok. “+ Konu Ekle” ile başla.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {fields.map((field, index) => {
            const row = rows[index] ?? EMPTY_ROW;
            const rowErrors = errors.entries?.[index];
            const subjectList = subjects[row.examType] ?? [];
            const topicList =
              subjectList.find(
                (subject) => subject.subjectId === row.subjectId,
              )?.topics ?? [];
            const rowTotal =
              toCount(row.correct) + toCount(row.wrong) + toCount(row.blank);

            return (
              <li
                key={field.id}
                className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                    {row.examType}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-400">
                    Satır {index + 1}
                  </p>
                  <button
                    type="button"
                    aria-label={`${index + 1}. satırı kaldır`}
                    onClick={() => remove(index)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-lg font-bold text-gray-400 transition active:scale-90 hover:border-red-200 hover:bg-red-50 hover:text-red-600 touch-manipulation"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`row-${index}-subject`}
                      className="sr-only"
                    >
                      Ders
                    </label>
                    <select
                      id={`row-${index}-subject`}
                      value={row.subjectId}
                      onChange={(e) => changeSubject(index, e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Ders seçin</option>
                      {subjectList.map((subject) => (
                        <option
                          key={subject.subjectId}
                          value={subject.subjectId}
                        >
                          {subject.subjectName}
                        </option>
                      ))}
                    </select>
                    {rowErrors?.subjectId ? (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        {rowErrors.subjectId.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor={`row-${index}-topic`} className="sr-only">
                      Konu
                    </label>
                    <select
                      id={`row-${index}-topic`}
                      value={row.topicId === 0 ? "" : String(row.topicId)}
                      onChange={(e) => changeTopic(index, e.target.value)}
                      disabled={row.subjectId === ""}
                      className={selectClass}
                    >
                      <option value="">
                        {row.subjectId === ""
                          ? "Önce ders seçin"
                          : "Konu seçin"}
                      </option>
                      {topicList.map((topic) => (
                        <option key={topic.id} value={String(topic.id)}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                    {rowErrors?.topicId ? (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        {rowErrors.topicId.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <CountStepper
                    field="correct"
                    value={toCount(row.correct)}
                    onChange={(v) => changeCount(index, "correct", v)}
                  />
                  <CountStepper
                    field="wrong"
                    value={toCount(row.wrong)}
                    onChange={(v) => changeCount(index, "wrong", v)}
                  />
                  <CountStepper
                    field="blank"
                    value={toCount(row.blank)}
                    onChange={(v) => changeCount(index, "blank", v)}
                  />
                </div>

                {rowErrors?.correct ? (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {rowErrors.correct.message}
                  </p>
                ) : rowTotal === 0 ? (
                  <p className="mt-2 text-xs font-medium text-amber-600">
                    Henüz soru girilmedi.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {fields.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-600">
          <span>{fields.length} satır</span>
          <span>
            Toplam: {totalQuestions} soru · Net:{" "}
            <span className="font-bold text-indigo-700">
              {net.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      ) : null}

      <div className="mt-5">
        <button
          type="submit"
          disabled={isSubmitting || fields.length === 0}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
        >
          {isSubmitting ? "Kaydediliyor…" : "Günü Kaydet"}
        </button>
        {fields.length === 0 && !isSubmitting ? (
          <p className="mt-2 text-center text-xs font-medium text-gray-500">
            Kaydetmek için önce “+ Konu Ekle” ile konu satırı ekle.
          </p>
        ) : null}
      </div>
    </form>
  );
}
