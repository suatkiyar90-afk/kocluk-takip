import { describe, expect, it } from "vitest";
import { groupConsecutiveActivities, type GroupableActivity } from "./activity-group";

function row(overrides: Partial<GroupableActivity> & { id: number }): GroupableActivity {
  return {
    actorId: "teacher-1",
    action: "target_saved",
    studentId: "student-1",
    createdAt: "2026-10-02T09:00:00.000Z",
    ...overrides,
  };
}

describe("groupConsecutiveActivities", () => {
  it("tek kayıt tek grup döner", () => {
    const result = groupConsecutiveActivities([row({ id: 1 })]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
    expect(result[0].items).toHaveLength(1);
  });

  it("aynı öğretmen+işlem+öğrenci, 10 dakika içindeki 3 ardışık kaydı tek gruba gruplar", () => {
    const rows = [
      row({ id: 1, createdAt: "2026-10-02T09:00:00.000Z" }),
      row({ id: 2, createdAt: "2026-10-02T09:04:00.000Z" }),
      row({ id: 3, createdAt: "2026-10-02T09:08:00.000Z" }),
    ];
    const result = groupConsecutiveActivities(rows);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].items.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("10 dakikayı aşan boşluk yeni grup başlatır", () => {
    const rows = [
      row({ id: 1, createdAt: "2026-10-02T09:00:00.000Z" }),
      row({ id: 2, createdAt: "2026-10-02T09:11:00.000Z" }),
    ];
    const result = groupConsecutiveActivities(rows);
    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
  });

  it("farklı öğrenci aynı gruba girmez", () => {
    const rows = [
      row({ id: 1, studentId: "student-1", createdAt: "2026-10-02T09:00:00.000Z" }),
      row({ id: 2, studentId: "student-2", createdAt: "2026-10-02T09:01:00.000Z" }),
    ];
    const result = groupConsecutiveActivities(rows);
    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
  });
});
