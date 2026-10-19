"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  Lock,
  Unlock,
} from "lucide-react";
import type { EntryWindowStatusData } from "@/app/actions/quiz-actions";
import type { EntryWindow } from "@/lib/entry-window";
import { formatHour, formatHourRange } from "@/lib/grade-config";

const WARN_THRESHOLD_MS = 10 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours} sa ${minutes} dk`;
  }
  return `${minutes} dk`;
}

interface EntryWindowBannerProps {
  status: EntryWindowStatusData | null;
  entryWindow: EntryWindow | null;
  alert: boolean;
}

export function EntryWindowBanner({
  status,
  entryWindow,
  alert,
}: EntryWindowBannerProps) {
  const [showInfo, setShowInfo] = useState(false);
  const state = entryWindow?.state ?? status?.state ?? null;
  const enforced = status?.enforceTimeWindow ?? true;
  const rangeLabel = status
    ? formatHourRange(status.entryStartHour, status.entryEndHour)
    : "22:00 - 00:00";

  const infoText = status
    ? enforced
      ? `Günlük veri girişi ${rangeLabel} aralığında (Türkiye saati) yapılabilir. Geçmiş güne ait giriş yapılamaz. Günün özeti için de aynı saat geçerlidir.`
      : `Sınıf grubunuz için önerilen veri girişi saati ${rangeLabel}. Saat kısıtlaması şu an zorunlu değil; günün istediğiniz saatinde giriş yapabilirsiniz.`
    : "Günlük veri girişi belirlenen saat aralığında (Türkiye saati) yapılabilir. Geçmiş güne ait giriş yapılamaz. Günün özeti için de aynı saat geçerlidir.";

  let toneClass =
    "border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  let Icon = Clock3;
  let dynamicLine = "Sunucu durumu kontrol ediliyor…";
  let srStateText = "";

  if (state === "before" && entryWindow && status) {
    toneClass =
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/70 dark:text-blue-100";
    Icon = Clock3;
    dynamicLine = `Giriş ${formatHour(
      status.entryStartHour,
    )}'te açılacak — ${formatRemaining(entryWindow.msUntilOpen)}`;
    srStateText = `Günlük giriş kapalı. Giriş ${formatHour(
      status.entryStartHour,
    )}'te açılacak.`;
  } else if (state === "open" && entryWindow) {
    if (!enforced) {
      toneClass =
        "border-green-200 bg-green-50 text-green-900 dark:border-green-900/70 dark:bg-green-950/70 dark:text-green-100";
      Icon = Unlock;
      dynamicLine = "Veri girişi açık — istediğiniz saatte girebilirsiniz";
      srStateText = "Günlük giriş açık. Saat kısıtlaması uygulanmıyor.";
    } else {
      const warn = entryWindow.msUntilClose <= WARN_THRESHOLD_MS;
      toneClass = warn
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/70 dark:text-amber-100"
        : "border-green-200 bg-green-50 text-green-900 dark:border-green-900/70 dark:bg-green-950/70 dark:text-green-100";
      Icon = warn ? AlertTriangle : Unlock;
      dynamicLine = `Giriş açık — ${formatRemaining(
        entryWindow.msUntilClose,
      )} kaldı`;
      srStateText = "Günlük giriş açık.";
    }
  } else if (state === "after") {
    toneClass =
      "border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    Icon = Lock;
    dynamicLine = "Bugünkü giriş süresi sona erdi";
    srStateText = "Bugünkü giriş süresi sona erdi.";
  }

  const urgentMinutes =
    entryWindow && state === "open" && enforced
      ? Math.max(1, Math.ceil(entryWindow.msUntilClose / 60_000))
      : 0;

  return (
    <section
      className={`mb-6 rounded-2xl border p-3.5 shadow-sm ${toneClass}`}
      suppressHydrationWarning
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {status ? (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide opacity-70">
              {status.badgeLabel}
            </p>
          ) : null}
          <div className="flex items-start gap-1.5">
            <p
              className="min-w-0 flex-1 text-sm font-bold leading-snug"
              suppressHydrationWarning
            >
              {dynamicLine}
            </p>
            <button
              type="button"
              onClick={() => setShowInfo((value) => !value)}
              aria-expanded={showInfo}
              aria-controls="entry-window-info"
              aria-label={
                showInfo ? "Bilgiyi gizle" : "Giriş kuralları hakkında bilgi"
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5 active:scale-95 dark:hover:bg-white/10 touch-manipulation"
            >
              <Info aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {status && enforced && state !== "open" ? (
            <p className="mt-1.5 text-xs font-semibold opacity-90">
              {status.windowMessage}
            </p>
          ) : null}
          <div id="entry-window-info" hidden={!showInfo}>
            <p className="mt-1.5 text-xs font-medium leading-relaxed opacity-80">
              {infoText}
            </p>
          </div>
          {status?.hasEntryToday ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Bugünkü girişin kaydedildi ✓
            </p>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {srStateText}
          </p>
          {alert ? (
            <p className="sr-only" aria-live="polite">
              {`Kalan süre ${urgentMinutes} dakika. Kaydetmeyi unutma!`}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
