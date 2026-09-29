"use client";

import { useEffect, useState } from "react";
import { getDailyEntryData, type DailyEntryData } from "@/app/actions/quiz-actions";
import { QuizEntryClient } from "@/components/student/quiz-entry-client";
import { todayInIstanbul } from "@/lib/week-utils";
import { NotificationBanner } from "@/components/quiz-entry/notification-banner";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";

export function QuizPanel() {
  const [date, setDate] = useState(() => todayInIstanbul());
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<
    { success: true; data: DailyEntryData } | { success: false; message: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void (async () => {
      const res = await getDailyEntryData(date);
      if (cancelled) return;
      setResult(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Günlük Soru Girişi</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sınav türü, ders ve konuyu seçip o gün çözdüğün soruları kaydet.
        </p>
      </header>

      <NotificationBanner />

      {result === null ? (
        <PanelSkeleton rows={6} />
      ) : result.success === false ? (
        <PanelError message={result.message} />
      ) : (
        <QuizEntryClient
          date={date}
          entries={result.data.entries}
          subjects={result.data.subjects}
          initialDailyNote={result.data.dailyNote}
          onDateChange={setDate}
          onSaved={() => setReloadKey((k) => k + 1)}
          onNoteSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </>
  );
}
