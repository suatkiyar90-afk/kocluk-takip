import { describe, expect, it } from "vitest";
import {
  createAnnouncementSchema,
  getVisibleAnnouncements,
  shouldRegisterDismissal,
  shouldShowAnnouncements,
  type AnnouncementInput,
} from "./announcements";

function announcement(
  overrides: Partial<AnnouncementInput> = {},
): AnnouncementInput {
  return {
    id: "a1",
    title: "Başlık",
    body: "Mesaj",
    kind: "info",
    audienceStudent: true,
    audienceTeacher: true,
    createdAt: "2026-10-01T10:00:00.000Z",
    expiresAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("getVisibleAnnouncements", () => {
  const now = "2026-10-03T12:00:00.000Z";
  const user = { role: "student", createdAt: "2026-09-01T00:00:00.000Z" };

  it("rol uyumsuzluğunda duyuruyu göstermez", () => {
    const visible = getVisibleAnnouncements({
      user,
      announcements: [announcement({ audienceStudent: false, audienceTeacher: true })],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(0);
  });

  it("süresi dolmuş duyuruyu göstermez", () => {
    const visible = getVisibleAnnouncements({
      user,
      announcements: [announcement({ expiresAt: "2026-10-02T12:00:00.000Z" })],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(0);
  });

  it("arşivlenmiş duyuruyu göstermez", () => {
    const visible = getVisibleAnnouncements({
      user,
      announcements: [announcement({ archivedAt: "2026-10-02T12:00:00.000Z" })],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(0);
  });

  it("kullanıcının kapattığı duyuruyu göstermez", () => {
    const visible = getVisibleAnnouncements({
      user,
      announcements: [announcement()],
      dismissedIds: ["a1"],
      now,
    });
    expect(visible).toHaveLength(0);
  });

  it("hesap, duyurudan sonra açıldıysa göstermez", () => {
    const visible = getVisibleAnnouncements({
      user: { role: "student", createdAt: "2026-10-02T00:00:00.000Z" },
      announcements: [announcement({ createdAt: "2026-10-01T10:00:00.000Z" })],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(0);
  });

  it("duyuru, hesap oluşturma tarihinde veya sonrasında yayınlanmışsa gösterir", () => {
    const visible = getVisibleAnnouncements({
      user: { role: "student", createdAt: "2026-10-01T10:00:00.000Z" },
      announcements: [
        announcement({ id: "edge", createdAt: "2026-10-01T10:00:00.000Z" }),
      ],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(1);
  });

  it("admin hiçbir duyuru görmez", () => {
    const visible = getVisibleAnnouncements({
      user: { role: "admin", createdAt: "2020-01-01T00:00:00.000Z" },
      announcements: [announcement()],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(0);
  });

  it("öğretmen rolünde yalnızca teacher hedefli duyuruyu görür", () => {
    const visible = getVisibleAnnouncements({
      user: { role: "teacher", createdAt: "2026-09-01T00:00:00.000Z" },
      announcements: [
        announcement({ id: "s", audienceTeacher: false }),
        announcement({ id: "t", audienceStudent: false }),
      ],
      dismissedIds: [],
      now,
    });
    expect(visible.map((item) => item.id)).toEqual(["t"]);
  });

  it("3'ten fazla bekleyen duyuruda en fazla 3 ve en eskiden yeniye döner", () => {
    const visible = getVisibleAnnouncements({
      user,
      announcements: [
        announcement({ id: "d", createdAt: "2026-10-03T09:00:00.000Z" }),
        announcement({ id: "b", createdAt: "2026-10-01T09:00:00.000Z" }),
        announcement({ id: "e", createdAt: "2026-10-03T10:00:00.000Z" }),
        announcement({ id: "c", createdAt: "2026-10-02T09:00:00.000Z" }),
        announcement({ id: "a", createdAt: "2026-10-01T08:00:00.000Z" }),
      ],
      dismissedIds: [],
      now,
    });
    expect(visible.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("belirli kullanıcılara hedeflenen duyuruyu yalnızca hedeflenen kullanıcı görür", () => {
    const targeted = announcement({ targetUserIds: ["u-target"] });
    const visible = getVisibleAnnouncements({
      user: {
        id: "u-target",
        role: "student",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      announcements: [targeted],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(1);

    const notVisible = getVisibleAnnouncements({
      user: {
        id: "u-other",
        role: "student",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      announcements: [targeted],
      dismissedIds: [],
      now,
    });
    expect(notVisible).toHaveLength(0);
  });

  it("hedeflenen duyuruda rol uyuşması aranmaz (öğretmen hedefine öğrenci)", () => {
    const visible = getVisibleAnnouncements({
      user: {
        id: "u-t2",
        role: "student",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      announcements: [
        announcement({
          audienceStudent: false,
          audienceTeacher: true,
          targetUserIds: ["u-t2"],
        }),
      ],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(1);
  });

  it("hedef listesi boşsa rol bazlı davranır", () => {
    const visible = getVisibleAnnouncements({
      user: {
        id: "u1",
        role: "student",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      announcements: [
        announcement({ id: "role-only", targetUserIds: [] }),
        announcement({ id: "teacher-only", audienceStudent: false, audienceTeacher: true, targetUserIds: [] }),
      ],
      dismissedIds: [],
      now,
    });
    expect(visible.map((item) => item.id)).toEqual(["role-only"]);
  });

  it("kullanıcı kimliği yoksa hedefli duyuruyu göstermez", () => {
    const visible = getVisibleAnnouncements({
      user: { role: "student", createdAt: "2026-09-01T00:00:00.000Z" },
      announcements: [announcement({ targetUserIds: ["u-target"] })],
      dismissedIds: [],
      now,
    });
    expect(visible).toHaveLength(0);
  });
});

describe("shouldShowAnnouncements", () => {
  it("şifre değiştirme bekliyorsa göstermez", () => {
    expect(shouldShowAnnouncements({ mustChangePassword: true })).toBe(false);
  });

  it("giriş, şifre değiştirme ve offline sayfalarında göstermez", () => {
    expect(shouldShowAnnouncements({ path: "/login" })).toBe(false);
    expect(shouldShowAnnouncements({ path: "/force-change-password" })).toBe(
      false,
    );
    expect(shouldShowAnnouncements({ path: "/offline" })).toBe(false);
    expect(shouldShowAnnouncements({ path: "/offline/" })).toBe(false);
  });

  it("KVKK onay ve aydınlatma sayfalarında göstermez", () => {
    expect(shouldShowAnnouncements({ path: "/kvkk" })).toBe(false);
    expect(shouldShowAnnouncements({ path: "/aydinlatma" })).toBe(false);
    expect(shouldShowAnnouncements({ path: "/aydinlatma/" })).toBe(false);
  });

  it("aydınlatma onayı bekleniyorsa göstermez", () => {
    expect(
      shouldShowAnnouncements({ path: "/panel", policyAcknowledged: false }),
    ).toBe(false);
    expect(
      shouldShowAnnouncements({ path: "/panel", policyAcknowledged: true }),
    ).toBe(true);
    expect(shouldShowAnnouncements({ path: "/panel" })).toBe(true);
  });

  it("normal sayfalarda gösterir", () => {
    expect(shouldShowAnnouncements({ path: "/panel" })).toBe(true);
    expect(
      shouldShowAnnouncements({
        mustChangePassword: false,
        path: "/panel",
      }),
    ).toBe(true);
  });
});

describe("shouldRegisterDismissal", () => {
  it("daha önce kapatılmadıysa kaydedilir", () => {
    expect(
      shouldRegisterDismissal({ announcementId: "a1", dismissedIds: [] }),
    ).toBe(true);
  });

  it("zaten kapatıldıysa tekrar kaydedilmez (idempotent)", () => {
    expect(
      shouldRegisterDismissal({
        announcementId: "a1",
        dismissedIds: ["a1"],
      }),
    ).toBe(false);
    expect(
      shouldRegisterDismissal({
        announcementId: "a1",
        dismissedIds: new Set(["a2", "a1"]),
      }),
    ).toBe(false);
  });
});

describe("createAnnouncementSchema", () => {
  const valid = {
    title: "Deneme sınavı",
    body: "Yarın saat 09.00'da deneme sınavı var.",
    kind: "important" as const,
    audienceStudent: true,
    audienceTeacher: false,
  };

  it("geçerli girdiyi kabul eder ve trim eder", () => {
    const result = createAnnouncementSchema.safeParse({
      ...valid,
      title: "  Deneme sınavı  ",
      body: "  Mesaj  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Deneme sınavı");
      expect(result.data.body).toBe("Mesaj");
    }
  });

  it("başlığı 80 karakterle sınırlar", () => {
    const tooLong = createAnnouncementSchema.safeParse({
      ...valid,
      title: "x".repeat(81),
    });
    expect(tooLong.success).toBe(false);
    const exact = createAnnouncementSchema.safeParse({
      ...valid,
      title: "x".repeat(80),
    });
    expect(exact.success).toBe(true);
  });

  it("mesajı 1000 karakterle sınırlar", () => {
    const tooLong = createAnnouncementSchema.safeParse({
      ...valid,
      body: "x".repeat(1001),
    });
    expect(tooLong.success).toBe(false);
    const exact = createAnnouncementSchema.safeParse({
      ...valid,
      body: "x".repeat(1000),
    });
    expect(exact.success).toBe(true);
  });

  it("en az bir hedef rol ister", () => {
    const none = createAnnouncementSchema.safeParse({
      ...valid,
      audienceStudent: false,
      audienceTeacher: false,
    });
    expect(none.success).toBe(false);
    if (!none.success) {
      expect(none.error.issues[0].message).toBe(
        "En az bir hedef rol seçmelisiniz.",
      );
    }
  });

  it("geçersiz tür ve boş başlığı reddeder", () => {
    expect(
      createAnnouncementSchema.safeParse({ ...valid, kind: "other" }).success,
    ).toBe(false);
    expect(
      createAnnouncementSchema.safeParse({ ...valid, title: "   " }).success,
    ).toBe(false);
  });

  it("geçersiz bitiş tarihini reddeder", () => {
    expect(
      createAnnouncementSchema.safeParse({
        ...valid,
        expiresAt: "not-a-date",
      }).success,
    ).toBe(false);
    expect(
      createAnnouncementSchema.safeParse({ ...valid, expiresAt: null }).success,
    ).toBe(true);
  });

  it("hedef kullanıcı listesi varken rol onayını şart koşmaz", () => {
    const result = createAnnouncementSchema.safeParse({
      ...valid,
      audienceStudent: false,
      audienceTeacher: false,
      targetUserIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(result.success).toBe(true);
  });

  it("hedef kullanıcı listesini benzersizleştirir ve geçerli UUID ister", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    const result = createAnnouncementSchema.safeParse({
      ...valid,
      targetUserIds: [uuid, uuid],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetUserIds).toHaveLength(2);
    }
    expect(
      createAnnouncementSchema.safeParse({
        ...valid,
        targetUserIds: ["not-a-uuid"],
      }).success,
    ).toBe(false);
  });

  it("hedef kullanıcı sayısını 2000 ile sınırlar", () => {
    const tooMany = Array.from(
      { length: 2001 },
      (_, index) =>
        `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    expect(
      createAnnouncementSchema.safeParse({ ...valid, targetUserIds: tooMany })
        .success,
    ).toBe(false);
    expect(
      createAnnouncementSchema.safeParse({
        ...valid,
        targetUserIds: tooMany.slice(0, 2000),
      }).success,
    ).toBe(true);
  });
});
