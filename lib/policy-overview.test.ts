import { describe, expect, it } from "vitest";
import {
  buildPolicyAcknowledgmentOverview,
  type PolicyOverviewRowInput,
} from "./policy-overview";

const VERSIONS = {
  studentVersion: "2026-10-05",
  teacherVersion: "2026-10-05",
};

function row(overrides: Partial<PolicyOverviewRowInput> = {}): PolicyOverviewRowInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ayşe Yılmaz",
    role: "student",
    studentNumber: "1042",
    lastSeenAt: null,
    assignedTeacher: null,
    acknowledgedAt: null,
    ...overrides,
  };
}

describe("buildPolicyAcknowledgmentOverview", () => {
  it("boş girdide sıfır özetler ve boş listeler döner, sürümleri korur", () => {
    const result = buildPolicyAcknowledgmentOverview([], VERSIONS);

    expect(result.studentVersion).toBe("2026-10-05");
    expect(result.teacherVersion).toBe("2026-10-05");
    expect(result.students).toEqual({
      total: 0,
      acknowledged: 0,
      notAcknowledged: 0,
    });
    expect(result.teachers).toEqual({
      total: 0,
      acknowledged: 0,
      notAcknowledged: 0,
    });
    expect(result.notAcknowledged).toEqual([]);
    expect(result.acknowledged).toEqual([]);
  });

  it("rol bazında toplam, onaylayan ve onaylamayan sayılarını ayrı ayrı hesaplar", () => {
    const result = buildPolicyAcknowledgmentOverview(
      [
        row({ id: "s1", name: "Ayşe", acknowledgedAt: "2026-10-05T09:00:00Z" }),
        row({ id: "s2", name: "Ali" }),
        row({ id: "s3", name: "Veli" }),
        row({ id: "t1", name: "Zeynep", role: "teacher" }),
        row({
          id: "t2",
          name: "Mehmet",
          role: "teacher",
          acknowledgedAt: "2026-10-05T10:00:00Z",
        }),
      ],
      VERSIONS,
    );

    expect(result.students).toEqual({
      total: 3,
      acknowledged: 1,
      notAcknowledged: 2,
    });
    expect(result.teachers).toEqual({
      total: 2,
      acknowledged: 1,
      notAcknowledged: 1,
    });
  });

  it("admin ve bilinmeyen rolleri savunmacı biçimde yok sayar", () => {
    const result = buildPolicyAcknowledgmentOverview(
      [
        row({ id: "a1", name: "Yönetici", role: "admin" }),
        row({ id: "x1", name: "Bilinmeyen", role: "ops" }),
        row({ id: "s1", name: "Ayşe", acknowledgedAt: "2026-10-05T09:00:00Z" }),
      ],
      VERSIONS,
    );

    expect(result.students.total).toBe(1);
    expect(result.teachers.total).toBe(0);
    expect(result.notAcknowledged).toEqual([]);
    expect(result.acknowledged).toHaveLength(1);
    expect(result.acknowledged[0].id).toBe("s1");
  });

  it("öğretmen satırındaki öğrenci alanlarını rolüne göre boşaltır", () => {
    const result = buildPolicyAcknowledgmentOverview(
      [
        row({
          id: "t1",
          name: "Zeynep",
          role: "teacher",
          studentNumber: "9999",
          assignedTeacher: "Yanlış atama",
          acknowledgedAt: "2026-10-05T11:00:00Z",
        }),
        row({
          id: "s1",
          name: "Ayşe",
          studentNumber: "1042",
          assignedTeacher: "Zeynep",
          lastSeenAt: "2026-10-05T08:00:00Z",
        }),
      ],
      VERSIONS,
    );

    expect(result.acknowledged[0]).toMatchObject({
      role: "teacher",
      studentNumber: null,
      assignedTeacher: null,
    });
    expect(result.notAcknowledged[0]).toMatchObject({
      role: "student",
      studentNumber: "1042",
      assignedTeacher: "Zeynep",
      lastSeenAt: "2026-10-05T08:00:00Z",
    });
  });

  it("boş isimli satırı \"İsimsiz kullanıcı\" olarak etiketler", () => {
    const result = buildPolicyAcknowledgmentOverview(
      [row({ id: "s1", name: "" })],
      VERSIONS,
    );

    expect(result.notAcknowledged[0].name).toBe("İsimsiz kullanıcı");
  });

  it("onaylamayanlar listesini yalnızca onaylamayanları, ada göre sıralı döner", () => {
    const result = buildPolicyAcknowledgmentOverview(
      [
        row({ id: "s3", name: "Can" }),
        row({ id: "s1", name: "Ayşe" }),
        row({ id: "s2", name: "Barış" }),
        row({ id: "t1", name: "Zeynep", role: "teacher" }),
        row({ id: "t2", name: "Mehmet", role: "teacher", acknowledgedAt: "2026-10-05T09:00:00Z" }),
      ],
      VERSIONS,
    );

    expect(result.notAcknowledged.map((p) => p.name)).toEqual([
      "Ayşe",
      "Barış",
      "Can",
      "Zeynep",
    ]);
  });

  it("onaylayanlar listesini onay zamanına göre yeniden eskiye sıralar", () => {
    const result = buildPolicyAcknowledgmentOverview(
      [
        row({ id: "s1", name: "Ayşe", acknowledgedAt: "2026-10-05T09:00:00Z" }),
        row({ id: "s2", name: "Ali", acknowledgedAt: "2026-10-06T09:00:00Z" }),
        row({ id: "s3", name: "Veli", acknowledgedAt: "2026-10-04T09:00:00Z" }),
      ],
      VERSIONS,
    );

    expect(result.acknowledged.map((p) => p.id)).toEqual(["s2", "s1", "s3"]);
    expect(result.notAcknowledged).toEqual([]);
  });
});
