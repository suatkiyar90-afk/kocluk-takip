import { describe, expect, it, vi } from "vitest";
import {
  checkPolicyFailOpen,
  documentKeyForRole,
  needsPolicyAcknowledgment,
} from "./policy";

describe("documentKeyForRole", () => {
  it("öğrenci ve öğretmen rollerini belge anahtarına çevirir", () => {
    expect(documentKeyForRole("student")).toBe("kvkk_student");
    expect(documentKeyForRole("teacher")).toBe("kvkk_teacher");
  });

  it("admin ve bilinmeyen roller için null döner", () => {
    expect(documentKeyForRole("admin")).toBeNull();
    expect(documentKeyForRole(null)).toBeNull();
    expect(documentKeyForRole(undefined)).toBeNull();
    expect(documentKeyForRole("other")).toBeNull();
  });
});

describe("needsPolicyAcknowledgment", () => {
  const version = "2026-10-05";

  it("hiç onay yoksa gereklidir", () => {
    expect(
      needsPolicyAcknowledgment({
        role: "student",
        version,
        acknowledgedVersions: [],
      }),
    ).toBe(true);
  });

  it("eski sürüm onayı varsa gereklidir", () => {
    expect(
      needsPolicyAcknowledgment({
        role: "teacher",
        version,
        acknowledgedVersions: ["2026-01-01"],
      }),
    ).toBe(true);
  });

  it("güncel sürüm onaylıysa gereklidir değildir", () => {
    expect(
      needsPolicyAcknowledgment({
        role: "student",
        version,
        acknowledgedVersions: [version],
      }),
    ).toBe(false);
  });

  it("onay gerektirmeyen roller için hep false döner", () => {
    expect(
      needsPolicyAcknowledgment({
        role: "admin",
        version,
        acknowledgedVersions: [],
      }),
    ).toBe(false);
    expect(
      needsPolicyAcknowledgment({
        role: null,
        version,
        acknowledgedVersions: [],
      }),
    ).toBe(false);
  });
});

describe("checkPolicyFailOpen", () => {
  const version = "2026-10-05";

  it("admin için sorgu yapmadan exempt döner", async () => {
    const load = vi.fn();
    const result = await checkPolicyFailOpen({
      role: "admin",
      version,
      loadAcknowledgedVersions: load,
    });
    expect(result).toEqual({ status: "exempt" });
    expect(load).not.toHaveBeenCalled();
  });

  it("onay yoksa required döner", async () => {
    const result = await checkPolicyFailOpen({
      role: "student",
      version,
      loadAcknowledgedVersions: async () => [],
    });
    expect(result).toEqual({ status: "required" });
  });

  it("onaylıysa ok döner", async () => {
    const result = await checkPolicyFailOpen({
      role: "teacher",
      version,
      loadAcknowledgedVersions: async () => [version],
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("veritabanı hatasında fail-open ile exempt döner", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await checkPolicyFailOpen({
        role: "student",
        version,
        loadAcknowledgedVersions: async () => {
          throw new Error("db down");
        },
      });
      expect(result).toEqual({ status: "exempt" });
    } finally {
      errorSpy.mockRestore();
    }
  });
});
