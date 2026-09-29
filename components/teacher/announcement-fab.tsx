"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { toast } from "sonner";

const MAX_TITLE = 120;
const MAX_BODY = 500;

interface SendResponse {
  success?: boolean;
  sent?: number;
  failed?: number;
  total?: number;
  message?: string;
}

export function AnnouncementFab({ studentCount }: { studentCount: number }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleClose() {
    if (sending) return;
    setOpen(false);
    setStep("form");
    setTitle("");
    setMessage("");
  }

  async function handleConfirm() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/web-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          title: title.trim(),
          body: message.trim(),
          url: "/panel",
        }),
      });
      const data = (await res.json().catch(() => null)) as SendResponse | null;

      if (!res.ok || data?.success !== true) {
        toast.error(data?.message || "Duyuru gönderilemedi.");
        setStep("form");
        return;
      }

      toast.success(
        `Duyuru gönderildi (${data.sent ?? 0} bildirim, ${data.total ?? 0} öğrenci).`,
      );
      handleClose();
    } catch {
      toast.error("Duyuru gönderilirken bir hata oluştu.");
      setStep("form");
    } finally {
      setSending(false);
    }
  }

  const titleValid = title.trim().length > 0 && message.trim().length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Duyuru Gönder"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 transition active:scale-[0.95] touch-manipulation md:bottom-6"
      >
        <Megaphone aria-hidden="true" className="h-6 w-6" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={handleClose}
          role="presentation"
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Toplu duyuru gönder"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t border-gray-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />

            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">
                Duyuru Gönder
              </h2>
              <button
                type="button"
                onClick={handleClose}
                disabled={sending}
                aria-label="Kapat"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition active:scale-[0.97] touch-manipulation"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <span className="mt-3 inline-flex rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
              Kime: Tüm öğrencilerim ({studentCount} öğrenci)
            </span>

            {step === "form" ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="announcement-title"
                    className="text-xs font-bold uppercase tracking-wide text-gray-500"
                  >
                    Başlık
                  </label>
                  <input
                    id="announcement-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                    maxLength={MAX_TITLE}
                    placeholder="Yarın deneme sınavı var"
                    className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  />
                  <p className="mt-1 text-right text-[11px] font-medium text-gray-400">
                    {title.length}/{MAX_TITLE}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="announcement-body"
                    className="text-xs font-bold uppercase tracking-wide text-gray-500"
                  >
                    Mesaj
                  </label>
                  <textarea
                    id="announcement-body"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_BODY))}
                    maxLength={MAX_BODY}
                    rows={4}
                    placeholder="Duyurunu buraya yaz…"
                    className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white p-3.5 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  />
                  <p className="mt-1 text-right text-[11px] font-medium text-gray-400">
                    {message.length}/{MAX_BODY}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!titleValid}
                  onClick={() => setStep("confirm")}
                  className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  Önizle ve Gönder
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                  <p className="text-sm font-bold text-gray-900">
                    {title.trim()}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-gray-600">
                    {message.trim()}
                  </p>
                </div>

                <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-800">
                  {studentCount} öğrenciye gönderilecek, onaylıyor musun?
                </p>

                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void handleConfirm()}
                  className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  {sending ? "Gönderiliyor…" : "Evet, Gönder"}
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => setStep("form")}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-600 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  Vazgeç
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
