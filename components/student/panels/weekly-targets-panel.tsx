"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  approveWeeklySchedule,
  getMyWeeklyDenemeBundle,
  getMyWeeklyFeedback,
  getMyWeeklySchedule,
  getMyWeeklyTargets,
  type WeeklyDenemeBundle,
} from "@/app/actions/weekly-target-actions";
import { parseMonday } from "@/lib/week-utils";
import { isImageUrl, isPdfUrl } from "@/lib/schedule-file";
import { WeekPicker } from "@/components/ui/week-picker";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";
import { StudentStudyPlan } from "@/components/student/study-plan-view";
import {
  getMyWeeklyStudyPlan,
  type WeeklyStudyPlanView,
} from "@/app/actions/study-plan-actions";

type TargetsResult = Awaited<ReturnType<typeof getMyWeeklyTargets>>;
type FeedbackResult = Awaited<ReturnType<typeof getMyWeeklyFeedback>>;
type DenemeBundleResult = Awaited<
  ReturnType<typeof getMyWeeklyDenemeBundle>
>;

type TargetItem = Extract<TargetsResult, { success: true }>["data"][number];

function targetPercent(target: TargetItem): number {
  return target.targetQuestionCount > 0
    ? Math.min(
        Math.round((target.solvedCount / target.targetQuestionCount) * 100),
        100,
      )
    : 0;
}

function TargetGoalCard({ target }: { target: TargetItem }) {
  const pct = targetPercent(target);
  const reached = target.solvedCount >= target.targetQuestionCount;
  const remaining = Math.max(
    target.targetQuestionCount - target.solvedCount,
    0,
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <span className="mt-0.5 shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-100">
            {target.examType}
          </span>
          <h3 className="min-w-0 break-words text-sm font-bold leading-tight text-gray-900">
            {target.subjectName}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 leading-tight">
          <span className="whitespace-nowrap text-xs font-black text-gray-900">
            {target.solvedCount}
            <span className="font-bold text-gray-400">
              {" "}
              / {target.targetQuestionCount}
            </span>
          </span>
          <span
            className={`whitespace-nowrap text-[10px] font-bold ${
              reached ? "text-emerald-600" : "text-gray-500"
            }`}
          >
            {reached ? "✓ Tamamlandı" : `%${pct} • ${remaining} kaldı`}
          </span>
        </div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-[width] ${
            reached ? "bg-emerald-500" : "bg-indigo-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {target.targetTopics.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {target.targetTopics.map((topic) => (
            <span
              key={topic.topicId}
              className={`max-w-full rounded-full px-2 py-0.5 text-xs font-semibold leading-snug ${
                topic.solved
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-gray-50 text-gray-600 ring-1 ring-gray-200"
              }`}
            >
              {topic.solved ? "✓ " : ""}
              {topic.topicName}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TargetGoalGrid({ items }: { items: TargetItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
      {items.map((target) => (
        <TargetGoalCard key={target.id} target={target} />
      ))}
    </div>
  );
}

function TargetEmptyNote({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-xs font-medium text-gray-500 shadow-sm">
      {text}
    </p>
  );
}

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

interface ScheduleState {
  fileUrl: string | null;
  isApproved: boolean;
}

export function WeeklyTargetsPanel() {
  const [weekStart, setWeekStart] = useState(() => parseMonday());
  const [targetsResult, setTargetsResult] = useState<TargetsResult | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResult | null>(
    null,
  );
  const [denemeResult, setDenemeResult] = useState<DenemeBundleResult | null>(
    null,
  );
  const [schedule, setSchedule] = useState<ScheduleState | null>(null);
  const [studyPlan, setStudyPlan] = useState<WeeklyStudyPlanView | null>(null);
  const [approving, setApproving] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [targetFilter, setTargetFilter] = useState<"active" | "done" | "all">(
    "all",
  );
  const [doneOpen, setDoneOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSchedule(null);
    setPreviewFailed(false);
    setStudyPlan(null);
    void (async () => {
      const [res, planRes] = await Promise.all([
        getMyWeeklySchedule(weekStart),
        getMyWeeklyStudyPlan(weekStart),
      ]);
      if (cancelled) return;
      setSchedule(
        res.success === true
          ? res.data
          : { fileUrl: null, isApproved: false },
      );
      setStudyPlan(planRes.success === true ? planRes.data : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  useEffect(() => {
    let cancelled = false;
    setTargetsResult(null);
    setFeedbackResult(null);
    setDenemeResult(null);
    void (async () => {
      const [targets, feedback, deneme] = await Promise.all([
        getMyWeeklyTargets(weekStart),
        getMyWeeklyFeedback(weekStart),
        getMyWeeklyDenemeBundle(weekStart),
      ]);
      if (cancelled) return;
      setTargetsResult(targets);
      setFeedbackResult(feedback);
      setDenemeResult(deneme);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const coachComment =
    feedbackResult !== null && feedbackResult.success === true
      ? feedbackResult.data.comment
      : null;
  const feedbackFromPreviousWeek =
    feedbackResult !== null &&
    feedbackResult.success === true &&
    feedbackResult.data.isPreviousWeek;
  const feedbackWeekStart =
    feedbackResult !== null && feedbackResult.success === true
      ? feedbackResult.data.weekStart
      : null;

  async function handleApprove() {
    if (approving) return;
    setApproving(true);
    try {
      const result = await approveWeeklySchedule(weekStart);
      if (result.success === true) {
        setSchedule((prev) =>
          prev ? { ...prev, isApproved: true } : prev,
        );
        setStudyPlan((prev) =>
          prev ? { ...prev, isApproved: true } : prev,
        );
      }
    } finally {
      setApproving(false);
    }
  }

  const targets =
    targetsResult !== null && targetsResult.success === true
      ? targetsResult.data
      : null;
  const denemeBundle: WeeklyDenemeBundle | null =
    denemeResult !== null && denemeResult.success === true
      ? denemeResult.data
      : null;
  const denemeTargets = denemeBundle?.targets ?? [];
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

  const targetList = targets ?? [];
  const activeTargets = targetList
    .filter((t) => t.solvedCount < t.targetQuestionCount)
    .sort((a, b) => targetPercent(a) - targetPercent(b));
  const doneTargets = targetList
    .filter((t) => t.solvedCount >= t.targetQuestionCount)
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "tr"));

  return (
    <>
      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Haftalık Hedeflerim</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatRange(weekStart)} · Danışman Öğretmeninizin belirlediği hedefler ve
          ilerlemeniz.
        </p>
      </header>

      <div className="space-y-4">
        <WeekPicker monday={weekStart} onWeekChange={setWeekStart} />

        {denemeTargets.length > 0 ? (
          <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold">
              <span className="text-gray-500">Deneme Hedefleri</span>
              <span className="shrink-0 text-gray-900">
                {denemeBundle !== null ? denemeBundle.attempts.length : 0}{" "}
                deneme çözüldü
              </span>
            </div>
            <ul className="mt-3 space-y-3">
              {denemeTargets.map((target) => {
                const pct =
                  target.targetCount > 0
                    ? Math.min(
                        Math.round(
                          (target.solvedCount / target.targetCount) * 100,
                        ),
                        100,
                      )
                    : 0;
                return (
                  <li key={target.denemeKey}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-bold text-gray-900">
                        {target.label}
                      </p>
                      <span className="shrink-0 text-xs font-semibold text-gray-500">
                        {target.solvedCount} / {target.targetCount}
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-[width] ${
                          target.reached ? "bg-green-500" : "bg-violet-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-gray-500">
                      {target.reached
                        ? "Hedef tamamlandı!"
                        : `${Math.max(
                            target.targetCount - target.solvedCount,
                            0,
                          )} deneme kaldı.`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {studyPlan && studyPlan.slots.length > 0 ? (
          <StudentStudyPlan
            plan={studyPlan}
            weekStart={weekStart}
            approving={approving}
            onApprove={() => void handleApprove()}
          />
        ) : null}

        {schedule?.fileUrl ? (
          <section className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-200">
                  Çizelge
                </span>
                <h2 className="text-sm font-bold text-gray-900">
                  Haftalık Çalışma Çizelgem
                </h2>
              </div>
              {schedule.isApproved ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 ring-1 ring-green-200">
                  ✓ Onaylandı
                </span>
              ) : null}
            </div>

            {isImageUrl(schedule.fileUrl) && !previewFailed ? (
              <button
                type="button"
                onClick={() => setScheduleModalOpen(true)}
                aria-label="Çizelgeyi büyük görüntüle"
                className="mt-3 block w-full touch-manipulation"
              >
                <img
                  src={schedule.fileUrl}
                  alt="Haftalık çalışma çizelgesi"
                  onError={() => setPreviewFailed(true)}
                  className="max-h-64 w-full rounded-xl border border-gray-200 bg-gray-50 object-contain"
                />
              </button>
            ) : (
              <a
                href={schedule.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] touch-manipulation"
              >
                {isPdfUrl(schedule.fileUrl) || previewFailed
                  ? "📄 Çizelgeyi Görüntüle / İndir"
                  : "📎 Çizelgeyi Görüntüle / İndir"}
              </a>
            )}

            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={schedule.isApproved || approving}
              className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.98] touch-manipulation ${
                schedule.isApproved
                  ? "cursor-default bg-green-600 text-white shadow-lg shadow-green-600/25"
                  : "bg-white text-indigo-700 ring-2 ring-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
              }`}
            >
              {schedule.isApproved
                ? "✓ Bu haftaki çalışma programımı inceledim"
                : approving
                  ? "Onaylanıyor..."
                  : "Bu haftaki çalışma programımı inceledim"}
            </button>

            <p className="mt-2 text-center text-[11px] font-medium text-gray-400">
              Çizelgeyi inceleyip onayladığında danışman öğretmenin görebilir.
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200">
              Dönüt
            </span>
            <h2 className="text-sm font-bold text-blue-900">
              Danışman Öğretmeninin{" "}
              {feedbackFromPreviousWeek ? "Geçen Haftaki" : "Bu Haftaki"} Notu
            </h2>
          </div>
          {feedbackResult === null ? (
            <div className="mt-2.5 h-4 w-2/3 animate-pulse rounded bg-blue-100" />
          ) : coachComment ? (
            <>
              {feedbackFromPreviousWeek && feedbackWeekStart ? (
                <p className="mt-1 text-[11px] font-semibold text-blue-700/80">
                  {formatRange(feedbackWeekStart)} haftası için yazıldı.
                </p>
              ) : null}
              <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-wrap text-blue-950">
                {coachComment}
              </p>
            </>
          ) : (
            <p className="mt-2.5 text-sm italic text-gray-400">
              Danışman öğretmeniniz bu hafta için henüz bir değerlendirme notu
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
            <section className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Genel Haftalık Hedef İlerlemesi
                </p>
                <p className="text-[11px] font-semibold text-gray-500">
                  Toplam Çözülen:{" "}
                  <span className="font-black text-gray-900">{totalSolved}</span>{" "}
                  / {totalTarget} Soru
                  <span className="mx-1.5 text-gray-300">•</span>
                  <span
                    className={`font-black ${
                      totalReached ? "text-emerald-600" : "text-indigo-600"
                    }`}
                  >
                    %{totalPct} Tamamlandı
                  </span>
                </p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    totalReached ? "bg-emerald-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${totalPct}%` }}
                />
              </div>
            </section>

            <div
              role="tablist"
              aria-label="Hedef filtresi"
              className="flex gap-1.5 overflow-x-auto pb-0.5"
            >
              {(
                [
                  {
                    id: "active" as const,
                    label: `⏳ Devam Edenler (${activeTargets.length})`,
                  },
                  {
                    id: "done" as const,
                    label: `✅ Tamamlananlar (${doneTargets.length})`,
                  },
                  {
                    id: "all" as const,
                    label: `Tümü (${targets.length})`,
                  },
                ] as const
              ).map((tab) => {
                const active = targetFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTargetFilter(tab.id)}
                    className={`h-9 shrink-0 rounded-lg border px-2.5 text-[11px] font-bold transition touch-manipulation ${
                      active
                        ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {targetFilter === "done" ? (
              doneTargets.length > 0 ? (
                <TargetGoalGrid items={doneTargets} />
              ) : (
                <TargetEmptyNote text="Henüz tamamlanan ders hedefi yok." />
              )
            ) : targetFilter === "active" ? (
              activeTargets.length > 0 ? (
                <TargetGoalGrid items={activeTargets} />
              ) : (
                <TargetEmptyNote text="Devam eden ders hedefi yok. Tüm hedefler tamamlandı 🎉" />
              )
            ) : (
              <>
                {activeTargets.length > 0 ? (
                  <TargetGoalGrid items={activeTargets} />
                ) : null}

                {doneTargets.length > 0 ? (
                  <section className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setDoneOpen((prev) => !prev)}
                      aria-expanded={doneOpen}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left touch-manipulation"
                    >
                      <span className="text-xs font-bold text-emerald-800">
                        ✅ Tamamlanan Ders Hedefleri ({doneTargets.length} Ders)
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-emerald-600 transition-transform ${
                          doneOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {doneOpen ? (
                      <div className="border-t border-emerald-100 bg-emerald-50/20 p-2.5">
                        <TargetGoalGrid items={doneTargets} />
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
            {formatRange(weekStart)} için henüz bir hedef belirlenmemiş.
            Danışman öğretmeniniz hedef girdiğinde burada göreceksiniz.
          </div>
        )}
      </div>

      {scheduleModalOpen && schedule?.fileUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Haftalık çalışma çizelgesi"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setScheduleModalOpen(false)}
        >
          <button
            type="button"
            onClick={() => setScheduleModalOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white ring-1 ring-white/40 transition hover:bg-white/20 touch-manipulation"
          >
            Kapat ✕
          </button>
          <img
            src={schedule.fileUrl}
            alt="Haftalık çalışma çizelgesi (büyük)"
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
