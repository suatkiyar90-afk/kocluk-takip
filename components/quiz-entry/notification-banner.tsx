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

type BannerStatus = "hidden" | "show" | "busy" | "granted" | "error";

export function NotificationBanner() {
  const [status, setStatus] = useState<BannerStatus>("hidden");
  const [message, setMessage] = useState("");
  const startedRef = useRef(false);

  async function ensureSubscribed(): Promise<boolean> {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      setMessage(
        "Bildirim anahtarı tanımlı değil (NEXT_PUBLIC_VAPID_PUBLIC_KEY).",
      );
      return false;
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
        setMessage(data?.message || "Abonelik kaydedilemedi.");
        return false;
      }
      return true;
    } catch {
      setMessage("Bildirim servisine bağlanılamadı.");
      return false;
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (sessionStorage.getItem("pushBannerDismissed") === "1") return;

    if (Notification.permission === "default") {
      setStatus("show");
      return;
    }

    if (Notification.permission === "granted") {
      void (async () => {
        const ok = await ensureSubscribed();
        if (!ok) {
          console.warn("push subscription refresh failed:", message);
        }
      })();
    }
  }, [message]);

  useEffect(() => {
    if (status !== "granted") return;
    const timer = setTimeout(() => setStatus("hidden"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleEnable() {
    setStatus("busy");
    setMessage("");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("hidden");
      return;
    }

    const ok = await ensureSubscribed();
    if (ok) {
      setStatus("granted");
    } else {
      setStatus("error");
    }
  }

  function handleDismiss() {
    sessionStorage.setItem("pushBannerDismissed", "1");
    setStatus("hidden");
  }

  if (status === "hidden") return null;

  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
      <p className="text-sm font-bold text-indigo-900">
        Gün sonu hatırlatmalarını kaçırma
      </p>
      <p className="mt-1 text-xs leading-relaxed text-indigo-700">
        Bildirimleri aç; günlük giriş hatırlatmaları ve koçunun dönütleri
        doğrudan cihazına gelsin.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={status === "busy" || status === "granted"}
          className="h-11 flex-1 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-60 touch-manipulation"
        >
          {status === "busy"
            ? "İzin alınıyor…"
            : status === "granted"
              ? "Bildirimler açıldı ✓"
              : "Bildirimleri Aç"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={status === "busy"}
          className="h-11 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition active:scale-[0.98] disabled:opacity-60 touch-manipulation"
        >
          Şimdi değil
        </button>
      </div>

      {status === "error" && message ? (
        <p className="mt-2 text-xs font-medium text-red-600">{message}</p>
      ) : null}
      {status === "granted" ? (
        <p className="mt-2 text-xs font-medium text-green-700">
          Teşekkürler! Bildirimlerin açıldı.
        </p>
      ) : null}
    </div>
  );
}
