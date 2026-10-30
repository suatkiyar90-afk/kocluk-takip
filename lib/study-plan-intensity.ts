import type { StudyPlanSlot, StudyPlanTaskType } from "@/db/schema";

export type IntensityTier = "low" | "medium" | "high";

export type FocusMode = "topic_heavy" | "balanced" | "question_heavy";

export type PlanLoadStatus = "below" | "low" | "medium" | "high";

export interface PlanBlock {
  startTime: string;
  endTime: string;
}

export interface IntensityBand {
  min: number;
  max: number;
}

export interface IntensityProfile {
  id: IntensityTier;
  label: string;
  emoji: string;
  minQuestions: number;
  maxQuestions: number;
  targetQuestions: number;
  blockCount: number;
  weekdayCount: number;
  weekendCount: number;
  weekdayBlocks: PlanBlock[];
  weekendBlocks: PlanBlock[];
  bands: Record<"konu" | "soru" | "tekrar", IntensityBand> & {
    rutin: number;
    deneme: number;
  };
}

export const INTENSITY_ORDER: IntensityTier[] = ["low", "medium", "high"];

export const INTENSITY_PROFILES: Record<IntensityTier, IntensityProfile> = {
  low: {
    id: "low",
    label: "Düşük",
    emoji: "🌱",
    minQuestions: 250,
    maxQuestions: 500,
    targetQuestions: 400,
    blockCount: 16,
    weekdayCount: 2,
    weekendCount: 3,
    weekdayBlocks: [
      { startTime: "19:30", endTime: "20:30" },
      { startTime: "20:45", endTime: "21:45" },
    ],
    weekendBlocks: [
      { startTime: "11:00", endTime: "12:00" },
      { startTime: "13:00", endTime: "14:00" },
      { startTime: "14:15", endTime: "15:15" },
    ],
    bands: {
      konu: { min: 15, max: 20 },
      soru: { min: 25, max: 30 },
      tekrar: { min: 25, max: 30 },
      rutin: 15,
      deneme: 0,
    },
  },
  medium: {
    id: "medium",
    label: "Orta",
    emoji: "⚡",
    minQuestions: 500,
    maxQuestions: 1000,
    targetQuestions: 800,
    blockCount: 25,
    weekdayCount: 3,
    weekendCount: 5,
    weekdayBlocks: [
      { startTime: "18:30", endTime: "19:30" },
      { startTime: "19:45", endTime: "20:45" },
      { startTime: "21:00", endTime: "22:00" },
    ],
    weekendBlocks: [
      { startTime: "10:30", endTime: "11:30" },
      { startTime: "11:45", endTime: "12:45" },
      { startTime: "14:00", endTime: "15:00" },
      { startTime: "15:15", endTime: "16:15" },
      { startTime: "16:30", endTime: "17:30" },
    ],
    bands: {
      konu: { min: 20, max: 25 },
      soru: { min: 35, max: 40 },
      tekrar: { min: 35, max: 40 },
      rutin: 25,
      deneme: 0,
    },
  },
  high: {
    id: "high",
    label: "Yoğun",
    emoji: "🚀",
    minQuestions: 1000,
    maxQuestions: Number.POSITIVE_INFINITY,
    targetQuestions: 1300,
    blockCount: 32,
    weekdayCount: 4,
    weekendCount: 6,
    weekdayBlocks: [
      { startTime: "18:00", endTime: "19:00" },
      { startTime: "19:15", endTime: "20:15" },
      { startTime: "20:30", endTime: "21:30" },
      { startTime: "21:45", endTime: "23:00" },
    ],
    weekendBlocks: [
      { startTime: "10:00", endTime: "11:15" },
      { startTime: "11:30", endTime: "12:45" },
      { startTime: "14:00", endTime: "15:15" },
      { startTime: "15:30", endTime: "16:45" },
      { startTime: "19:00", endTime: "20:30" },
      { startTime: "20:45", endTime: "22:30" },
    ],
    bands: {
      konu: { min: 25, max: 30 },
      soru: { min: 45, max: 55 },
      tekrar: { min: 45, max: 55 },
      rutin: 38,
      deneme: 0,
    },
  },
};

export const INTENSITY_UI: Record<
  IntensityTier,
  { title: string; subtitle: string; active: string; idle: string }
> = {
  low: {
    title: "🌱 Düşük",
    subtitle: "250-500 Soru • 16 Etüt",
    active:
      "border-sky-500 bg-sky-50 ring-2 ring-sky-200 dark:border-cyan-500 dark:bg-cyan-950/40 dark:ring-cyan-500/30",
    idle: "border-gray-200 bg-white hover:border-sky-300 hover:bg-sky-50/60",
  },
  medium: {
    title: "⚡ Orta",
    subtitle: "500-1000 Soru • 25 Etüt",
    active:
      "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:ring-emerald-500/30",
    idle:
      "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/60",
  },
  high: {
    title: "🚀 Yoğun",
    subtitle: "1000+ Soru • 32 Etüt",
    active:
      "border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:border-violet-500/60 dark:bg-violet-950/40 dark:ring-violet-500/30",
    idle:
      "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/60",
  },
};

export const FOCUS_UI: Record<
  FocusMode,
  { label: string; icon: string; description: string }
> = {
  topic_heavy: {
    label: "Konu Ağırlıklı",
    icon: "📖",
    description: "Etütlerin %60'ı konu anlatımı ve kavrama testi",
  },
  balanced: {
    label: "Dengeli",
    icon: "⚖️",
    description: "Konu ve soru çözümü dengeli dağılır",
  },
  question_heavy: {
    label: "Soru Kampı",
    icon: "🎯",
    description: "Etütlerin %75'i soru çözümü ve branş denemesi",
  },
};

export const PLAN_LOAD_STATUS_UI: Record<
  PlanLoadStatus,
  { label: string; className: string }
> = {
  below: {
    label: "Hedef altında",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  },
  low: {
    label: "🌱 Düşük Seviye",
    className:
      "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-sm shadow-sky-500/20",
  },
  medium: {
    label: "⚡ Orta Seviye",
    className:
      "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/20",
  },
  high: {
    label: "🚀 Yoğun Seviye",
    className:
      "bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white shadow-sm shadow-violet-500/25",
  },
};

export function intensityRank(tier: IntensityTier): number {
  return INTENSITY_ORDER.indexOf(tier);
}

export function workloadToIntensity(
  avgWeeklyQuestions: number,
): IntensityTier {
  if (avgWeeklyQuestions < 450) return "low";
  if (avgWeeklyQuestions <= 950) return "medium";
  return "high";
}

export function profileTimeRange(tier: IntensityTier): {
  weekdayStart: string;
  weekdayEnd: string;
  weekendStart: string;
  weekendEnd: string;
} {
  const profile = INTENSITY_PROFILES[tier];
  return {
    weekdayStart: profile.weekdayBlocks[0].startTime,
    weekdayEnd: profile.weekdayBlocks[profile.weekdayBlocks.length - 1].endTime,
    weekendStart: profile.weekendBlocks[0].startTime,
    weekendEnd:
      profile.weekendBlocks[profile.weekendBlocks.length - 1].endTime,
  };
}

export function pickQuestionCount(
  tier: IntensityTier,
  taskType: StudyPlanTaskType,
  highPriority = false,
): number {
  const bands = INTENSITY_PROFILES[tier].bands;
  if (taskType === "rutin") return bands.rutin;
  if (taskType === "deneme") return bands.deneme;
  const band = bands[taskType];
  if (highPriority) return band.max;
  return Math.round((band.min + band.max) / 2);
}

export function topicShareForFocus(focusMode: FocusMode): number | null {
  if (focusMode === "topic_heavy") return 0.6;
  if (focusMode === "question_heavy") return 0.25;
  return null;
}

export function buildCategoryPlan(
  total: number,
  topicShare: number | null,
): Array<"topic" | "question"> {
  if (total <= 0) return [];
  if (topicShare === null) return new Array(total).fill("question");
  const topicTarget = Math.max(
    0,
    Math.min(total, Math.round(total * topicShare)),
  );
  const topicIndices = new Set<number>();
  for (let i = 0; i < topicTarget; i += 1) {
    topicIndices.add(
      Math.min(total - 1, Math.floor(((i + 0.5) * total) / topicTarget)),
    );
  }
  return Array.from({ length: total }, (_, index) =>
    topicIndices.has(index) ? "topic" : "question",
  );
}

export function computePlanLoad(slots: StudyPlanSlot[]): {
  blockCount: number;
  hours: number;
  totalQuestions: number;
  status: PlanLoadStatus;
} {
  let minutes = 0;
  let totalQuestions = 0;
  for (const slot of slots) {
    minutes += Math.max(
      0,
      timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime),
    );
    totalQuestions += Math.max(0, slot.questionCount);
  }
  return {
    blockCount: slots.length,
    hours: Math.round((minutes / 60) * 10) / 10,
    totalQuestions,
    status:
      totalQuestions < 250
        ? "below"
        : totalQuestions < 500
          ? "low"
          : totalQuestions < 1000
            ? "medium"
            : "high",
  };
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
