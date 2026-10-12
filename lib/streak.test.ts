import { describe, expect, it } from "vitest";
import { computeStreakState, type StreakInput } from "./streak";

function state(overrides: Partial<StreakInput> = {}): StreakInput {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastEntryDate: null,
    weeklyJokersAvailable: 1,
    entryDate: "2026-10-12",
    ...overrides,
  };
}

describe("computeStreakState", () => {
  it("ilk girişte seri 1'den başlar", () => {
    const next = computeStreakState(state());
    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(1);
    expect(next.lastEntryDate).toBe("2026-10-12");
    expect(next.weeklyJokersAvailable).toBe(1);
  });

  it("dünden beri giriş varsa seri +1 artar", () => {
    const next = computeStreakState(
      state({
        currentStreak: 5,
        longestStreak: 8,
        lastEntryDate: "2026-10-11",
      }),
    );
    expect(next.currentStreak).toBe(6);
    expect(next.longestStreak).toBe(8);
  });

  it("aynı gün ikinci kayıt seriyi ve jokeri değiştirmez", () => {
    const next = computeStreakState(
      state({
        currentStreak: 4,
        longestStreak: 7,
        lastEntryDate: "2026-10-12",
        weeklyJokersAvailable: 0,
      }),
    );
    expect(next.currentStreak).toBe(4);
    expect(next.longestStreak).toBe(7);
    expect(next.weeklyJokersAvailable).toBe(0);
    expect(next.lastEntryDate).toBe("2026-10-12");
  });

  it("1 gün kaçırmış ve jokeri varsa joker harcanır, seri devam eder (aynı hafta)", () => {
    const next = computeStreakState(
      state({
        currentStreak: 5,
        longestStreak: 9,
        lastEntryDate: "2026-10-08",
        weeklyJokersAvailable: 1,
        entryDate: "2026-10-10",
      }),
    );
    expect(next.currentStreak).toBe(6);
    expect(next.weeklyJokersAvailable).toBe(0);
    expect(next.longestStreak).toBe(9);
  });

  it("1 gün kaçırmış ama jokeri yoksa seri 1'den başlar (aynı hafta)", () => {
    const next = computeStreakState(
      state({
        currentStreak: 5,
        longestStreak: 9,
        lastEntryDate: "2026-10-08",
        weeklyJokersAvailable: 0,
        entryDate: "2026-10-10",
      }),
    );
    expect(next.currentStreak).toBe(1);
    expect(next.weeklyJokersAvailable).toBe(0);
    expect(next.longestStreak).toBe(9);
  });

  it("2 günden fazla boşlukta joker kullanılmaz, seri 1'den başlar", () => {
    const next = computeStreakState(
      state({
        currentStreak: 5,
        longestStreak: 9,
        lastEntryDate: "2026-10-09",
        weeklyJokersAvailable: 1,
        entryDate: "2026-10-12",
      }),
    );
    expect(next.currentStreak).toBe(1);
    expect(next.weeklyJokersAvailable).toBe(1);
  });

  it("yeni haftanın ilk girişinde joker 1'e eşitlenir", () => {
    const next = computeStreakState(
      state({
        currentStreak: 3,
        longestStreak: 6,
        lastEntryDate: "2026-10-11",
        weeklyJokersAvailable: 0,
        entryDate: "2026-10-12",
      }),
    );
    expect(next.weeklyJokersAvailable).toBe(1);
    expect(next.currentStreak).toBe(4);
  });

  it("yeni haftada joker sıfırlanıp aynı girişte harcanabilir (Pazar→Salı)", () => {
    const next = computeStreakState(
      state({
        currentStreak: 3,
        longestStreak: 6,
        lastEntryDate: "2026-10-11",
        weeklyJokersAvailable: 0,
        entryDate: "2026-10-13",
      }),
    );
    expect(next.currentStreak).toBe(4);
    expect(next.weeklyJokersAvailable).toBe(0);
  });

  it("aynı haftada joker sıfırlanmaz (Çarşamba→Perşembe)", () => {
    const next = computeStreakState(
      state({
        currentStreak: 2,
        longestStreak: 4,
        lastEntryDate: "2026-10-07",
        weeklyJokersAvailable: 0,
        entryDate: "2026-10-08",
      }),
    );
    expect(next.weeklyJokersAvailable).toBe(0);
    expect(next.currentStreak).toBe(3);
  });

  it("longest_streak yeni seriyi geçerse güncellenir", () => {
    const next = computeStreakState(
      state({
        currentStreak: 9,
        longestStreak: 9,
        lastEntryDate: "2026-10-11",
      }),
    );
    expect(next.currentStreak).toBe(10);
    expect(next.longestStreak).toBe(10);
  });

  it("negatif boşluk (bozuk tarih) seriyi bozmaz", () => {
    const next = computeStreakState(
      state({
        currentStreak: 4,
        longestStreak: 4,
        lastEntryDate: "2026-10-13",
        entryDate: "2026-10-12",
      }),
    );
    expect(next.currentStreak).toBe(4);
    expect(next.weeklyJokersAvailable).toBe(1);
  });
});
