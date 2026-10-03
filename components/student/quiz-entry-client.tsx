"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { DailyEntryForm } from "@/components/quiz-entry/daily-entry-form";
import {
  getPastEntryDays,
  type PastDayGroup,
  type PastDayPageData,
} from "@/app/actions/quiz-actions";
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

function formatNet(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

interface QuizEntryClientProps {
  studentId: string;
  date: string;
  entries: DayEntryRow[];
  initialPast: PastDayPageData | null;
  pastError: string | null;
  subjects: SubjectOptions;
  initialDailyNote: string | null;
  windowOpen: boolean;
  onSaved?: () => void;
}

export function QuizEntryClient({
  studentId,
  date,
  entries,
  initialPast,
  pastError,
  subjects,
  initialDailyNote,
  windowOpen,
  onSaved,
}: QuizEntryClientProps) {
  const [pastDays, setPastDays] = useState<PastDayGroup[]>(
    initialPast?.days ?? [],
  );
  const [hasMore, setHasMore] = useState(initialPast?.hasMore ?? false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPast?.nextCursor ?? null,
  );
  const [openDates, setOpenDates] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  useEffect(() => {
    setPastDays(initialPast?.days ?? []);
    setHasMore(initialPast?.hasMore ?? false);
    setNextCursor(initialPast?.nextCursor ?? null);
    setMoreError(null);
    setOpenDates([]);
  }, [initialPast]);

  const pastLoading = initialPast === null && pastError === null;
  const allOpen =
    pastDays.length > 0 && pastDays.every((day) => openDates.includes(day.date));

  function toggleDay(dateKey: string) {
    setOpenDates((prev) =>
      prev.includes(dateKey)
        ? prev.filter((value) => value !== dateKey)
        : [...prev, dateKey],
    );
  }

  function toggleAll() {
    setOpenDates(allOpen ? [] : pastDays.map((day) => day.date));
  }

  async function loadMore() {
    if (loadingMore || !hasMore || nextCursor === null) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await getPastEntryDays({ cursor: nextCursor });
      if (res.success === false) {
        setMoreError(res.message);
      } else {
        setPastDays((prev) => [...prev, ...res.data.days]);
        setHasMore(res.data.hasMore);
        setNextCursor(res.data.nextCursor);
      }
    } catch {
      setMoreError("Beklenmeyen bir hata oluştu.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="pb-[calc(11rem+env(safe-area-inset-bottom))]">
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
          Girişler yalnızca bugün için kaydedilir. Değişiklikler
          &ldquo;Günü Kaydet&rdquo; ile birlikte gönderilir.
        </p>
      </section>

      <DailyEntryForm
        studentId={studentId}
        date={date}
        subjects={subjects}
        initialEntries={entries}
        initialSummary={initialDailyNote ?? ""}
        windowOpen={windowOpen}
        onSaved={onSaved ?? (() => {})}
      />

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
            Geçmiş girişlerim
          </h2>
          {pastDays.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="shrink-0 touch-manipulation text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
            >
              {allOpen ? "Tümünü kapat" : "Tümünü aç"}
            </button>
          )}
        </div>

        {pastLoading ? (
          <div
            className="space-y-2"
            role="status"
            aria-label="Geçmiş girişler yükleniyor"
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                aria-hidden="true"
                className="h-12 animate-pulse rounded-xl bg-gray-200"
              />
            ))}
          </div>
        ) : pastError !== null ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
            {pastError}
          </div>
        ) : pastDays.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500">
            Henüz geçmiş girişin yok.
          </div>
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {pastDays.map((day) => {
                const open = openDates.includes(day.date);
                return (
                  <li
                    key={day.date}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`past-day-${day.date}`}
                      onClick={() => toggleDay(day.date)}
                      className="flex min-h-[48px] w-full touch-manipulation items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-50 active:bg-gray-100"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                        {day.label}
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-gray-500">
                        {day.topics.length} konu · {day.questions} soru ·{" "}
                        <span className="font-bold text-indigo-700">
                          Net {formatNet(day.net)}
                        </span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div id={`past-day-${day.date}`} hidden={!open}>
                      <ul className="border-t border-gray-100 bg-gray-50/60">
                        {day.topics.map((topic) => (
                          <li
                            key={topic.id}
                            className="flex h-11 items-center gap-2 border-b border-gray-100 px-3 last:border-b-0"
                          >
                            <span className="w-9 shrink-0 rounded-full bg-indigo-50 px-1 py-0.5 text-center text-[10px] font-bold text-indigo-700">
                              {topic.examType}
                            </span>
                            <span
                              className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-700"
                              title={`${topic.subjectName} · ${topic.topicName}`}
                            >
                              {topic.subjectName} · {topic.topicName}
                            </span>
                            <span className="shrink-0 text-[11px] font-bold text-green-600">
                              {topic.correct}D
                            </span>
                            <span className="shrink-0 text-[11px] font-bold text-red-500">
                              {topic.wrong}Y
                            </span>
                            <span className="shrink-0 text-[11px] font-bold text-stone-400">
                              {topic.blank}B
                            </span>
                            <span
                              aria-label={`Net ${formatNet(topic.net)}`}
                              className="w-10 shrink-0 text-right text-[11px] font-bold text-indigo-700"
                            >
                              {formatNet(topic.net)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {day.summary && (
                        <div className="border-t border-gray-100 bg-white px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Günün özeti
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                            {day.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasMore && (
              <div className="mt-3">
                {moreError !== null && (
                  <p className="mb-2 text-center text-xs font-medium text-red-600">
                    {moreError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Yükleniyor…
                    </>
                  ) : (
                    "Daha eski günleri göster"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
