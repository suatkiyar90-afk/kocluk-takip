import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  rows: [] as { slots: unknown[] }[],
  executeCount: 0,
}));
const authState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(dbState.rows),
  };
  return {
    db: {
      select: () => ({ from: () => chain }),
      execute: () => {
        dbState.executeCount += 1;
        return Promise.resolve([]);
      },
    },
  };
});

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(authState.session),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(async () => undefined),
}));

vi.mock("@/lib/web-push-helper", () => ({
  sendPushNotification: vi.fn(async () => undefined),
}));

import { toggleStudyPlanSlotCompletion } from "./study-plan-actions";
import type { StudyPlanSlot } from "@/db/schema";

const slot: StudyPlanSlot = {
  id: "slot-0-1",
  dayIndex: 0,
  startTime: "18:00",
  endTime: "19:00",
  taskType: "soru",
  examType: "TYT",
  subjectId: "matematik",
  subjectName: "Matematik",
  topicId: null,
  topicName: null,
  questionCount: 40,
  note: "",
};

describe("toggleStudyPlanSlotCompletion", () => {
  beforeEach(() => {
    dbState.rows = [{ slots: [slot] }];
    dbState.executeCount = 0;
    authState.session = {
      user: {
        id: "11111111-2222-3333-4444-555555555555",
        role: "student",
      },
    };
  });

  it("etudu tamamlandi olarak isaretler ve sadece plan tablosunu gunceller", async () => {
    const result = await toggleStudyPlanSlotCompletion({
      weekStart: "2026-10-19",
      slotId: slot.id,
      completed: true,
    });

    expect(result).toEqual({
      success: true,
      data: { completedCount: 1, totalCount: 1 },
    });
    expect(dbState.executeCount).toBe(1);
  });

  it("tiki geri alir", async () => {
    dbState.rows = [
      {
        slots: [
          { ...slot, isCompleted: true, completedAt: "2026-10-20T12:00:00Z" },
        ],
      },
    ];

    const result = await toggleStudyPlanSlotCompletion({
      weekStart: "2026-10-19",
      slotId: slot.id,
      completed: false,
    });

    expect(result).toEqual({
      success: true,
      data: { completedCount: 0, totalCount: 1 },
    });
    expect(dbState.executeCount).toBe(1);
  });

  it("baska plana ait etut kimligini reddeder", async () => {
    const result = await toggleStudyPlanSlotCompletion({
      weekStart: "2026-10-19",
      slotId: "baska-slot",
      completed: true,
    });

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("VALIDATION_FAILED");
    }
    expect(dbState.executeCount).toBe(0);
  });

  it("ogrenci oturumu olmadan reddeder", async () => {
    authState.session = null;

    const result = await toggleStudyPlanSlotCompletion({
      weekStart: "2026-10-19",
      slotId: slot.id,
      completed: true,
    });

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.status).toBe("UNAUTHORIZED");
    }
    expect(dbState.executeCount).toBe(0);
  });
});
