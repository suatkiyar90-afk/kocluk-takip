import { describe, expect, it } from "vitest";
import {
  buildEntryWindowMessage,
  buildGradeBadgeLabel,
  buildStreakToastMessage,
  DEFAULT_GRADE_SETTINGS,
  formatHour,
  formatHourRange,
  isWithinEntryWindow,
  normalizeGradeLevel,
  resolveGradeSettings,
} from "./grade-config";

describe("normalizeGradeLevel", () => {
  it("11 ve 12 degerlerini korur", () => {
    expect(normalizeGradeLevel(11)).toBe(11);
    expect(normalizeGradeLevel(12)).toBe(12);
    expect(normalizeGradeLevel("11")).toBe(11);
  });

  it("gecersiz degerlerde 12. sinifa duser", () => {
    expect(normalizeGradeLevel(undefined)).toBe(12);
    expect(normalizeGradeLevel(null)).toBe(12);
    expect(normalizeGradeLevel(9)).toBe(12);
    expect(normalizeGradeLevel("abc")).toBe(12);
  });
});

describe("saat bicimlendirme", () => {
  it("24 saatini gece yarisina cevirir", () => {
    expect(formatHour(24)).toBe("00:00");
    expect(formatHour(0)).toBe("00:00");
    expect(formatHour(20)).toBe("20:00");
  });

  it("aralik metni uretir", () => {
    expect(formatHourRange(22, 24)).toBe("22:00 - 00:00");
    expect(formatHourRange(20, 22)).toBe("20:00 - 22:00");
  });
});

describe("resolveGradeSettings", () => {
  it("kayit yoksa varsayilanlari dondurur", () => {
    expect(resolveGradeSettings(11)).toEqual(DEFAULT_GRADE_SETTINGS[11]);
    expect(resolveGradeSettings(12, null)).toEqual(DEFAULT_GRADE_SETTINGS[12]);
  });

  it("kayitli degerleri korur, eksik alanlari tamamlar", () => {
    const resolved = resolveGradeSettings(11, {
      entryStartHour: 19,
      enforceTimeWindow: true,
    });
    expect(resolved).toEqual({
      gradeLevel: 11,
      entryStartHour: 19,
      entryEndHour: 22,
      enforceTimeWindow: true,
    });
  });
});

describe("isWithinEntryWindow", () => {
  it("12. sinif 22-24 araligini kapsar", () => {
    const settings = DEFAULT_GRADE_SETTINGS[12];
    expect(isWithinEntryWindow(21, settings)).toBe(false);
    expect(isWithinEntryWindow(22, settings)).toBe(true);
    expect(isWithinEntryWindow(23, settings)).toBe(true);
    expect(isWithinEntryWindow(0, settings)).toBe(false);
  });

  it("11. sinif 20-22 araligini kapsar", () => {
    const settings = DEFAULT_GRADE_SETTINGS[11];
    expect(isWithinEntryWindow(19, settings)).toBe(false);
    expect(isWithinEntryWindow(20, settings)).toBe(true);
    expect(isWithinEntryWindow(21, settings)).toBe(true);
    expect(isWithinEntryWindow(22, settings)).toBe(false);
  });

  it("gece yarisini asan araliklari destekler", () => {
    const settings = { entryStartHour: 23, entryEndHour: 1 };
    expect(isWithinEntryWindow(23, settings)).toBe(true);
    expect(isWithinEntryWindow(0, settings)).toBe(true);
    expect(isWithinEntryWindow(2, settings)).toBe(false);
  });
});

describe("metin uretimi", () => {
  it("giris saati ve seri mesajlarini gruba gore uretir", () => {
    expect(buildEntryWindowMessage(DEFAULT_GRADE_SETTINGS[11])).toBe(
      "Grubunuzun veri giriş saati 20:00 - 22:00 arasındadır.",
    );
    expect(buildStreakToastMessage(DEFAULT_GRADE_SETTINGS[11])).toBe(
      "Serin devam ediyor! Yarın 20:00 - 22:00 arasında yine görüşmek üzere 👋",
    );
    expect(buildGradeBadgeLabel(DEFAULT_GRADE_SETTINGS[12])).toBe(
      "12. Sınıf Grubu • Veri Giriş Saati: 22:00 - 00:00",
    );
  });
});
