"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveDailyEntry } from "@/app/actions/quiz-actions";
import {
  examTypes,
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";
import type { SubjectOptions } from "@/components/quiz-entry/daily-entry-types";

type CountField = "correct" | "wrong" | "blank";

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
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1.5">
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
          className="h-11 w-full rounded-xl border border-gray-200 bg-white text-center text-lg font-bold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
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
}

export function DailyEntryForm({ date, subjects }: DailyEntryFormProps) {
  const router = useRouter();
  const [examType, setExamType] = useState<ExamType>("TYT");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [blank, setBlank] = useState(0);
  const [saving, setSaving] = useState(false);

  const subjectList = subjects[examType] ?? [];
  const topicList =
    subjectList.find((subject) => subject.subjectId === subjectId)?.topics ??
    [];
  const total = correct + wrong + blank;
  const canSubmit = subjectId !== "" && topicId !== "" && total > 0;
  const net = netScore(correct, wrong);

  function changeExamType(next: ExamType) {
    setExamType(next);
    setSubjectId("");
    setTopicId("");
  }

  function changeSubject(next: string) {
    setSubjectId(next);
    setTopicId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const result = await saveDailyEntry({
        date,
        examType,
        subjectId,
        topicId: Number(topicId),
        correct,
        wrong,
        blank,
      });
      if (result.success === true) {
        toast.success("Gün kaydedildi.");
        setCorrect(0);
        setWrong(0);
        setBlank(0);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Kayıt sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <p className={labelClass}>Sınav Türü</p>
      <div
        role="tablist"
        className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1"
      >
        {examTypes.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={examType === t}
            onClick={() => changeExamType(t)}
            className={`h-12 rounded-xl text-sm font-semibold transition-colors touch-manipulation ${
              examType === t ? "bg-white text-indigo-700 shadow" : "text-gray-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label htmlFor="entry-subject" className={labelClass}>
          Ders
        </label>
        <select
          id="entry-subject"
          value={subjectId}
          onChange={(e) => changeSubject(e.target.value)}
          className={selectClass}
        >
          <option value="">Ders seçin</option>
          {subjectList.map((subject) => (
            <option key={subject.subjectId} value={subject.subjectId}>
              {subject.subjectName}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label htmlFor="entry-topic" className={labelClass}>
          Konu
        </label>
        <select
          id="entry-topic"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          disabled={subjectId === ""}
          className={selectClass}
        >
          <option value="">
            {subjectId === "" ? "Önce ders seçin" : "Konu seçin"}
          </option>
          {topicList.map((topic) => (
            <option key={topic.id} value={String(topic.id)}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <CountStepper field="correct" value={correct} onChange={setCorrect} />
        <CountStepper field="wrong" value={wrong} onChange={setWrong} />
        <CountStepper field="blank" value={blank} onChange={setBlank} />
      </div>

      <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-center text-xs font-semibold text-gray-600">
        Toplam: {total} soru · Net:{" "}
        <span className="font-bold text-indigo-700">
          {net.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
        </span>
      </p>

      <div className="mt-5">
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
        >
          {saving ? "Kaydediliyor…" : "Günü Kaydet"}
        </button>
        {!canSubmit && !saving && (
          <p className="mt-2 text-center text-xs font-medium text-gray-500">
            Kaydetmek için ders ve konu seç, en az 1 soru gir.
          </p>
        )}
      </div>
    </form>
  );
}
