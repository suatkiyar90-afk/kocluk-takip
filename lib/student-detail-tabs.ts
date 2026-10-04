export const STUDENT_DETAIL_TAB_IDS = [
  "report",
  "targets",
  "exams",
  "curriculum",
  "qa",
  "reports",
] as const;

export type StudentDetailTabId = (typeof STUDENT_DETAIL_TAB_IDS)[number];

export const DEFAULT_STUDENT_DETAIL_TAB: StudentDetailTabId = "report";

export function isStudentDetailTabId(
  value: string,
): value is StudentDetailTabId {
  return (STUDENT_DETAIL_TAB_IDS as readonly string[]).includes(value);
}

export function normalizeStudentDetailTab(
  value?: string | null,
): StudentDetailTabId {
  if (value === "stats") {
    return "reports";
  }
  if (value != null && isStudentDetailTabId(value)) {
    return value;
  }
  return DEFAULT_STUDENT_DETAIL_TAB;
}
