"use client";

import { useEffect } from "react";
import { touchSeenAction } from "@/lib/touch-seen-action";

const MIN_INTERVAL_MS = 10 * 60 * 1000;

export function TouchSeenObserver() {
  useEffect(() => {
    let lastRunAt = 0;

    const run = () => {
      const now = Date.now();
      if (now - lastRunAt < MIN_INTERVAL_MS) {
        return;
      }
      lastRunAt = now;
      void touchSeenAction().catch(() => {});
    };

    run();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
