"use client";

import { useEffect, useState } from "react";
import {
  getDailyEntryData,
  getPastEntryDays,
  type DailyEntryData,
  type PastDayPageData,
} from "@/app/actions/quiz-actions";
import { QuizEntryClient } from "@/components/student/quiz-entry-client";
import { todayInIstanbul } from "@/lib/week-utils";
import { NotificationBanner } from "@/components/notifications/notification-banner";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";
import { EntryWindowBanner } from "@/components/quiz-entry/entry-window-banner";
import { useEntryWindow } from "@/components/quiz-entry/use-entry-window";

interface QuizPanelProps {
  studentId: string;
}

export function QuizPanel({ studentId }: QuizPanelProps) {
  const [date] = useState(() => todayInIstanbul());
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<
    { success: true; data: DailyEntryData } | { success: false; message: string } | null
  >(null);
  const [pastData, setPastData] = useState<PastDayPageData | null>(null);
  const [pastError, setPastError] = useState<string | null>(null);
  const { status, entryWindow, alert, refresh } = useEntryWindow();

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setPastData(null);
    setPastError(null);
    void (async () => {
      const [daily, past] = await Promise.all([
        getDailyEntryData(date),
        getPastEntryDays(),
      ]);
      if (cancelled) return;
      setResult(daily);
      if (past.success === false) {
        setPastError(past.message);
      } else {
        setPastData(past.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  const windowState = entryWindow?.state ?? status?.state ?? "before";
  const windowOpen = windowState === "open";

  function handleSaved() {
    setReloadKey((k) => k + 1);
    refresh();
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Günlük Soru Girişi</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sınav türü, ders ve konuyu seçip o gün çözdüğün soruları kaydet.
        </p>
      </header>

      <NotificationBanner />

      <EntryWindowBanner
        status={status}
        entryWindow={entryWindow}
        alert={alert}
      />

      {result === null ? (
        <PanelSkeleton rows={6} />
      ) : result.success === false ? (
        <PanelError message={result.message} />
      ) : (
        <QuizEntryClient
          studentId={studentId}
          date={date}
          entries={result.data.entries}
          initialPast={pastData}
          pastError={pastError}
          subjects={result.data.subjects}
          initialDailyNote={result.data.dailyNote}
          windowOpen={windowOpen}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
