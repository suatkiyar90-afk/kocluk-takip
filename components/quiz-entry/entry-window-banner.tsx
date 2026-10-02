"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Lock,
  Unlock,
} from "lucide-react";
import type { EntryWindowStatusData } from "@/app/actions/quiz-actions";
import type { EntryWindow } from "@/lib/entry-window";

const WARN_THRESHOLD_MS = 10 * 60 * 1000;

const INFO_TEXT =
  "Günlük veri girişi her gün yalnızca 22.00–23.00 arasında (Türkiye saati) yapılabilir. Geçmiş güne ait giriş yapılamaz. Günün Özeti için de aynı saat geçerlidir.";

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
  const state = entryWindow?.state ?? status?.state ?? null;

  let toneClass = "border-gray-200 bg-gray-100 text-gray-600";
  let Icon = Clock3;
  let dynamicLine = "Sunucu durumu kontrol ediliyor…";
  let srStateText = "";

  if (state === "before" && entryWindow) {
    toneClass = "border-blue-200 bg-blue-50 text-blue-900";
    Icon = Clock3;
    dynamicLine = `Giriş 22.00'de açılacak. Kalan süre: ${formatRemaining(entryWindow.msUntilOpen)}.`;
    srStateText = "Günlük giriş kapalı. Giriş 22.00'de açılacak.";
  } else if (state === "open" && entryWindow) {
    const warn = entryWindow.msUntilClose <= WARN_THRESHOLD_MS;
    toneClass = warn
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-green-200 bg-green-50 text-green-900";
    Icon = warn ? AlertTriangle : Unlock;
    dynamicLine = `Giriş şu an açık. Kapanmasına ${formatRemaining(entryWindow.msUntilClose)} kaldı.${
      warn ? " Kaydetmeyi unutma!" : ""
    }`;
    srStateText = "Günlük giriş açık.";
  } else if (state === "after") {
    toneClass = "border-gray-200 bg-gray-100 text-gray-600";
    Icon = Lock;
    dynamicLine =
      "Bugünkü giriş süresi sona erdi. Yarın 22.00–23.00 arasında tekrar girebilirsin.";
    srStateText = "Bugünkü giriş süresi sona erdi.";
  }

  const urgentMinutes =
    entryWindow && state === "open"
      ? Math.max(1, Math.ceil(entryWindow.msUntilClose / 60_000))
      : 0;

  return (
    <section
      className={`mb-6 rounded-2xl border p-4 shadow-sm ${toneClass}`}
      suppressHydrationWarning
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-medium leading-relaxed opacity-80">
            {INFO_TEXT}
          </p>
          <p className="text-sm font-bold leading-snug" suppressHydrationWarning>
            {dynamicLine}
          </p>
          {status?.hasEntryToday ? (
            <p className="flex items-center gap-1.5 text-xs font-bold text-green-700">
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
