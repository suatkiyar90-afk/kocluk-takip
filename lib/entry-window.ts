import { ISTANBUL_TIME_ZONE } from "@/lib/week-utils";

export const ENTRY_OPEN_HOUR = 22;
export const ENTRY_CLOSE_HOUR = 24;

export const ENTRY_WINDOW_MESSAGE =
  "Günlük veri girişi yalnızca her gün 22.00–23.59 (Türkiye saati) arasında yapılabilir.";

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

const DAY_MS = 24 * 60 * 60 * 1000;

const FORCE_OPEN_DURATION_MS = 60 * 60 * 1000;

export function isEntryWindowForceOpen(): boolean {
  return process.env.NEXT_PUBLIC_ENTRY_WINDOW_FORCE_OPEN === "true";
}

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

export function getIstanbulHour(now: Date = new Date()): number {
  const parts = istanbulFormatter.formatToParts(now);
  for (const part of parts) {
    if (part.type === "hour") return Number(part.value);
  }
  return 0;
}

export function getEntryWindow(now: Date = new Date()): EntryWindow {
  return getEntryWindowForRange(now, ENTRY_OPEN_HOUR, ENTRY_CLOSE_HOUR);
}

export function getEntryWindowForRange(
  now: Date,
  startHour: number,
  endHour: number,
): EntryWindow {
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

  if (isEntryWindowForceOpen()) {
    return {
      state: "open",
      today,
      opensAt: now,
      closesAt: new Date(now.getTime() + FORCE_OPEN_DURATION_MS),
      msUntilOpen: 0,
      msUntilClose: FORCE_OPEN_DURATION_MS,
    };
  }

  const start = normalizeHour(startHour);
  const end = normalizeHour(endHour);
  const dayStartMs = Date.UTC(year, month - 1, day) - ISTANBUL_OFFSET_MS;
  const atHour = (baseMs: number, h: number) =>
    new Date(baseMs + h * 60 * 60 * 1000);

  const crossMidnight = start > end;
  const openNow = crossMidnight
    ? hour >= start || hour < end
    : hour >= start && hour < end;

  let opensAt: Date;
  let closesAt: Date;
  if (!crossMidnight) {
    opensAt = atHour(dayStartMs, start);
    closesAt = atHour(dayStartMs, end);
  } else if (hour >= start) {
    opensAt = atHour(dayStartMs, start);
    closesAt = atHour(dayStartMs + DAY_MS, end);
  } else if (hour < end) {
    opensAt = atHour(dayStartMs - DAY_MS, start);
    closesAt = atHour(dayStartMs, end);
  } else {
    opensAt = atHour(dayStartMs, start);
    closesAt = atHour(dayStartMs + DAY_MS, end);
  }

  const state: EntryWindowState = openNow
    ? "open"
    : hour < start
      ? "before"
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

function normalizeHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const floored = Math.floor(value);
  return ((floored % 24) + 24) % 24;
}

export function assertEntryWindowOpen(now: Date = new Date()): void {
  if (getEntryWindow(now).state !== "open") {
    throw new EntryWindowError();
  }
}

export function isWithinRange(
  hour: number,
  startHour: number,
  endHour: number,
): boolean {
  const start = normalizeHour(startHour);
  const end = normalizeHour(endHour);
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}
