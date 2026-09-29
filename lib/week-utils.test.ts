import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  getCurrentWeekMonday,
  isValidISODate,
  mondayOfISO,
  parseMonday,
  todayInIstanbul,
  weekdayOfISO,
} from "./week-utils";

describe("todayInIstanbul", () => {
  it("UTC 21:00 öncesi anları Türkiye gününe göre döndürür", () => {
    expect(todayInIstanbul(new Date("2026-09-29T20:59:00Z"))).toBe(
      "2026-09-29",
    );
    expect(todayInIstanbul(new Date("2026-09-29T21:00:00Z"))).toBe(
      "2026-09-30",
    );
  });

  it("gece yarısı sınırında UTC günü ile Türkiye günü farklıdır", () => {
    expect(todayInIstanbul(new Date("2026-09-29T21:01:00Z"))).toBe(
      "2026-09-30",
    );
    expect(new Date("2026-09-29T21:01:00Z").toISOString().slice(0, 10)).toBe(
      "2026-09-29",
    );
  });

  it("UTC gece yarısında günü korur", () => {
    expect(todayInIstanbul(new Date("2026-09-30T00:00:00Z"))).toBe(
      "2026-09-30",
    );
    expect(todayInIstanbul(new Date("2026-09-29T00:00:00Z"))).toBe(
      "2026-09-29",
    );
  });
});

describe("getCurrentWeekMonday", () => {
  it("Pazar gününü önceki Pazartesi'ye götürür", () => {
    expect(getCurrentWeekMonday(new Date("2026-10-04T12:00:00Z"))).toBe(
      "2026-09-28",
    );
  });

  it("Pazartesi gününü aynı gün döndürür", () => {
    expect(getCurrentWeekMonday(new Date("2026-10-05T12:00:00Z"))).toBe(
      "2026-10-05",
    );
  });

  it("Pazartesi sabahı Türkiye saatinde doğru haftayı seçer", () => {
    expect(getCurrentWeekMonday(new Date("2026-10-04T22:30:00Z"))).toBe(
      "2026-10-05",
    );
  });

  it("Pazar sabahı Türkiye saatinde önceki haftayı seçer", () => {
    expect(getCurrentWeekMonday(new Date("2026-10-03T22:30:00Z"))).toBe(
      "2026-09-28",
    );
  });
});

describe("ay ve yıl geçişleri", () => {
  it("ay geçişinde Pazartesi'yi bulur", () => {
    expect(mondayOfISO("2026-08-31")).toBe("2026-08-31");
    expect(mondayOfISO("2026-09-01")).toBe("2026-08-31");
  });

  it("yıl geçişinde önceki yılın Pazartesi'sine düşer", () => {
    expect(mondayOfISO("2026-12-31")).toBe("2026-12-28");
    expect(mondayOfISO("2027-01-01")).toBe("2026-12-28");
  });

  it("addDaysISO ay ve yıl sınırlarını aşar", () => {
    expect(addDaysISO("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("weekdayOfISO", () => {
  it("Pazartesi 1, Pazar 0 döndürür", () => {
    expect(weekdayOfISO("2026-09-28")).toBe(1);
    expect(weekdayOfISO("2026-10-04")).toBe(0);
    expect(weekdayOfISO("2026-10-03")).toBe(6);
  });
});

describe("parseMonday", () => {
  it("geçerli tarihi Pazartesi'ye yuvarlar", () => {
    expect(parseMonday("2026-09-30")).toBe("2026-09-28");
    expect(parseMonday("2026-08-31")).toBe("2026-08-31");
  });

  it("geçersiz veya boş girdide güncel haftanın Pazartesi'sini verir", () => {
    expect(parseMonday("geçersiz")).toBe(getCurrentWeekMonday());
    expect(parseMonday("2026-02-30")).toBe(getCurrentWeekMonday());
    expect(parseMonday()).toBe(getCurrentWeekMonday());
  });
});

describe("isValidISODate", () => {
  it("geçerli ve geçersiz tarihleri ayırt eder", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2024-02-29")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026-9-1")).toBe(false);
    expect(isValidISODate("")).toBe(false);
  });
});
