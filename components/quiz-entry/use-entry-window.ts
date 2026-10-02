"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getEntryWindowStatus,
  type EntryWindowStatusData,
} from "@/app/actions/quiz-actions";
import { getEntryWindow, type EntryWindow } from "@/lib/entry-window";

const NORMAL_INTERVAL_MS = 60_000;
const URGENT_INTERVAL_MS = 30_000;
const ALERT_THRESHOLD_MS = 5 * 60 * 1000;

export interface UseEntryWindowResult {
  status: EntryWindowStatusData | null;
  entryWindow: EntryWindow | null;
  alert: boolean;
  refresh: () => void;
}

export function useEntryWindow(): UseEntryWindowResult {
  const [status, setStatus] = useState<EntryWindowStatusData | null>(null);
  const [entryWindow, setEntryWindow] = useState<EntryWindow | null>(null);
  const [alert, setAlert] = useState(false);
  const offsetMsRef = useRef(0);
  const serverStateRef = useRef<EntryWindowStatusData["state"] | null>(null);

  const refresh = useCallback(() => {
    void (async () => {
      const result = await getEntryWindowStatus();
      if (result.success) {
        offsetMsRef.current = Date.parse(result.data.serverNow) - Date.now();
        serverStateRef.current = result.data.state;
        setStatus(result.data);
        setEntryWindow(getEntryWindow(new Date(Date.now() + offsetMsRef.current)));
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const tick = () => {
      const w = getEntryWindow(new Date(Date.now() + offsetMsRef.current));
      setEntryWindow(w);
      setAlert(
        w.state === "open" &&
          w.msUntilClose > 0 &&
          w.msUntilClose <= ALERT_THRESHOLD_MS,
      );
      if (w.state !== serverStateRef.current) {
        refresh();
      }
    };

    const intervalMs = alert ? URGENT_INTERVAL_MS : NORMAL_INTERVAL_MS;
    const id = setInterval(tick, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [status, alert, refresh]);

  return { status, entryWindow, alert, refresh };
}
