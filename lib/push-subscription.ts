export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export type EnsureResult =
  | { status: "ok" }
  | { status: "permission-denied" }
  | { status: "error"; message: string };

export async function ensureSubscribed(): Promise<EnsureResult> {
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

export async function isRegisteredInDb(): Promise<boolean> {
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
