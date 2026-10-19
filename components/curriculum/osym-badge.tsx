"use client";

import { useEffect, useRef, useState } from "react";
import { classifyOsymFrequency, type OsymFrequencyTier } from "@/lib/osym-frequency";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<OsymFrequencyTier, string> = {
  garanti: "border-red-200 bg-red-50 text-red-700",
  duzenli: "border-indigo-200 bg-indigo-50 text-indigo-700",
  seyrek: "border-gray-200 bg-gray-100 text-gray-600",
  yok: "",
};

const TIER_LABELS: Record<Exclude<OsymFrequencyTier, "yok">, string> = {
  garanti: "Garanti",
  duzenli: "Düzenli",
  seyrek: "Seyrek",
};

export interface OsymBadgeProps {
  avgRecentQuestions: number;
  yearlyQuestionCounts?: Record<string, number> | null;
  className?: string;
}

export function OsymBadge({
  avgRecentQuestions,
  yearlyQuestionCounts,
  className,
}: OsymBadgeProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const info = classifyOsymFrequency(avgRecentQuestions, yearlyQuestionCounts);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (info.tier === "yok" || info.totalQuestions === 0) return null;

  const hasHistory = info.years.length > 0;
  const summary = `Son 5 yıl ortalaması: ${info.recentAverage} soru/yıl · toplam ${info.totalQuestions} soru`;

  return (
    <span ref={wrapperRef} className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (hasHistory) setOpen((prev) => !prev);
        }}
        aria-expanded={hasHistory ? open : undefined}
        title={hasHistory ? `${summary} (yıllara göre görmek için tıkla)` : summary}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          TIER_STYLES[info.tier],
        )}
      >
        <span aria-hidden>{info.icon}</span>
        <span>{TIER_LABELS[info.tier]}</span>
        {info.recentAverage > 0 ? (
          <span className="text-[10px] font-medium opacity-75">
            · ~{info.recentAverage}/yıl
          </span>
        ) : null}
      </button>
      {open && hasHistory ? (
        <span className="absolute top-full right-0 z-30 mt-1 block w-40 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          <span className="mb-1 block text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
            Yıllara göre soru
          </span>
          <span className="block max-h-48 overflow-y-auto">
            {info.years.map((entry) => (
              <span
                key={entry.year}
                className="flex items-center justify-between py-0.5 text-[11px] text-gray-700"
              >
                <span>{entry.year}</span>
                <span className="font-semibold">{entry.count}</span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}
