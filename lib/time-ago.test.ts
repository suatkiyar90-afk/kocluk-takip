import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTimeAgo } from "@/lib/time-ago";

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("60 saniyeden yakın zamanlar icin 'az once' dondurur", () => {
    expect(formatTimeAgo(new Date("2026-03-10T11:59:30.000Z"))).toBe(
      "az önce",
    );
  });

  it("dakikalari 'N dakika once' olarak formatlar", () => {
    expect(formatTimeAgo(new Date("2026-03-10T11:57:00.000Z"))).toBe(
      "3 dakika önce",
    );
  });

  it("saatlere 'N saat once' olarak formatlar", () => {
    expect(formatTimeAgo(new Date("2026-03-10T10:00:00.000Z"))).toBe(
      "2 saat önce",
    );
  });

  it("gunlere 'N gun once' olarak formatlar", () => {
    expect(formatTimeAgo(new Date("2026-03-08T12:00:00.000Z"))).toBe(
      "2 gün önce",
    );
  });

  it("ISO string girisini kabul eder", () => {
    expect(formatTimeAgo("2026-03-10T11:40:00.000Z")).toBe("20 dakika önce");
  });

  it("gecmis zamani 'az once' sinirinda tutar (gelecek zaman asiri buyuk fark)", () => {
    expect(formatTimeAgo(new Date("2026-03-11T12:00:00.000Z"))).toBe(
      "az önce",
    );
  });
});
