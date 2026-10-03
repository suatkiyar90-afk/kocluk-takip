import { afterEach, describe, expect, it } from "vitest";
import {
  assertEntryWindowOpen,
  ENTRY_WINDOW_MESSAGE,
  EntryWindowError,
  getEntryWindow,
} from "./entry-window";

function at(iso: string): Date {
  return new Date(iso);
}

describe("yerel test kipi: NEXT_PUBLIC_ENTRY_WINDOW_FORCE_OPEN", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ENTRY_WINDOW_FORCE_OPEN;
  });

  it("true iken her saatte state open ve assert geçer", () => {
    process.env.NEXT_PUBLIC_ENTRY_WINDOW_FORCE_OPEN = "true";
    const noon = at("2026-10-03T12:00:00+03:00");
    const w = getEntryWindow(noon);
    expect(w.state).toBe("open");
    expect(w.today).toBe("2026-10-03");
    expect(w.msUntilOpen).toBe(0);
    expect(w.msUntilClose).toBe(3600000);
    expect(() => assertEntryWindowOpen(noon)).not.toThrow();
  });

  it("true iken gece yarısında bile open", () => {
    process.env.NEXT_PUBLIC_ENTRY_WINDOW_FORCE_OPEN = "true";
    expect(getEntryWindow(at("2026-10-03T23:30:00+03:00")).state).toBe(
      "open",
    );
    expect(getEntryWindow(at("2026-10-03T05:00:00+03:00")).state).toBe(
      "open",
    );
  });

  it("tanımlı değilse normal 22-23 davranışı sürer", () => {
    expect(process.env.NEXT_PUBLIC_ENTRY_WINDOW_FORCE_OPEN).toBeUndefined();
    expect(getEntryWindow(at("2026-10-03T12:00:00+03:00")).state).toBe(
      "before",
    );
    expect(() =>
      assertEntryWindowOpen(at("2026-10-03T12:00:00+03:00")),
    ).toThrow(EntryWindowError);
  });
});

describe("getEntryWindow", () => {
  it("21:59:59 durumu before", () => {
    const w = getEntryWindow(at("2026-10-02T21:59:59+03:00"));
    expect(w.state).toBe("before");
    expect(w.today).toBe("2026-10-02");
  });

  it("22:00:00 tam sınırda open", () => {
    const now = at("2026-10-02T22:00:00+03:00");
    const w = getEntryWindow(now);
    expect(w.state).toBe("open");
    expect(w.today).toBe("2026-10-02");
    expect(w.opensAt.getTime()).toBe(now.getTime());
    expect(w.msUntilOpen).toBe(0);
  });

  it("22:59:59.999 hala open", () => {
    const w = getEntryWindow(at("2026-10-02T22:59:59.999+03:00"));
    expect(w.state).toBe("open");
    expect(w.today).toBe("2026-10-02");
  });

  it("23:00:00 tam sınırda after (tolerans yok)", () => {
    const now = at("2026-10-02T23:00:00+03:00");
    const w = getEntryWindow(now);
    expect(w.state).toBe("after");
    expect(w.closesAt.getTime()).toBe(now.getTime());
    expect(w.msUntilClose).toBe(0);
  });

  it("gece yarısı geçişinde today yeni güne döner", () => {
    const beforeMidnight = getEntryWindow(at("2026-10-02T23:59:00+03:00"));
    expect(beforeMidnight.state).toBe("after");
    expect(beforeMidnight.today).toBe("2026-10-02");

    const afterMidnight = getEntryWindow(at("2026-10-03T00:00:00+03:00"));
    expect(afterMidnight.state).toBe("before");
    expect(afterMidnight.today).toBe("2026-10-03");
    expect(afterMidnight.opensAt.getTime()).toBe(
      at("2026-10-03T22:00:00+03:00").getTime(),
    );
  });

  it("UTC günü ile İstanbul günü farklıyken today İstanbul günü olur", () => {
    // 21:30 UTC = ertesi gün 00:30 İstanbul (UTC+3)
    const w = getEntryWindow(at("2026-10-02T21:30:00Z"));
    expect(w.today).toBe("2026-10-03");
    expect(w.state).toBe("before");
  });

  it("ay geçişinde doğru today ve state", () => {
    const monthEnd = getEntryWindow(at("2026-09-30T22:15:00+03:00"));
    expect(monthEnd.state).toBe("open");
    expect(monthEnd.today).toBe("2026-09-30");

    const monthStart = getEntryWindow(at("2026-10-01T00:10:00+03:00"));
    expect(monthStart.state).toBe("before");
    expect(monthStart.today).toBe("2026-10-01");
    expect(monthStart.opensAt.getTime()).toBe(
      at("2026-10-01T22:00:00+03:00").getTime(),
    );
  });

  it("yıl geçişinde doğru today ve state", () => {
    const yearEnd = getEntryWindow(at("2025-12-31T22:30:00+03:00"));
    expect(yearEnd.state).toBe("open");
    expect(yearEnd.today).toBe("2025-12-31");

    const yearStart = getEntryWindow(at("2026-01-01T00:15:00+03:00"));
    expect(yearStart.state).toBe("before");
    expect(yearStart.today).toBe("2026-01-01");
    expect(yearStart.opensAt.getTime()).toBe(
      at("2026-01-01T22:00:00+03:00").getTime(),
    );
  });

  it("msUntilOpen ve msUntilClose doğru hesaplanır", () => {
    const now = at("2026-10-02T21:00:00+03:00");
    const w = getEntryWindow(now);
    expect(w.msUntilOpen).toBe(60 * 60 * 1000);
    expect(w.msUntilClose).toBe(2 * 60 * 60 * 1000);
  });
});

describe("assertEntryWindowOpen", () => {
  it("pencere açıkken fırlatmaz", () => {
    expect(() =>
      assertEntryWindowOpen(at("2026-10-02T22:30:00+03:00")),
    ).not.toThrow();
  });

  it("pencere kapalıyken Türkçe mesajla fırlatır", () => {
    for (const iso of [
      "2026-10-02T21:59:59+03:00",
      "2026-10-02T23:00:00+03:00",
    ]) {
      let caught: unknown = null;
      try {
        assertEntryWindowOpen(at(iso));
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(EntryWindowError);
      expect((caught as Error).message).toBe(ENTRY_WINDOW_MESSAGE);
    }
  });
});
