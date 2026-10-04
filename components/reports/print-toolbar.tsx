"use client";

import { useEffect } from "react";

interface PrintToolbarProps {
  autoStart?: boolean;
}

export function PrintToolbar({ autoStart = false }: PrintToolbarProps) {
  useEffect(() => {
    if (!autoStart) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await document.fonts.ready;
        } catch {
          // Font beklemesi başarısız olursa yazdırmaya devam et.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        if (cancelled) return;
        try {
          window.print();
        } catch {
          // Yazdırma penceresi açılamazsa sayfayı bozma.
        }
      })();
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoStart]);

  function handlePrint() {
    try {
      window.print();
    } catch {
      // Yazdırma başlatılamazsa yoksay.
    }
  }

  function handleClose() {
    window.close();
    window.setTimeout(() => {
      if (!window.closed) {
        window.history.back();
      }
    }, 200);
  }

  return (
    <div
      role="toolbar"
      aria-label="Yazdırma araç çubuğu"
      className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 print:hidden"
    >
      <button
        type="button"
        onClick={handlePrint}
        className="flex h-11 touch-manipulation items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition active:scale-[0.98]"
      >
        Yazdır / PDF olarak kaydet
      </button>
      <button
        type="button"
        onClick={handleClose}
        className="flex h-11 touch-manipulation items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
      >
        Kapat
      </button>
    </div>
  );
}
