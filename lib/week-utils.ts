export const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

const istanbulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ISTANBUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayInIstanbul(now: Date = new Date()): string {
  const parts = istanbulDateFormatter.formatToParts(now);
  let year = "";
  let month = "";
  let day = "";
  for (const part of parts) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }
  return `${year}-${month}-${day}`;
}

export function isValidISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(
    dt.getUTCDate(),
  )}`;
}

export function mondayOfISO(iso: string): string {
  const diff = (weekdayOfISO(iso) + 6) % 7;
  return diff === 0 ? iso : addDaysISO(iso, -diff);
}

export function getCurrentWeekMonday(now: Date = new Date()): string {
  return mondayOfISO(todayInIstanbul(now));
}

export function parseMonday(value?: string): string {
  if (value && isValidISODate(value)) {
    return mondayOfISO(value);
  }
  return getCurrentWeekMonday();
}
