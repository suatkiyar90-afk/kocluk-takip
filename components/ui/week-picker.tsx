"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCurrentWeekMonday, parseMonday, toISODate } from "@/lib/week-utils";

interface WeekPickerProps {
  monday?: string;
  className?: string;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatTurkishRange(mondayIso: string): string {
  const start = parseDate(mondayIso);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

  const startFormatted = start.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });
  const endFormatted = end.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });

  return `${startFormatted} - ${endFormatted}`;
}

export function WeekPicker({ monday, className = "" }: WeekPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMonday = useMemo(() => {
    const urlParam = searchParams?.get("week") ?? undefined;
    return parseMonday(monday ?? urlParam ?? getCurrentWeekMonday());
  }, [monday, searchParams]);

  const { prevMonday, nextMonday, rangeLabel } = useMemo(() => {
    const start = parseDate(currentMonday);
    const prev = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);

    return {
      prevMonday: toISODate(prev),
      nextMonday: toISODate(next),
      rangeLabel: formatTurkishRange(currentMonday),
    };
  }, [currentMonday]);

  const goToWeek = (targetMonday: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set("week", targetMonday);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm sm:p-3 ${className}`}
    >
      <button
        type="button"
        onClick={() => goToWeek(prevMonday)}
        className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 active:scale-95 touch-manipulation"
      >
        <span aria-hidden="true">&larr;</span>
        <span>Önceki Hafta</span>
      </button>

      <div className="px-2 text-center">
        <div className="text-sm font-bold text-gray-900">{rangeLabel}</div>
        <div className="text-[11px] font-medium text-indigo-600">
          Haftalık Görünüm
        </div>
      </div>

      <button
        type="button"
        onClick={() => goToWeek(nextMonday)}
        className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 active:scale-95 touch-manipulation"
      >
        <span>Sonraki Hafta</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </div>
  );
}
