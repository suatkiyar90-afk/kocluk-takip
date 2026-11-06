"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  saveCoachingFeedback,
  type PreviousWeekReviewData,
} from "@/app/actions/teacher-actions";

const QUICK_TEMPLATES = [
  "👏 Harika bir hafta çıkardın, çalışma disiplinini ve soru temponu aynen koruyalım!",
  "📈 Etüt uyumun gayet güzel ancak günlük soru sayımızı hedefe yaklaştırmamız gerekiyor.",
  "⚠️ Bu hafta programdaki bazı etütler yarım kalmış, yeni haftada önceliği bu eksikleri kapatmaya verelim.",
  "🎯 Deneme analizindeki öncelikli konulara daha fazla ağırlık vererek netlerimizi yukarı taşıyalım.",
];

function formatRange(mondayIso: string): string {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
  );
  const opts = { day: "numeric", month: "long" } as const;
  return `${start.toLocaleDateString("tr-TR", opts)} – ${end.toLocaleDateString(
    "tr-TR",
    opts,
  )}`;
}

interface StatCardProps {
  title: string;
  value: string;
  hint: string;
  percent: number;
  tone: "indigo" | "violet" | "emerald";
}

const TONE: Record<
  StatCardProps["tone"],
  { chip: string; bar: string; label: string }
> = {
  indigo: {
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    bar: "bg-indigo-500",
    label: "text-indigo-600",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700 ring-violet-100",
    bar: "bg-violet-500",
    label: "text-violet-600",
  },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    bar: "bg-emerald-500",
    label: "text-emerald-600",
  },
};

function StatCard({ title, value, hint, percent, tone }: StatCardProps) {
  const meta = TONE[tone];
  const width = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
          {title}
        </p>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ring-1 ${meta.chip}`}
        >
          %{percent}
        </span>
      </div>
      <p className="mt-1 text-base font-black leading-tight text-gray-900">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold text-gray-500">{hint}</p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-[width] ${meta.bar}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export interface WeeklyReviewModalProps {
  open: boolean;
  studentId: string;
  review: PreviousWeekReviewData;
  /** Daha önce kaydedilmiş dönüt (düzenleme için). */
  initialComment?: string;
  onClose: () => void;
  onSaved: (comment: string) => void;
  onStartPlanning: (carryOver: boolean) => void;
}

export function WeeklyReviewModal({
  open,
  studentId,
  review,
  initialComment = "",
  onClose,
  onSaved,
  onStartPlanning,
}: WeeklyReviewModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [carryOver, setCarryOver] = useState(true);
  /** Modalın önceki açık/kapalı durumu; yalnızca açılışta adımı sıfırlamak için. */
  const wasOpenRef = useRef(false);

  // Her açılışta ilk adımdan ve güncel dönüt metniyle başla.
  // Not: initialComment kaydetme sonrası üst bileşende güncellenir; bu
  // güncelleme adımı geri almasın diye yalnızca açılış anında sıfırlanır.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep(1);
      setComment(initialComment);
      setCarryOver(true);
    }
    wasOpenRef.current = open;
  }, [open, initialComment]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = comment.trim();

  function addTemplate(text: string) {
    setComment((current) =>
      current.trim().length === 0 ? text : `${current.trim()} ${text}`,
    );
  }

  async function handleSave() {
    if (trimmed.length === 0) {
      toast.error("İlerlemek için kısa bir dönüt yazın.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveCoachingFeedback(
        { studentId, comment: trimmed },
        review.previousWeekStart,
      );
      if (result.success === true) {
        onSaved(trimmed);
        setStep(2);
        toast.success("Dönüt kaydedildi ve öğrenciye bildirim gönderildi.");
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Dönüt kaydedilirken bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-gray-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-review-title"
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">
              Adım {step} / 2
            </p>
            <h2
              id="weekly-review-title"
              className="mt-0.5 break-words text-base font-bold leading-tight text-gray-900"
            >
              {step === 1
                ? "📅 Geçen Hafta Özeti ve Değerlendirme"
                : "🗓️ Yeni Haftalık Plan Oluşturalım mı?"}
            </h2>
            <p
              className="mt-0.5 text-[11px] font-semibold text-gray-500"
              suppressHydrationWarning
            >
              {review.studentName} ·{" "}
              {step === 1
                ? formatRange(review.previousWeekStart)
                : `${formatRange(review.currentWeekStart)} (bu hafta)`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Değerlendirme penceresini kapat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 active:scale-95 touch-manipulation"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {step === 1 ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <StatCard
                  title="Soru Hedefi"
                  value={`${review.questions.solved} / ${review.questions.target}`}
                  hint="çözülen / hedef soru"
                  percent={review.questions.percent}
                  tone="indigo"
                />
                <StatCard
                  title="Program Uyumu"
                  value={`${review.plan.completed} / ${review.plan.total}`}
                  hint="tamamlanan / toplam etüt"
                  percent={review.plan.percent}
                  tone="violet"
                />
                <StatCard
                  title="İstikrar & Başarı"
                  value={`${review.activeDays} / 7 Gün`}
                  hint={`aktif gün · %${review.accuracy.percent} doğruluk`}
                  percent={review.activeDays > 0 ? (review.activeDays / 7) * 100 : 0}
                  tone="emerald"
                />
              </div>

              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
                <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
                  ⚠️ Eksik Kalanlar
                  {review.unfinishedTotal > 0
                    ? ` (${review.unfinishedTotal})`
                    : ""}
                </p>
                {review.unfinished.length === 0 ? (
                  <p className="mt-1 text-[11px] font-semibold text-amber-800/80">
                    Geçen haftada tamamlanmayan etüt veya hedef konu yok. 🎉
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {review.unfinished.slice(0, 8).map((item, index) => (
                      <span
                        key={`${item.kind}-${item.label}-${index}`}
                        className="max-w-full rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200"
                      >
                        {item.kind === "etut" ? "⏳" : "🎯"} {item.label}
                      </span>
                    ))}
                    {review.unfinishedTotal > 8 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        +{review.unfinishedTotal - 8} daha
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Hızlı dönüt şablonları
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => addTemplate(template)}
                      className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-2.5 py-1.5 text-left text-[11px] font-semibold leading-snug text-indigo-900 transition hover:bg-indigo-50 active:scale-[0.99] touch-manipulation"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <label
                  htmlFor="weekly-review-comment"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400"
                >
                  Öğretmen Dönütü
                </label>
                <textarea
                  id="weekly-review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Öğrencinin geçen haftaki performansını değerlendir, bu hafta için hedefini yaz…"
                  className="h-28 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-gray-400">
                    Şablonlara dokunup metni serbestçe düzenleyebilirsin.
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-semibold ${
                      comment.length > 1900 ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {comment.length}/2000
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl ring-4 ring-emerald-100">
                ✅
              </div>
              <p className="mt-2 text-sm font-bold text-emerald-700">
                Geçen haftanın dönütü öğrenciye iletildi!
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-800">
                {review.studentName} için bu haftanın (
                <span className="font-black">{formatRange(review.currentWeekStart)}</span>
                ) çalışma programını şimdi oluşturalım mı?
              </p>

              <label className="mt-4 flex w-full items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-left text-xs font-semibold leading-snug text-indigo-900 touch-manipulation">
                <input
                  type="checkbox"
                  checked={carryOver}
                  onChange={(event) => setCarryOver(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                Geçen hafta tamamlanmayan etüt ve konuları yeni haftanın planına
                öncelikli olarak dahil et
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 active:scale-[0.99] sm:w-auto touch-manipulation"
          >
            Daha Sonra
          </button>
          {step === 1 ? (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || trimmed.length === 0}
              className="h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 sm:w-auto touch-manipulation"
            >
              {saving ? "Kaydediliyor…" : "Dönütü Gönder ve İlerle →"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStartPlanning(carryOver)}
              className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.99] sm:w-auto touch-manipulation"
            >
              ✨ Evet, Planı Oluşturalım
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
