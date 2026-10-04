"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDaysISO, getCurrentWeekMonday, parseMonday } from "@/lib/week-utils";

interface WeekPickerProps {
  monday?: string;
  className?: string;
  onWeekChange?: (monday: string) => void;
  compact?: boolean;
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

export function WeekPicker({
  monday,
  className = "",
  onWeekChange,
  compact = false,
}: WeekPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMonday = useMemo(() => {
    const urlParam = searchParams?.get("week") ?? undefined;
    return parseMonday(monday ?? urlParam ?? getCurrentWeekMonday());
  }, [monday, searchParams]);

  const { prevMonday, nextMonday, rangeLabel } = useMemo(
    () => ({
      prevMonday: addDaysISO(currentMonday, -7),
      nextMonday: addDaysISO(currentMonday, 7),
      rangeLabel: formatTurkishRange(currentMonday),
    }),
    [currentMonday],
  );

  const goToWeek = (targetMonday: string) => {
    if (onWeekChange) {
      onWeekChange(targetMonday);
      return;
    }
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set("week", targetMonday);
    router.push(`${pathname}?${params.toString()}`);
  };

  if (compact) {
    const isCurrentWeek = currentMonday === getCurrentWeekMonday();
    return (
      <div
        className={`flex items-center justify-between gap-1 rounded-2xl border border-gray-200 bg-white px-1.5 py-1.5 shadow-sm ${className}`}
      >
        <button
          type="button"
          aria-label="Önceki hafta"
          onClick={() => goToWeek(prevMonday)}
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-50 active:scale-95 active:bg-gray-100"
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col items-center px-1">
          <span className="w-full truncate text-center text-sm font-bold text-gray-900">
            {rangeLabel}
          </span>
          {isCurrentWeek ? null : (
            <button
              type="button"
              onClick={() => goToWeek(getCurrentWeekMonday())}
              className="min-h-4 touch-manipulation text-[11px] font-semibold text-indigo-600 underline-offset-2 hover:underline"
            >
              Bu hafta
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Sonraki hafta"
          onClick={() => goToWeek(nextMonday)}
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-50 active:scale-95 active:bg-gray-100"
        >
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    );
  }

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
