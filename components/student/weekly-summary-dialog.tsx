"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Sparkles, X } from "lucide-react";
import {
  getWeeklySummary,
  type WeeklySummaryData,
} from "@/app/actions/motivation-actions";
import { parseMonday, todayInIstanbul } from "@/lib/week-utils";

const ANNOUNCEMENT_SELECTOR =
  '[role="dialog"][aria-labelledby="announcement-dialog-title"]';
const ANNOUNCEMENT_WAIT_MS = 700;
const ANNOUNCEMENT_WAIT_MAX_TRIES = 15;

export function weeklySummaryShownKey(studentId: string): string {
  return `weeklySummaryShown:${studentId}`;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

interface WeeklySummaryDialogProps {
  studentId: string;
}

export function WeeklySummaryDialog({ studentId }: WeeklySummaryDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let tries = 0;
    const shownKey = weeklySummaryShownKey(studentId);

    try {
      if (window.localStorage.getItem(shownKey) === parseMonday(todayInIstanbul())) {
        return undefined;
      }
    } catch {
      // localStorage yoksa gösterim kaydı tutulamaz, oturum boyunca bir kez açılır
    }

    async function openWhenReady() {
      if (cancelled) return;
      const announcementOpen = document.querySelector(ANNOUNCEMENT_SELECTOR);
      if (announcementOpen !== null && tries < ANNOUNCEMENT_WAIT_MAX_TRIES) {
        tries += 1;
        timer = window.setTimeout(() => void openWhenReady(), ANNOUNCEMENT_WAIT_MS);
        return;
      }
      const result = await getWeeklySummary();
      if (cancelled) return;
      if (result.success === false) {
        console.error("Haftalık özet yüklenemedi:", result.message);
        return;
      }
      try {
        window.localStorage.setItem(shownKey, result.data.weekStart);
      } catch {
        // gösterim kaydı tutulamadıysa bir sonraki açılışta tekrar denenir
      }
      setData(result.data);
      setOpen(true);
    }

    void openWhenReady();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [studentId]);

  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first = focusableElements(dialog)[0];
      (first ?? dialog).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      const toRestore = restoreFocusRef.current;
      if (toRestore && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const elements = focusableElements(dialog);
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  if (!open || data === null) {
    return null;
  }

  const bestSubject = data.bestSubject;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-summary-title"
        tabIndex={-1}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t-4 border-indigo-500 bg-white pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Yeni Hafta
          </span>
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setOpen(false)}
            className="-mr-1 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-2">
          <h2
            id="weekly-summary-title"
            className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-gray-900"
          >
            <CalendarDays aria-hidden="true" className="h-5 w-5 text-indigo-500" />
            Geçen Haftanın Özeti
          </h2>

          <div className="mt-4 space-y-3 rounded-2xl bg-gray-50 p-4">
            <p className="text-base leading-relaxed font-bold text-gray-800">
              Geçen hafta{" "}
              <span className="text-2xl font-extrabold text-indigo-600">
                {data.daysEntered}
              </span>{" "}
              gün veri girdin.
            </p>
            <p className="text-base leading-relaxed font-bold text-gray-800">
              Toplam{" "}
              <span className="text-2xl font-extrabold text-indigo-600">
                {data.totalQuestions.toLocaleString("tr-TR")}
              </span>{" "}
              soru çözdün.
            </p>
            {bestSubject !== null ? (
              <p className="text-base leading-relaxed font-bold text-gray-800">
                En çok gelişme gösterdiğin ders:{" "}
                <span className="font-extrabold text-gray-900">
                  {bestSubject.subjectName}
                </span>
                <span className="ml-1 text-xs font-semibold text-gray-500">
                  (%{Math.round(bestSubject.fromPct)} → %
                  {Math.round(bestSubject.toPct)})
                </span>
              </p>
            ) : null}
          </div>

          <p className="mt-4 text-sm font-semibold leading-relaxed text-gray-600">
            Yeni haftada hedeflerin seni bekliyor. Hazırsan başlayalım!
          </p>
        </div>

        <div className="mt-5 px-5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 w-full touch-manipulation rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
