import { describe, expect, it } from "vitest";
import { netScore } from "@/components/quiz-entry/weekly-quiz-schema";
import {
  aggregateWeekEntries,
  isDateInWeek,
  weekEndOf,
} from "./week-entries";
import { addDaysISO, getCurrentWeekMonday, todayInIstanbul } from "./week-utils";

describe("week-entries", () => {
  const weekStart = getCurrentWeekMonday();

  it("weekEndOf haftanın Pazar gününü döndürür", () => {
    expect(weekEndOf("2026-09-28")).toBe("2026-10-04");
    expect(weekEndOf(weekStart)).toBe(addDaysISO(weekStart, 6));
  });

  it("öğrencinin bugün girdiği veri hafta toplamına yansır", () => {
    const today = todayInIstanbul();
    const totals = aggregateWeekEntries(
      [{ date: today, correct: 5, wrong: 2, blank: 1 }],
      weekStart,
    );

    expect(isDateInWeek(today, weekStart)).toBe(true);
    expect(totals.hasEntries).toBe(true);
    expect(totals.total).toBe(8);
    expect(totals.net).toBe(netScore(5, 2));
    expect(totals.lastEntryDate).toBe(today);
  });

  it("geçen haftanın verisi hafta toplamına yansımaz", () => {
    const lastWeekDate = addDaysISO(weekStart, -1);
    const totals = aggregateWeekEntries(
      [{ date: lastWeekDate, correct: 10, wrong: 4, blank: 2 }],
      weekStart,
    );

    expect(isDateInWeek(lastWeekDate, weekStart)).toBe(false);
    expect(totals.hasEntries).toBe(false);
    expect(totals.total).toBe(0);
    expect(totals.net).toBe(0);
    expect(totals.lastEntryDate).toBeNull();
  });

  it("Pazar gecesi girilen veri o haftaya, Pazartesi gelen veri sonraki haftaya yazılır", () => {
    const sunday = weekEndOf(weekStart);
    const nextMonday = addDaysISO(weekStart, 7);

    expect(isDateInWeek(sunday, weekStart)).toBe(true);
    expect(isDateInWeek(nextMonday, weekStart)).toBe(false);

    const totals = aggregateWeekEntries(
      [
        { date: sunday, correct: 3, wrong: 1, blank: 0 },
        { date: nextMonday, correct: 40, wrong: 0, blank: 0 },
      ],
      weekStart,
    );

    expect(totals.hasEntries).toBe(true);
    expect(totals.total).toBe(4);
    expect(totals.net).toBe(netScore(3, 1));
    expect(totals.lastEntryDate).toBe(sunday);
  });

  it("aynı hafta içindeki birden fazla gün toplanır", () => {
    const totals = aggregateWeekEntries(
      [
        { date: weekStart, correct: 4, wrong: 1, blank: 2 },
        { date: addDaysISO(weekStart, 2), correct: 6, wrong: 2, blank: 0 },
        { date: addDaysISO(weekStart, -7), correct: 99, wrong: 0, blank: 0 },
      ],
      weekStart,
    );

    expect(totals.total).toBe(15);
    expect(totals.net).toBe(netScore(10, 3));
    expect(totals.lastEntryDate).toBe(addDaysISO(weekStart, 2));
  });
});
