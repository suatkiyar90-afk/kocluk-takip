"use client";

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
  onDateChange: (nextDate: string) => void;
  onSaved?: () => void;
}

export function QuizEntryClient({
  date,
  entries,
  subjects,
  onDateChange,
  onSaved,
}: QuizEntryClientProps) {
  const today = toISODateLocal(new Date());
  const label = formatDateLabel(date, today);
  const savedNote =
    entries.find((row) => row.studentNote !== null)?.studentNote ?? null;

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

      <DailyEntryForm
        date={date}
        subjects={subjects}
        initialNote={savedNote}
        onSaved={onSaved}
      />

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
                {row.studentNote !== null && row.studentNote !== "" && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50/70 px-2.5 py-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-indigo-500"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <path d="M7 9h10" />
                      <path d="M7 13h6" />
                    </svg>
                    <p className="min-w-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-indigo-900">
                      {row.studentNote}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
