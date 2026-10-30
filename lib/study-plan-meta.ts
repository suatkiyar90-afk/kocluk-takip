import type { StudyPlanTaskType } from "@/db/schema";

export const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export const DAY_LONG_LABELS = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];

export const TASK_META: Record<
  StudyPlanTaskType,
  { label: string; icon: string; chip: string; tint: string; border: string }
> = {
  konu: {
    label: "Konu",
    icon: "📖",
    chip: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    tint: "#eff6ff",
    border: "#bfdbfe",
  },
  soru: {
    label: "Soru",
    icon: "✍️",
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    tint: "#ecfdf5",
    border: "#a7f3d0",
  },
  tekrar: {
    label: "Tekrar",
    icon: "🔄",
    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    tint: "#fffbeb",
    border: "#fde68a",
  },
  rutin: {
    label: "Rutin",
    icon: "🎯",
    chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    tint: "#eef2ff",
    border: "#c7d2fe",
  },
  deneme: {
    label: "Deneme",
    icon: "📝",
    chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    tint: "#fff1f2",
    border: "#fecdd3",
  },
};

export function parseMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatWeekRange(mondayIso: string, days = 6): string {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + days,
  );
  const opts = { day: "numeric", month: "long" } as const;
  return `${start.toLocaleDateString("tr-TR", opts)} - ${end.toLocaleDateString(
    "tr-TR",
    opts,
  )}`;
}
