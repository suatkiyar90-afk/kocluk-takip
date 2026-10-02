"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveDailyNote, type PastEntryRow } from "@/app/actions/quiz-actions";
import { DailyEntryForm } from "@/components/quiz-entry/daily-entry-form";
import type {
  DayEntryRow,
  SubjectOptions,
} from "@/components/quiz-entry/daily-entry-types";

function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface EntryListItemProps {
  title: string;
  examType: string;
  correct: number;
  wrong: number;
  blank: number;
}

function EntryListItem({
  title,
  examType,
  correct,
  wrong,
  blank,
}: EntryListItemProps) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
          {examType}
        </span>
        <p className="min-w-0 text-sm font-semibold text-gray-900">{title}</p>
      </div>
      <p className="mt-1.5 pl-1 text-xs font-medium text-gray-500">
        <span className="font-bold text-green-600">{correct} Doğru</span> ,{" "}
        <span className="font-bold text-red-600">{wrong} Yanlış</span> ,{" "}
        <span className="font-bold text-stone-500">{blank} Boş</span>
      </p>
    </li>
  );
}

interface QuizEntryClientProps {
  date: string;
  entries: DayEntryRow[];
  pastEntries: PastEntryRow[];
  subjects: SubjectOptions;
  initialDailyNote: string | null;
  windowOpen: boolean;
  onSaved?: () => void;
  onNoteSaved?: () => void;
}

export function QuizEntryClient({
  date,
  entries,
  pastEntries,
  subjects,
  initialDailyNote,
  windowOpen,
  onSaved,
  onNoteSaved,
}: QuizEntryClientProps) {
  const [dailyNote, setDailyNote] = useState(initialDailyNote ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const noteDirty = dailyNote !== (initialDailyNote ?? "");

  useEffect(() => {
    if (!windowOpen || !noteDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [windowOpen, noteDirty]);

  async function handleSaveNote() {
    if (savingNote || !windowOpen) return;
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
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Tarih
        </p>
        <p
          className="mt-1 text-base font-bold text-gray-900"
          suppressHydrationWarning
        >
          Bugün: {formatFullDate(date)}
        </p>
        <p
          className="mt-1 text-xs font-medium text-gray-500"
          suppressHydrationWarning
        >
          Girişler yalnızca bugün için kaydedilir.
        </p>
      </section>

      <DailyEntryForm
        date={date}
        subjects={subjects}
        windowOpen={windowOpen}
        onSaved={onSaved}
      />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Bugün · Kayıtlar
        </h2>
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500">
            Bugün için henüz kayıt yok.
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((row) => (
              <EntryListItem
                key={row.id}
                title={`Bugün - ${row.subjectName} - ${row.topicName}`}
                examType={row.examType}
                correct={row.correct}
                wrong={row.wrong}
                blank={row.blank}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Geçmiş girişlerim
        </h2>
        {pastEntries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500">
            Bu hafta için geçmiş gün kaydı yok.
          </div>
        ) : (
          <ul className="space-y-2">
            {pastEntries.map((row) => (
              <EntryListItem
                key={row.id}
                title={`${formatShortDate(row.date)} - ${row.subjectName} - ${row.topicName}`}
                examType={row.examType}
                correct={row.correct}
                wrong={row.wrong}
                blank={row.blank}
              />
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
            Bugün
          </span>
        </div>
        <p className="mt-1.5 text-xs font-medium text-gray-500">
          O gün çözdüğün soruları, izlediğin videoları ve notlarını buraya yaz.
          Soru girişinden bağımsızdır, sadece bugüne kaydedilir.
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
          disabled={!windowOpen}
          placeholder={
            windowOpen
              ? "Bugün ne yaptın? İzlediğin videolar, dikkatini çeken konular..."
              : "Giriş kapalıyken özet yazılamaz."
          }
          className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:opacity-60"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium text-gray-400">
            {dailyNote.length}/2000
          </p>
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={
              savingNote || dailyNote.trim() === "" || !windowOpen
            }
            className="h-12 shrink-0 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
          >
            {savingNote ? "Kaydediliyor…" : "Notu Kaydet"}
          </button>
        </div>
        {!windowOpen && (
          <p className="mt-2 text-right text-[11px] font-semibold text-amber-600">
            Günün özeti yalnızca 22.00–23.00 arasında kaydedilebilir.
          </p>
        )}
        {windowOpen && dailyNote.trim() === "" && !savingNote && (
          <p className="mt-2 text-right text-[11px] font-medium text-gray-400">
            Kaydetmek için alana bir şeyler yaz.
          </p>
        )}
      </section>
    </>
  );
}
