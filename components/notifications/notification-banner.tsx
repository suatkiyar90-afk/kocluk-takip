"use client";

import { useEffect, useRef, useState } from "react";
import {
  ensureSubscribed,
  isRegisteredInDb,
} from "@/lib/push-subscription";

type BannerStatus =
  | "hidden"
  | "prompt"
  | "needs-activation"
  | "busy"
  | "done"
  | "error";

export interface NotificationBannerProps {
  title?: string;
  description?: string;
  enableLabel?: string;
  activateLabel?: string;
}

export function NotificationBanner({
  title = "Gün sonu hatırlatmalarını kaçırma",
  description = "Bildirimleri aç; günlük giriş hatırlatmaları ve danışman öğretmeninin dönütleri doğrudan cihazına gelsin.",
  enableLabel = "Bildirimleri Aç",
  activateLabel = "Bildirimleri Aktifleştir",
}: NotificationBannerProps = {}) {
  const [status, setStatus] = useState<BannerStatus>("hidden");
  const [message, setMessage] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (sessionStorage.getItem("pushBannerDismissed") === "1") return;

    const permission = Notification.permission;

    if (permission === "default") {
      setStatus("prompt");
      return;
    }

    if (permission === "granted") {
      void (async () => {
        const registered = await isRegisteredInDb();
        setStatus(registered ? "hidden" : "needs-activation");
      })();
      return;
    }

    // permission === "denied": tarayıcı ayarı değiştirilmeden tekrar istenemez
    setStatus("hidden");
  }, []);

  useEffect(() => {
    if (status !== "done") return;
    const timer = setTimeout(() => setStatus("hidden"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleEnable() {
    setStatus("busy");
    setMessage("");

    const result = await ensureSubscribed();

    if (result.status === "ok") {
      setStatus("done");
      return;
    }
    if (result.status === "permission-denied") {
      setStatus("hidden");
      return;
    }
    setMessage(result.message);
    setStatus("error");
  }

  function handleDismiss() {
    sessionStorage.setItem("pushBannerDismissed", "1");
    setStatus("hidden");
  }

  if (status === "hidden") return null;

  const isActivation = status === "needs-activation" || status === "error";
  const activationTitle = "Bildirimlerin henüz aktif değil";
  const activationDescription =
    "İzin verilmiş ama bu cihaz için abonelik kaydedilmemiş. Etkinleştirerek yeni soru bildirimlerini ve duyuruları almaya başla.";
  const buttonLabel =
    status === "busy"
      ? "İşleniyor…"
      : status === "done"
        ? "Bildirimler aktif ✓"
        : status === "error"
          ? "Tekrar Dene"
          : isActivation
            ? activateLabel
            : enableLabel;

  return (
    <div
      className={`mb-4 rounded-2xl border p-4 shadow-sm ${
        isActivation
          ? "border-amber-300 bg-amber-50"
          : "border-indigo-200 bg-indigo-50"
      }`}
    >
      <p
        className={`text-sm font-bold ${
          isActivation ? "text-amber-900" : "text-indigo-900"
        }`}
      >
        {isActivation ? activationTitle : title}
      </p>
      <p
        className={`mt-1 text-xs leading-relaxed ${
          isActivation ? "text-amber-700" : "text-indigo-700"
        }`}
      >
        {isActivation ? activationDescription : description}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={status === "busy" || status === "done"}
          className={`h-11 min-w-0 flex-1 rounded-xl text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 touch-manipulation ${
            isActivation
              ? "bg-amber-600 shadow-amber-600/25"
              : "bg-indigo-600 shadow-indigo-600/25"
          }`}
        >
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={status === "busy"}
          className={`h-11 rounded-xl border bg-white px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 touch-manipulation ${
            isActivation
              ? "border-amber-300 text-amber-700"
              : "border-indigo-200 text-indigo-700"
          }`}
        >
          Şimdi değil
        </button>
      </div>

      {status === "error" && message ? (
        <p className="mt-2 text-xs font-medium text-red-600">{message}</p>
      ) : null}
      {status === "done" ? (
        <p className="mt-2 text-xs font-medium text-green-700">
          Teşekkürler! Bildirimlerin aktif.
        </p>
      ) : null}
    </div>
  );
}
