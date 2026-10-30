import { describe, expect, it } from "vitest";
import type { StudyPlanSlot } from "@/db/schema";
import {
  INTENSITY_PROFILES,
  buildCategoryPlan,
  computePlanLoad,
  pickQuestionCount,
  profileTimeRange,
  workloadToIntensity,
} from "./study-plan-intensity";

describe("study plan intensity profiles", () => {
  it("haftalik etut sayilari seviyeye gore dogrudur", () => {
    expect(INTENSITY_PROFILES.low.blockCount).toBe(16);
    expect(INTENSITY_PROFILES.medium.blockCount).toBe(25);
    expect(INTENSITY_PROFILES.high.blockCount).toBe(32);
  });

  it("varsayilan saat araliklari profile uyar", () => {
    expect(profileTimeRange("low")).toEqual({
      weekdayStart: "19:30",
      weekdayEnd: "21:45",
      weekendStart: "11:00",
      weekendEnd: "15:15",
    });
    expect(profileTimeRange("medium").weekdayStart).toBe("18:30");
    expect(profileTimeRange("high").weekendEnd).toBe("22:30");
  });
});

describe("workloadToIntensity", () => {
  it("21 gunluk ortalamayi esik degerlerine gore siniflandirir", () => {
    expect(workloadToIntensity(0)).toBe("low");
    expect(workloadToIntensity(449)).toBe("low");
    expect(workloadToIntensity(450)).toBe("medium");
    expect(workloadToIntensity(950)).toBe("medium");
    expect(workloadToIntensity(951)).toBe("high");
  });
});

describe("pickQuestionCount", () => {
  it("soru sayilari seviye bantlarinin icinde kalir", () => {
    for (const tier of ["low", "medium", "high"] as const) {
      const profile = INTENSITY_PROFILES[tier];
      for (const taskType of ["konu", "soru", "tekrar"] as const) {
        const normal = pickQuestionCount(tier, taskType);
        const priority = pickQuestionCount(tier, taskType, true);
        expect(normal).toBeGreaterThanOrEqual(profile.bands[taskType].min);
        expect(priority).toBeLessThanOrEqual(profile.bands[taskType].max);
      }
      expect(pickQuestionCount(tier, "rutin")).toBe(profile.bands.rutin);
      expect(pickQuestionCount(tier, "deneme")).toBe(0);
    }
  });
});

describe("buildCategoryPlan", () => {
  it("konu agirlikli modda yaklasik yuzde 60 konu uretir", () => {
    const plan = buildCategoryPlan(10, 0.6);
    expect(plan.filter((item) => item === "topic")).toHaveLength(6);
    expect(plan).toHaveLength(10);
  });

  it("soru kampinda etutlerin yuzde 75ini soruya ayirir", () => {
    const plan = buildCategoryPlan(8, 0.25);
    expect(plan.filter((item) => item === "question")).toHaveLength(6);
  });
});

describe("computePlanLoad", () => {
  const slot = (
    startTime: string,
    endTime: string,
    questionCount: number,
  ): StudyPlanSlot => ({
    id: `${startTime}-${endTime}`,
    dayIndex: 0,
    startTime,
    endTime,
    taskType: "soru",
    examType: "TYT",
    subjectId: "matematik",
    subjectName: "Matematik",
    topicId: null,
    topicName: null,
    questionCount,
    note: "",
  });

  it("etut, saat ve soru toplamini hesaplar", () => {
    const load = computePlanLoad([
      slot("18:00", "19:00", 300),
      slot("19:15", "20:45", 750),
    ]);
    expect(load.blockCount).toBe(2);
    expect(load.hours).toBe(2.5);
    expect(load.totalQuestions).toBe(1050);
    expect(load.status).toBe("high");
  });

  it("soru araligina gore durum rozetini belirler", () => {
    expect(computePlanLoad([slot("18:00", "19:00", 249)]).status).toBe(
      "below",
    );
    expect(computePlanLoad([slot("18:00", "19:00", 250)]).status).toBe(
      "low",
    );
    expect(computePlanLoad([slot("18:00", "19:00", 500)]).status).toBe(
      "medium",
    );
    expect(computePlanLoad([slot("18:00", "19:00", 1000)]).status).toBe(
      "high",
    );
  });
});
