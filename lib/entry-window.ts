import { ISTANBUL_TIME_ZONE } from "@/lib/week-utils";

export const ENTRY_OPEN_HOUR = 22;
export const ENTRY_CLOSE_HOUR = 23;

export const ENTRY_WINDOW_MESSAGE =
  "Günlük veri girişi yalnızca her gün 22.00–23.00 (Türkiye saati) arasında yapılabilir.";

export const ENTRY_DATE_MESSAGE =
  "Yalnızca bugünün tarihi için giriş yapılabilir.";

export type EntryWindowState = "before" | "open" | "after";

export interface EntryWindow {
  state: EntryWindowState;
  today: string;
  opensAt: Date;
  closesAt: Date;
  msUntilOpen: number;
  msUntilClose: number;
}

export class EntryWindowError extends Error {
  constructor(message: string = ENTRY_WINDOW_MESSAGE) {
    super(message);
    this.name = "EntryWindowError";
  }
}

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

const istanbulFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ISTANBUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getEntryWindow(now: Date = new Date()): EntryWindow {
  const parts = istanbulFormatter.formatToParts(now);
  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
    else if (part.type === "hour") hour = Number(part.value);
  }

  const today = `${year}-${pad2(month)}-${pad2(day)}`;
  const opensAt = new Date(
    Date.UTC(year, month - 1, day, ENTRY_OPEN_HOUR) - ISTANBUL_OFFSET_MS,
  );
  const closesAt = new Date(
    Date.UTC(year, month - 1, day, ENTRY_CLOSE_HOUR) - ISTANBUL_OFFSET_MS,
  );

  const state: EntryWindowState =
    hour < ENTRY_OPEN_HOUR
      ? "before"
      : hour < ENTRY_CLOSE_HOUR
        ? "open"
        : "after";

  return {
    state,
    today,
    opensAt,
    closesAt,
    msUntilOpen: Math.max(0, opensAt.getTime() - now.getTime()),
    msUntilClose: Math.max(0, closesAt.getTime() - now.getTime()),
  };
}

export function assertEntryWindowOpen(now: Date = new Date()): void {
  if (getEntryWindow(now).state !== "open") {
    throw new EntryWindowError();
  }
}
