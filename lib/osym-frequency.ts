export const RECENT_YEAR_COUNT = 5;
export const OSYM_GUARANTEED_AVG = 0.8;
export const OSYM_REGULAR_AVG = 0.4;

export type OsymFrequencyTier = "garanti" | "duzenli" | "seyrek" | "yok";

export interface OsymYearCount {
  year: number;
  count: number;
}

export interface OsymFrequency {
  tier: OsymFrequencyTier;
  label: string;
  icon: string;
  totalQuestions: number;
  years: OsymYearCount[];
  recentAverage: number;
}

const TIER_META: Record<OsymFrequencyTier, { label: string; icon: string }> = {
  garanti: { label: "Garanti Konu", icon: "🔥" },
  duzenli: { label: "Düzenli Çıkar", icon: "⭐" },
  seyrek: { label: "Seyrek Çıkar", icon: "📌" },
  yok: { label: "", icon: "" },
};

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function osymYearCounts(
  counts?: Record<string, number> | null,
): OsymYearCount[] {
  if (!counts) return [];
  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count: Number(count) }))
    .filter(
      (entry) =>
        Number.isFinite(entry.year) &&
        Number.isFinite(entry.count) &&
        entry.count > 0,
    )
    .sort((a, b) => b.year - a.year);
}

export function osymTotalQuestions(
  counts?: Record<string, number> | null,
): number {
  return osymYearCounts(counts).reduce((total, entry) => total + entry.count, 0);
}

export function computeRecentAverage(
  counts?: Record<string, number> | null,
  recentYears = RECENT_YEAR_COUNT,
): number {
  const years = osymYearCounts(counts).slice(0, recentYears);
  if (years.length === 0) return 0;
  const sum = years.reduce((total, entry) => total + entry.count, 0);
  return roundTo(sum / recentYears, 2);
}

export function classifyOsymFrequency(
  avgRecentQuestions: number,
  counts?: Record<string, number> | null,
): OsymFrequency {
  const years = osymYearCounts(counts);
  const totalQuestions = years.reduce((total, entry) => total + entry.count, 0);
  let tier: OsymFrequencyTier = "yok";
  if (avgRecentQuestions >= OSYM_GUARANTEED_AVG) tier = "garanti";
  else if (avgRecentQuestions >= OSYM_REGULAR_AVG) tier = "duzenli";
  else if (totalQuestions > 0) tier = "seyrek";

  return {
    tier,
    label: TIER_META[tier].label,
    icon: TIER_META[tier].icon,
    totalQuestions,
    years,
    recentAverage: roundTo(avgRecentQuestions, 2),
  };
}

export type OsymMasteryStatus = "baslamadi" | "calisiliyor" | "bitti";

export interface OsymMasteryInput {
  status: OsymMasteryStatus;
  avgRecentQuestions: number;
}

export interface OsymMasteryResult {
  percent: number | null;
  weightedDone: number;
  weightedTotal: number;
}

export function weightedMastery(
  items: OsymMasteryInput[],
): OsymMasteryResult {
  let weightedTotal = 0;
  let weightedDone = 0;
  for (const item of items) {
    const weight = Math.max(0, item.avgRecentQuestions);
    weightedTotal += weight;
    if (item.status === "bitti") weightedDone += weight;
  }
  const percent =
    weightedTotal > 0
      ? Math.round((weightedDone / weightedTotal) * 100)
      : null;
  return {
    percent,
    weightedDone: roundTo(weightedDone, 2),
    weightedTotal: roundTo(weightedTotal, 2),
  };
}

export function sanitizeYearlyCounts(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!raw) return result;
  for (const [key, value] of Object.entries(raw)) {
    const year = Number(key);
    const count = Number(value);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) continue;
    if (!Number.isFinite(count) || count < 0) continue;
    result[String(year)] = Math.round(count);
  }
  return result;
}
