"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Info, RefreshCw, X } from "lucide-react";
import {
  dismissAnnouncement,
  getMyPendingAnnouncements,
} from "@/app/actions/announcement-actions";
import {
  shouldShowAnnouncements,
  type AnnouncementItem,
  type AnnouncementKind,
} from "@/lib/announcements";

const REFRESH_MIN_INTERVAL_MS = 10 * 60 * 1000;

const failedDismissIds = new Set<string>();

const KIND_META: Record<
  AnnouncementKind,
  {
    label: string;
    Icon: typeof Info;
    chip: string;
    bar: string;
  }
> = {
  info: {
    label: "Bilgi",
    Icon: Info,
    chip: "border-blue-100 bg-blue-50 text-blue-700",
    bar: "border-t-blue-500",
  },
  update: {
    label: "Güncelleme",
    Icon: RefreshCw,
    chip: "border-emerald-100 bg-emerald-50 text-emerald-700",
    bar: "border-t-emerald-500",
  },
  important: {
    label: "Önemli",
    Icon: AlertTriangle,
    chip: "border-red-100 bg-red-50 text-red-700",
    bar: "border-t-red-500",
  },
};

interface AnnouncementDialogProps {
  initialAnnouncements: AnnouncementItem[];
  preview?: boolean;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

export function AnnouncementDialog({
  initialAnnouncements,
  preview = false,
}: AnnouncementDialogProps) {
  const pathname = usePathname();
  const [queue, setQueue] = useState<AnnouncementItem[]>(() =>
    initialAnnouncements.filter((item) => !failedDismissIds.has(item.id)),
  );
  const [closedIds, setClosedIds] = useState<Set<string>>(() => new Set());
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(() => initialAnnouncements.length > 0);

  const closedRef = useRef<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef(Date.now());
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (preview) {
      setQueue(initialAnnouncements);
      setClosedIds(new Set());
      closedRef.current = new Set();
      setIndex(0);
    }
  }, [preview, initialAnnouncements]);

  useEffect(() => {
    if (!shouldShowAnnouncements({ path: pathname })) {
      setOpen(false);
    }
  }, [pathname]);

  const markClosed = useCallback((id: string) => {
    closedRef.current.add(id);
    setClosedIds(new Set(closedRef.current));
  }, []);

  const dismissSilently = useCallback((id: string) => {
    if (preview || failedDismissIds.has(id)) return;
    dismissAnnouncement(id)
      .then((result) => {
        if (result.success === false) {
          failedDismissIds.add(id);
          console.error("Duyuru kapatılamadı:", result.message);
        }
      })
      .catch((error) => {
        failedDismissIds.add(id);
        console.error("Duyuru kapatılamadı:", error);
      });
  }, [preview]);

  const current = queue[index];
  const visibleQueue = queue.filter((item) => !closedIds.has(item.id));
  const isVisibleCurrent =
    current !== undefined && !closedIds.has(current.id);
  const position =
    isVisibleCurrent && visibleQueue.indexOf(current) >= 0
      ? visibleQueue.indexOf(current) + 1
      : 1;
  const nextId =
    isVisibleCurrent && index + 1 < queue.length ? queue[index + 1] : undefined;
  const hasNext = nextId !== undefined && !closedIds.has(nextId.id);
  const isLast = !hasNext;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  function handleAnladim() {
    if (current) {
      markClosed(current.id);
      dismissSilently(current.id);
    }
    close();
  }

  function handleNext() {
    if (!current) return;
    markClosed(current.id);
    dismissSilently(current.id);
    let nextIndex = index + 1;
    while (nextIndex < queue.length && closedIds.has(queue[nextIndex].id)) {
      nextIndex += 1;
    }
    if (nextIndex < queue.length) {
      setIndex(nextIndex);
    } else {
      close();
    }
  }

  function handleDismissAndClose() {
    if (current) {
      markClosed(current.id);
      dismissSilently(current.id);
    }
    close();
  }

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
    if (!open || preview) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleDismissAndClose();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preview, current]);

  useEffect(() => {
    if (preview) return undefined;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastFetchRef.current < REFRESH_MIN_INTERVAL_MS) return;
      lastFetchRef.current = now;
      getMyPendingAnnouncements()
        .then((result) => {
          const incoming = (
            result.data?.announcements ?? []
          ).filter((item) => !failedDismissIds.has(item.id));
          setQueue((prev) => {
            const known = new Set(prev.map((item) => item.id));
            const fresh = incoming.filter((item) => !known.has(item.id));
            if (fresh.length === 0) return prev;
            const merged = [...prev, ...fresh].sort(
              (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
            );
            const firstOpen = merged.findIndex(
              (item) => !closedRef.current.has(item.id),
            );
            if (firstOpen >= 0) {
              setIndex(firstOpen);
              setOpen(true);
            }
            return merged;
          });
        })
        .catch((error) => {
          console.error("Duyurular yenilenemedi:", error);
        });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [preview]);

  if (!shouldShowAnnouncements({ path: pathname })) {
    return null;
  }
  if (!open || current === undefined || !isVisibleCurrent) {
    return null;
  }

  const meta = KIND_META[current.kind] ?? KIND_META.info;
  const total = visibleQueue.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !preview) {
          handleDismissAndClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-dialog-title"
        tabIndex={-1}
        className={`max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t-4 bg-white pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5 ${meta.bar}`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.chip}`}
            >
              <meta.Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {meta.label}
            </span>
            {!preview && total > 1 ? (
              <span
                aria-live="polite"
                className="shrink-0 text-[11px] font-semibold text-gray-400"
              >
                {position}/{total}
              </span>
            ) : null}
          </div>
          {!preview ? (
            <button
              type="button"
              aria-label="Kapat"
              onClick={handleDismissAndClose}
              className="-mr-1 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="px-5 pt-3">
          <h2
            id="announcement-dialog-title"
            className="break-words text-base font-bold text-gray-900"
          >
            {current.title}
          </h2>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-gray-600">
            {current.body}
          </p>
        </div>

        <div className="mt-5 flex gap-3 px-5">
          {!preview && hasNext ? (
            <button
              type="button"
              onClick={handleNext}
              className="h-11 flex-1 touch-manipulation rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
            >
              Sonraki
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAnladim}
              className="h-11 flex-1 touch-manipulation rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
            >
              Anladım
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
