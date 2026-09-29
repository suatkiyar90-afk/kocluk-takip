"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  ensureSubscribed,
  isRegisteredInDb,
} from "@/lib/push-subscription";

type Status = "checking" | "active" | "inactive" | "unsupported";

export function NotificationStatusIcon() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator)
    ) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission !== "granted") {
      setStatus("inactive");
      return;
    }

    void (async () => {
      const registered = await isRegisteredInDb();
      if (!cancelled) setStatus(registered ? "active" : "inactive");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleClick() {
    if (busy) return;
    if (status === "unsupported") {
      toast.error("Bu tarayıcı bildirimleri desteklemiyor.");
      return;
    }
    if (status === "active") {
      toast.info("Bildirimlerin aktif. Yeni sorularda haberdar olacaksın.");
      return;
    }

    setBusy(true);
    const result = await ensureSubscribed();
    setBusy(false);

    if (result.status === "ok") {
      setStatus("active");
      toast.success("Bildirimler aktif.");
    } else if (result.status === "permission-denied") {
      toast.error("Bildirim izni verilmedi. Tarayıcı ayarlarını kontrol et.");
    } else {
      toast.error(result.message);
    }
  }

  const active = status === "active";

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy || status === "checking"}
      aria-label={
        active
          ? "Bildirimler aktif (bilgi)"
          : "Bildirimleri aç"
      }
      title={
        active ? "Bildirimler aktif" : "Bildirimleri aç"
      }
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white transition active:scale-[0.97] disabled:opacity-60 touch-manipulation"
    >
      {active ? (
        <BellRing aria-hidden="true" className="h-5 w-5 text-emerald-600" />
      ) : (
        <Bell aria-hidden="true" className="h-5 w-5 text-gray-500" />
      )}
    </button>
  );
}
