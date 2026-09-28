"use client";

import { useEffect, useState } from "react";
import {
  getMyWeeklyFeedback,
  getMyWeeklyTargets,
} from "@/app/actions/weekly-target-actions";
import { parseMonday } from "@/lib/week-utils";
import { WeekPicker } from "@/components/ui/week-picker";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";

type TargetsResult = Awaited<ReturnType<typeof getMyWeeklyTargets>>;
type FeedbackResult = Awaited<ReturnType<typeof getMyWeeklyFeedback>>;

function formatRange(mondayIso: string): string {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
  );
  const opts = { day: "numeric", month: "long" } as const;
  return `${start.toLocaleDateString("tr-TR", opts)} - ${end.toLocaleDateString(
    "tr-TR",
    opts,
  )}`;
}

export function WeeklyTargetsPanel() {
  const [weekStart, setWeekStart] = useState(() => parseMonday());
  const [targetsResult, setTargetsResult] = useState<TargetsResult | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResult | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setTargetsResult(null);
    setFeedbackResult(null);
    void (async () => {
      const [targets, feedback] = await Promise.all([
        getMyWeeklyTargets(weekStart),
        getMyWeeklyFeedback(weekStart),
      ]);
      if (cancelled) return;
      setTargetsResult(targets);
      setFeedbackResult(feedback);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const coachComment =
    feedbackResult !== null && feedbackResult.success === true
      ? feedbackResult.data.comment
      : null;

  const targets =
    targetsResult !== null && targetsResult.success === true
      ? targetsResult.data
      : null;
  const totalTarget = targets
    ? targets.reduce((sum, t) => sum + t.targetQuestionCount, 0)
    : 0;
  const totalSolved = targets
    ? targets.reduce((sum, t) => sum + t.solvedCount, 0)
    : 0;
  const totalPct =
    totalTarget > 0
      ? Math.min(Math.round((totalSolved / totalTarget) * 100), 100)
      : 0;
  const totalReached = totalTarget > 0 && totalSolved >= totalTarget;

  return (
    <>
      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Haftalık Hedeflerim</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatRange(weekStart)} · Koçunuzun belirlediği hedefler ve
          ilerlemeniz.
        </p>
      </header>

      <div className="space-y-4">
        <WeekPicker monday={weekStart} onWeekChange={setWeekStart} />

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200">
              Dönüt
            </span>
            <h2 className="text-sm font-bold text-blue-900">
              Koçun Bu Haftaki Notu
            </h2>
          </div>
          {feedbackResult === null ? (
            <div className="mt-2.5 h-4 w-2/3 animate-pulse rounded bg-blue-100" />
          ) : coachComment ? (
            <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-wrap text-blue-950">
              {coachComment}
            </p>
          ) : (
            <p className="mt-2.5 text-sm italic text-gray-400">
              Koç öğretmeniniz bu hafta için henüz bir değerlendirme notu
              eklemedi.
            </p>
          )}
        </section>

        {targetsResult === null ? (
          <PanelSkeleton rows={6} />
        ) : targetsResult.success === false ? (
          <PanelError message={targetsResult.message} />
        ) : targets && targets.length > 0 ? (
          <>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-gray-500">Genel İlerleme</span>
                <span className="text-gray-900">
                  {totalSolved} / {totalTarget} soru
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    totalReached ? "bg-green-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${totalPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-gray-500">
                {totalReached
                  ? `Tüm haftalık hedefler tamamlandı (%${totalPct}).`
                  : `Hedefin %${totalPct} tamamlandı · ${Math.max(
                      totalTarget - totalSolved,
                      0,
                    )} soru kaldı.`}
              </p>
            </section>

            {targets.map((t) => {
              const pct =
                t.targetQuestionCount > 0
                  ? Math.min(
                      Math.round((t.solvedCount / t.targetQuestionCount) * 100),
                      100,
                    )
                  : 0;
              const reached = t.solvedCount >= t.targetQuestionCount;
              return (
                <section
                  key={t.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-100">
                        {t.examType}
                      </span>
                      <h2 className="text-sm font-bold text-gray-900">
                        {t.subjectName}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-gray-500">
                      {t.solvedCount} / {t.targetQuestionCount}
                    </span>
                  </div>

                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-[width] ${
                        reached ? "bg-green-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-gray-500">
                    {reached
                      ? "Hedef tamamlandı!"
                      : `Hedefin %${pct} tamamlandı · ${Math.max(
                          t.targetQuestionCount - t.solvedCount,
                          0,
                        )} soru kaldı.`}
                  </p>

                  {t.targetTopics.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        Hedef Konular
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {t.targetTopics.map((topic) => (
                          <span
                            key={topic.topicId}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              topic.solved
                                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                                : "bg-gray-50 text-gray-600 ring-1 ring-gray-200"
                            }`}
                          >
                            {topic.solved ? "✓ " : ""}
                            {topic.topicName}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
            {formatRange(weekStart)} için henüz bir hedef belirlenmemiş.
            Koç öğretmeniniz hedef girdiğinde burada göreceksiniz.
          </div>
        )}
      </div>
    </>
  );
}
