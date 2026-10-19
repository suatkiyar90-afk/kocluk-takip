export type GradeLevel = 11 | 12;

export const GRADE_LEVELS: readonly GradeLevel[] = [12, 11];

export const DEFAULT_GRADE_LEVEL: GradeLevel = 12;

export interface GradeSettings {
  gradeLevel: GradeLevel;
  entryStartHour: number;
  entryEndHour: number;
  enforceTimeWindow: boolean;
}

export const DEFAULT_GRADE_SETTINGS: Record<GradeLevel, GradeSettings> = {
  12: {
    gradeLevel: 12,
    entryStartHour: 22,
    entryEndHour: 24,
    enforceTimeWindow: false,
  },
  11: {
    gradeLevel: 11,
    entryStartHour: 20,
    entryEndHour: 22,
    enforceTimeWindow: false,
  },
};

export const GRADE_LABELS: Record<GradeLevel, string> = {
  11: "11. Sınıf",
  12: "12. Sınıf",
};

export function normalizeGradeLevel(value: unknown): GradeLevel {
  const numeric =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return numeric === 11 ? 11 : DEFAULT_GRADE_LEVEL;
}

export function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  return `${String(normalized).padStart(2, "0")}:00`;
}

export function formatHourRange(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}

export function resolveGradeSettings(
  gradeLevel: unknown,
  settings?: Partial<GradeSettings> | null,
): GradeSettings {
  const level = normalizeGradeLevel(gradeLevel);
  const base = DEFAULT_GRADE_SETTINGS[level];
  if (!settings) return base;
  return {
    gradeLevel: level,
    entryStartHour:
      typeof settings.entryStartHour === "number" && Number.isFinite(settings.entryStartHour)
        ? settings.entryStartHour
        : base.entryStartHour,
    entryEndHour:
      typeof settings.entryEndHour === "number" && Number.isFinite(settings.entryEndHour)
        ? settings.entryEndHour
        : base.entryEndHour,
    enforceTimeWindow:
      typeof settings.enforceTimeWindow === "boolean"
        ? settings.enforceTimeWindow
        : base.enforceTimeWindow,
  };
}

export function isWithinEntryWindow(
  hour: number,
  settings: Pick<GradeSettings, "entryStartHour" | "entryEndHour">,
): boolean {
  const start = settings.entryStartHour;
  const end = settings.entryEndHour;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function buildEntryWindowMessage(
  settings: Pick<GradeSettings, "entryStartHour" | "entryEndHour">,
): string {
  return `Grubunuzun veri giriş saati ${formatHourRange(
    settings.entryStartHour,
    settings.entryEndHour,
  )} arasındadır.`;
}

export function buildStreakToastMessage(
  settings: Pick<GradeSettings, "entryStartHour" | "entryEndHour">,
): string {
  return `Serin devam ediyor! Yarın ${formatHour(
    settings.entryStartHour,
  )} - ${formatHour(settings.entryEndHour)} arasında yine görüşmek üzere 👋`;
}

export function buildGradeBadgeLabel(
  settings: Pick<GradeSettings, "gradeLevel" | "entryStartHour" | "entryEndHour">,
): string {
  return `${normalizeGradeLevel(settings.gradeLevel)}. Sınıf Grubu • Veri Giriş Saati: ${formatHourRange(
    settings.entryStartHour,
    settings.entryEndHour,
  )}`;
}
