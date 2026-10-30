"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { Check, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { SchoolLogo } from "@/components/brand/school-logo";
import {
  toggleStudyPlanSlotCompletion,
  type WeeklyStudyPlanView,
} from "@/app/actions/study-plan-actions";
import {
  DAY_LABELS,
  DAY_LONG_LABELS,
  TASK_META,
  formatWeekRange,
  parseMinutes,
} from "@/lib/study-plan-meta";

interface StudentStudyPlanProps {
  plan: WeeklyStudyPlanView;
  weekStart: string;
  approving: boolean;
  onApprove: () => void;
  readOnly?: boolean;
}

export function StudentStudyPlan({
  plan,
  weekStart,
  approving,
  onApprove,
  readOnly = false,
}: StudentStudyPlanProps) {
  const [activeDay, setActiveDay] = useState(0);
  const [printOpen, setPrintOpen] = useState(false);
  const [slots, setSlots] = useState(plan.slots);
  const [pendingIds, setPendingIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlots(plan.slots);
  }, [plan.slots]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Haftalik_Calisma_Programim_${weekStart}`,
    pageStyle: "@page { size: A4 landscape; margin: 8mm; }",
  });

  const totalQuestions = slots.reduce(
    (sum, slot) => sum + slot.questionCount,
    0,
  );
  const completedCount = slots.filter((slot) => slot.isCompleted).length;
  const completionPercent =
    slots.length > 0 ? Math.round((completedCount / slots.length) * 100) : 0;
  const daySlots = useMemo(
    () =>
      slots
        .filter((slot) => slot.dayIndex === activeDay)
        .sort(
          (a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime),
        ),
    [slots, activeDay],
  );

  async function handleToggle(slotId: string, completed: boolean) {
    if (readOnly || pendingIds.has(slotId)) return;
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              isCompleted: completed,
              completedAt: completed ? new Date().toISOString() : null,
            }
          : slot,
      ),
    );
    setPendingIds((prev) => new Set(prev).add(slotId));

    try {
      const result = await toggleStudyPlanSlotCompletion({
        weekStart,
        slotId,
        completed,
      });
      if (result.success === false) {
        setSlots((prev) =>
          prev.map((slot) =>
            slot.id === slotId
              ? {
                  ...slot,
                  isCompleted: !completed,
                  completedAt: completed ? null : new Date().toISOString(),
                }
              : slot,
          ),
        );
        toast.error(result.message);
      }
    } catch {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                isCompleted: !completed,
                completedAt: completed ? null : new Date().toISOString(),
              }
            : slot,
        ),
      );
      toast.error("Etüt durumu güncellenemedi.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(slotId);
        return next;
      });
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-200">
            Program
          </span>
          <h2 className="truncate text-sm font-bold text-gray-900">
            Haftalık Ders Çalışma Programım
          </h2>
        </div>
        {plan.isApproved ? (
          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 ring-1 ring-green-200">
            ✓ Onaylandı
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-[11px] font-medium text-gray-500">
        {formatWeekRange(weekStart)} · {slots.length} etüt ·{" "}
        {totalQuestions} soru
      </p>

      <div className="mt-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-[11px] font-bold text-emerald-800">
            Haftalık Programa Uyum
          </p>
          <p className="text-[11px] font-black text-emerald-700">
            {completedCount} / {slots.length} Etüt Tamamlandı (%{completionPercent})
          </p>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-emerald-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {DAY_LABELS.map((label, index) => {
          const count = slots.filter(
            (slot) => slot.dayIndex === index,
          ).length;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveDay(index)}
              className={`flex h-10 min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-lg px-2 text-[11px] font-bold transition touch-manipulation ${
                activeDay === index
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-50 text-gray-600"
              }`}
            >
              {label}
              <span
                className={`text-[9px] font-semibold ${
                  activeDay === index ? "text-indigo-100" : "text-gray-400"
                }`}
              >
                {count} etüt
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 space-y-2">
        {daySlots.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm font-medium text-gray-500">
            {DAY_LONG_LABELS[activeDay]} için etüt yok.
          </p>
        ) : (
          daySlots.map((slot) => {
            const meta = TASK_META[slot.taskType];
            return (
              <div
                key={slot.id}
                className={`relative rounded-xl border p-3 pl-12 shadow-sm transition ${
                  slot.isCompleted
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-gray-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  aria-label={
                    slot.isCompleted
                      ? "Etüdü tamamlanmadı olarak işaretle"
                      : "Etüdü tamamlandı olarak işaretle"
                  }
                  aria-pressed={slot.isCompleted === true}
                  disabled={readOnly || pendingIds.has(slot.id)}
                  onClick={() =>
                    void handleToggle(slot.id, !slot.isCompleted)
                  }
                  className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:opacity-60 touch-manipulation ${
                    slot.isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                      : "border-gray-300 bg-white text-transparent hover:border-emerald-400 hover:bg-emerald-50"
                  }`}
                >
                  {pendingIds.has(slot.id) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
                  ) : (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  )}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-bold text-white">
                    {slot.startTime}–{slot.endTime}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                    {slot.examType}
                  </span>
                  {slot.isCompleted ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                      ✅ Tamamlandı
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm font-bold leading-snug text-gray-900">
                  {slot.subjectName}
                </p>
                {slot.topicName ? (
                  <p className="text-xs font-medium text-gray-600">
                    {slot.topicName}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-500">
                  {slot.questionCount > 0 ? (
                    <span>{slot.questionCount} soru</span>
                  ) : null}
                  {slot.note ? <span>· {slot.note}</span> : null}
                </div>
                {slot.recommendationReason ? (
                  <p className="mt-1.5 rounded-lg bg-indigo-50/70 px-2 py-1.5 text-[10px] font-medium leading-snug text-indigo-700">
                    {slot.recommendationReason}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {plan.teacherNote.trim() ? (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
            Öğretmen Notu
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-blue-950">
            {plan.teacherNote}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setPrintOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 ring-2 ring-indigo-300 transition active:scale-[0.98] touch-manipulation"
      >
        <Printer className="h-4 w-4" /> PDF / Yazdır
      </button>

      {!readOnly ? (
        !plan.isApproved ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              disabled={approving}
              className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-60 touch-manipulation"
            >
              {approving
                ? "Onaylanıyor..."
                : "Bu haftaki programımı inceledim"}
            </button>
            <p className="mt-2 text-center text-[11px] font-medium text-gray-400">
              Onayladığında danışman öğretmenin programı incelediğini görebilir.
            </p>
          </>
        ) : (
          <p className="mt-2 text-center text-[11px] font-medium text-green-600">
            ✓ Bu haftaki programımı inceledim
          </p>
        )
      ) : null}

      {printOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-2 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">Program Önizleme</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePrint()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-gray-800 shadow touch-manipulation"
              >
                <Printer className="h-4 w-4" /> Yazdır / PDF
              </button>
              <button
                type="button"
                onClick={() => setPrintOpen(false)}
                className="h-10 rounded-xl bg-white/20 px-3 text-xs font-bold text-white touch-manipulation"
              >
                Kapat
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto rounded-xl bg-white">
            <div ref={printRef} className="min-w-[1000px] p-6">
              <div className="flex items-center gap-4 border-b-2 border-indigo-700 pb-3">
                <SchoolLogo className="h-16 w-16 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
                    Demirci AİHL · Akademik Takip Sistemi
                  </p>
                  <h1 className="text-xl font-black text-gray-900">
                    Haftalık Ders Çalışma Programım
                  </h1>
                  <p className="text-xs font-semibold text-gray-500">
                    {formatWeekRange(weekStart)} · {plan.slots.length} etüt ·{" "}
                    {totalQuestions} soru
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {DAY_LABELS.map((label, dayIndex) => {
                  const items = plan.slots
                    .filter((slot) => slot.dayIndex === dayIndex)
                    .sort(
                      (a, b) =>
                        parseMinutes(a.startTime) -
                        parseMinutes(b.startTime),
                    );
                  return (
                    <div
                      key={label}
                      className="overflow-hidden rounded-lg border border-gray-300"
                    >
                      <div className="bg-indigo-700 px-1.5 py-1 text-center text-[11px] font-black text-white">
                        {label}
                      </div>
                      <div className="space-y-1 p-1">
                        {items.length === 0 ? (
                          <p className="py-3 text-center text-[9px] font-medium text-gray-400">
                            Etüt yok
                          </p>
                        ) : (
                          items.map((slot) => {
                            const meta = TASK_META[slot.taskType];
                            return (
                              <div
                                key={slot.id}
                                style={{
                                  backgroundColor: meta.tint,
                                  borderColor: meta.border,
                                }}
                                className="rounded-md border px-1 py-1"
                              >
                                <p className="text-[8.5px] font-black text-gray-700">
                                  {slot.startTime}–{slot.endTime}
                                </p>
                                <p className="text-[9px] font-bold leading-tight text-gray-900">
                                  {meta.icon} {slot.subjectName}
                                </p>
                                {slot.topicName ? (
                                  <p className="text-[8px] leading-tight text-gray-600">
                                    {slot.topicName}
                                  </p>
                                ) : null}
                                <p className="text-[8px] font-semibold text-gray-500">
                                  {slot.questionCount > 0
                                    ? `${slot.questionCount} soru`
                                    : meta.label}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {plan.teacherNote.trim() ? (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[10px] font-medium text-gray-600">
                  <span className="font-bold text-gray-800">
                    Öğretmen notu:{" "}
                  </span>
                  {plan.teacherNote}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
