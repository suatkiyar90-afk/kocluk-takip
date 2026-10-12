export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string | null;
  weeklyJokersAvailable: number;
}

export interface StreakInput extends StreakState {
  entryDate: string;
}

function dayNumber(isoDate: string): number {
  return Math.round(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
}

function weekStartDay(isoDate: string): number {
  const day = dayNumber(isoDate);
  const dow = (new Date(day * 86_400_000).getUTCDay() + 6) % 7;
  return day - dow;
}

export function computeStreakState(input: StreakInput): StreakState {
  const entryDay = dayNumber(input.entryDate);
  const prevDate = input.lastEntryDate;
  const prevDay = prevDate !== null ? dayNumber(prevDate) : null;
  const gap = prevDay !== null ? entryDay - prevDay : null;

  let jokers = Math.max(0, input.weeklyJokersAvailable);

  // Haftanın ilk girişinde (Pazartesi dahil) joker 1'e eşitlenir.
  if (
    prevDate !== null &&
    prevDay !== null &&
    weekStartDay(input.entryDate) > weekStartDay(prevDate)
  ) {
    jokers = 1;
  }

  let current: number;
  if (prevDay === null) {
    current = 1;
  } else if (gap === null || gap < 0) {
    current = Math.max(1, input.currentStreak);
  } else if (gap === 0) {
    current = Math.max(1, input.currentStreak);
  } else if (gap === 1) {
    current = input.currentStreak + 1;
  } else if (gap === 2) {
    if (jokers > 0) {
      jokers -= 1;
      current = input.currentStreak + 1;
    } else {
      current = 1;
    }
  } else {
    current = 1;
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(input.longestStreak, current),
    lastEntryDate: input.entryDate,
    weeklyJokersAvailable: Math.max(0, jokers),
  };
}
