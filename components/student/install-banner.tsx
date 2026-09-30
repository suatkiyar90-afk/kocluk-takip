"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage yoksa bandı yine de gösterebiliriz
    }
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (deferred === null) return null;

  async function handleInstall() {
    const promptEvent = deferred;
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        try {
          localStorage.setItem(DISMISS_KEY, "1");
        } catch {
          // yoksay
        }
      }
    } catch {
      // prompt tetiklenemediyse bant gizlenir
    }
    setDeferred(null);
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // yoksay
    }
    setDeferred(null);
  }

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white"
      >
        <Download className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-indigo-900">Ana ekrana ekle</p>
        <p className="text-[11px] leading-snug text-indigo-700">
          Akademik Takip’i uygulama gibi aç.
        </p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="h-9 shrink-0 rounded-lg bg-indigo-600 px-3.5 text-xs font-bold text-white transition active:scale-95 touch-manipulation"
      >
        Ekle
      </button>
      <button
        type="button"
        aria-label="Bandı kapat"
        onClick={handleDismiss}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-indigo-400 transition hover:bg-indigo-100 hover:text-indigo-700 touch-manipulation"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
