export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getCurrentWeekMonday(now: Date = new Date()): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - diff);
  return toISODate(start);
}

export function parseMonday(value?: string): string {
  if (value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day);
      const valid =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
      if (valid) {
        return getCurrentWeekMonday(date);
      }
    }
  }
  return getCurrentWeekMonday();
}