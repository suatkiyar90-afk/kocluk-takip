"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveDailyNote } from "@/app/actions/quiz-actions";
import { DailyEntryForm } from "@/components/quiz-entry/daily-entry-form";
import type {
  DayEntryRow,
  SubjectOptions,
} from "@/components/quiz-entry/daily-entry-types";

export function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(iso: string, today: string): string {
  if (iso === today) return "Bugün";
  const [y, m, d] = iso.split("-").map(Number);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODateLocal(yesterday)) return "Dün";
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface QuizEntryClientProps {
  date: string;
  entries: DayEntryRow[];
  subjects: SubjectOptions;
  initialDailyNote: string | null;
  onDateChange: (nextDate: string) => void;
  onSaved?: () => void;
  onNoteSaved?: () => void;
}

export function QuizEntryClient({
  date,
  entries,
  subjects,
  initialDailyNote,
  onDateChange,
  onSaved,
  onNoteSaved,
}: QuizEntryClientProps) {
  const today = toISODateLocal(new Date());
  const label = formatDateLabel(date, today);
  const [dailyNote, setDailyNote] = useState(initialDailyNote ?? "");
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveNote() {
    if (savingNote) return;
    const trimmed = dailyNote.trim();
    if (trimmed === "") {
      toast.error("Not boş olamaz.");
      return;
    }
    setSavingNote(true);
    try {
      const result = await saveDailyNote(date, trimmed);
      if (result.success === true) {
        toast.success("Günün özeti kaydedildi.");
        if (onNoteSaved) onNoteSaved();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Not kaydedilirken beklenmeyen bir hata oluştu.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <>
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="entry-date"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
        >
          Tarih
        </label>
        <div className="flex items-center gap-2">
          <input
            id="entry-date"
            type="date"
            value={date}
            max={today}
            suppressHydrationWarning
            onChange={(e) => {
              if (e.target.value) onDateChange(e.target.value);
            }}
            className="h-12 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-base font-medium text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          />
          {date !== today && (
            <button
              type="button"
              onClick={() => onDateChange(today)}
              className="h-12 shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 transition active:scale-95 touch-manipulation"
            >
              Bugün
            </button>
          )}
        </div>
        <p
          className="mt-2 text-xs font-medium text-gray-500"
          suppressHydrationWarning
        >
          {label} için giriş yapıyorsun.
        </p>
      </section>

      <DailyEntryForm date={date} subjects={subjects} onSaved={onSaved} />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          <span suppressHydrationWarning>{label}</span> · Kayıtlar
        </h2>
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500">
            Bu gün için henüz kayıt yok.
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                    {row.examType}
                  </span>
                  <p className="min-w-0 text-sm font-semibold text-gray-900">
                    {label} - {row.subjectName} - {row.topicName}
                  </p>
                </div>
                <p className="mt-1.5 pl-1 text-xs font-medium text-gray-500">
                  <span className="font-bold text-green-600">
                    {row.correct} Doğru
                  </span>
                  ,{" "}
                  <span className="font-bold text-red-600">
                    {row.wrong} Yanlış
                  </span>
                  ,{" "}
                  <span className="font-bold text-stone-500">
                    {row.blank} Boş
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
            Günün Özeti
          </h2>
          <span
            className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700"
            suppressHydrationWarning
          >
            {label}
          </span>
        </div>
        <p className="mt-1.5 text-xs font-medium text-gray-500">
          O gün çözdüğün soruları, izlediğin videoları ve notlarını buraya yaz.
          Soru girişinden bağımsızdır, sadece bu güne kaydedilir.
        </p>
        <label htmlFor="daily-note" className="sr-only">
          Günün özeti
        </label>
        <textarea
          id="daily-note"
          value={dailyNote}
          onChange={(e) => setDailyNote(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Bugün ne yaptın? İzlediğin videolar, dikkatini çeken konular..."
          className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium text-gray-400">
            {dailyNote.length}/2000
          </p>
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={savingNote || dailyNote.trim() === ""}
            className="h-12 shrink-0 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
          >
            {savingNote ? "Kaydediliyor…" : "Notu Kaydet"}
          </button>
        </div>
        {dailyNote.trim() === "" && !savingNote && (
          <p className="mt-2 text-right text-[11px] font-medium text-gray-400">
            Kaydetmek için alana bir şeyler yaz.
          </p>
        )}
      </section>
    </>
  );
}
