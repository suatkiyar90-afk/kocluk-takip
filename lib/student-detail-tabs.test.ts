import { describe, expect, it } from "vitest";
import { formatBadgeCount } from "@/components/ui/bottom-tab-bar";
import {
  DEFAULT_STUDENT_DETAIL_TAB,
  normalizeStudentDetailTab,
} from "@/lib/student-detail-tabs";

describe("normalizeStudentDetailTab", () => {
  it("boş değeri varsayılana çevirir", () => {
    expect(normalizeStudentDetailTab(undefined)).toBe(DEFAULT_STUDENT_DETAIL_TAB);
    expect(normalizeStudentDetailTab(null)).toBe(DEFAULT_STUDENT_DETAIL_TAB);
    expect(normalizeStudentDetailTab("")).toBe(DEFAULT_STUDENT_DETAIL_TAB);
  });

  it("eski stats sekmesini reports'a yönlendirir", () => {
    expect(normalizeStudentDetailTab("stats")).toBe("reports");
  });

  it("geçerli kimlikleri aynen döndürür", () => {
    expect(normalizeStudentDetailTab("report")).toBe("report");
    expect(normalizeStudentDetailTab("targets")).toBe("targets");
    expect(normalizeStudentDetailTab("exams")).toBe("exams");
    expect(normalizeStudentDetailTab("curriculum")).toBe("curriculum");
    expect(normalizeStudentDetailTab("qa")).toBe("qa");
    expect(normalizeStudentDetailTab("reports")).toBe("reports");
  });

  it("geçersiz kimliği varsayılana çevirir", () => {
    expect(normalizeStudentDetailTab("unknown")).toBe(DEFAULT_STUDENT_DETAIL_TAB);
    expect(normalizeStudentDetailTab("stats-extra")).toBe(DEFAULT_STUDENT_DETAIL_TAB);
  });

  it("idempotenttir", () => {
    const once = normalizeStudentDetailTab("stats");
    expect(normalizeStudentDetailTab(once)).toBe("reports");
    expect(normalizeStudentDetailTab(normalizeStudentDetailTab(undefined))).toBe(
      DEFAULT_STUDENT_DETAIL_TAB,
    );
  });
});

describe("formatBadgeCount", () => {
  it("sıfır ve negatif için null döndürür", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-5)).toBeNull();
  });

  it("1-99 arası sayıyı aynen yazdırır", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(9)).toBe("9");
    expect(formatBadgeCount(99)).toBe("99");
  });

  it("100 ve üzerini 99+ olarak kırpır", () => {
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(1234)).toBe("99+");
  });
});
