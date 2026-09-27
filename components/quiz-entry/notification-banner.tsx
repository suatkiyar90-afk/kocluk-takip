"use client";

import { useEffect, useRef, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

type BannerStatus =
  | "hidden"
  | "prompt"
  | "needs-activation"
  | "busy"
  | "done"
  | "error";

type EnsureResult =
  | { status: "ok" }
  | { status: "permission-denied" }
  | { status: "error"; message: string };

async function ensureSubscribed(): Promise<EnsureResult> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return {
      status: "error",
      message: "Bu tarayıcı bildirimleri desteklemiyor.",
    };
  }

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { status: "permission-denied" };
  }
  if (Notification.permission !== "granted") {
    return { status: "permission-denied" };
  }

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return {
      status: "error",
      message: "Bildirim anahtarı tanımlı değil (NEXT_PUBLIC_VAPID_PUBLIC_KEY).",
    };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const res = await fetch("/api/web-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        subscription: subscription.toJSON(),
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      return {
        status: "error",
        message: data?.message || "Abonelik kaydedilemedi.",
      };
    }
    return { status: "ok" };
  } catch {
    return {
      status: "error",
      message: "Bildirim servisine bağlanılamadı.",
    };
  }
}

async function isRegisteredInDb(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    const res = await fetch(
      `/api/web-push?endpoint=${encodeURIComponent(subscription.endpoint)}`,
    );
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as {
      subscribed?: boolean;
    } | null;
    return data?.subscribed === true;
  } catch {
    return false;
  }
}

export function NotificationBanner() {
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
  const title = isActivation
    ? "Bildirimlerin henüz aktif değil"
    : "Gün sonu hatırlatmalarını kaçırma";
  const description = isActivation
    ? "İzin verilmiş ama bu cihaz için abonelik kaydedilmemiş. Etkinleştirerek hatırlatmaları ve koçunun dönütlerini almaya başla."
    : "Bildirimleri aç; günlük giriş hatırlatmaları ve koçunun dönütleri doğrudan cihazına gelsin.";
  const buttonLabel =
    status === "busy"
      ? "İşleniyor…"
      : status === "done"
        ? "Bildirimler aktif ✓"
        : status === "error"
          ? "Tekrar Dene"
          : isActivation
            ? "Bildirimleri Aktifleştir"
            : "Bildirimleri Aç";

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
        {title}
      </p>
      <p
        className={`mt-1 text-xs leading-relaxed ${
          isActivation ? "text-amber-700" : "text-indigo-700"
        }`}
      >
        {description}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={status === "busy" || status === "done"}
          className={`h-11 flex-1 rounded-xl text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 touch-manipulation ${
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
