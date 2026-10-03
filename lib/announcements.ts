import { z } from "zod";

export type AnnouncementKind = "info" | "update" | "important";

export const ANNOUNCEMENT_KINDS = ["info", "update", "important"] as const;

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  kind: AnnouncementKind;
  audienceStudent: boolean;
  audienceTeacher: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export interface AnnouncementInput {
  id: string;
  title: string;
  body: string;
  kind: AnnouncementKind;
  audienceStudent: boolean;
  audienceTeacher: boolean;
  createdAt: Date | string;
  expiresAt: Date | string | null;
  archivedAt: Date | string | null;
  targetUserIds?: readonly string[];
}

export const MAX_ANNOUNCEMENT_TITLE = 80;
export const MAX_ANNOUNCEMENT_BODY = 1000;
export const MAX_VISIBLE_ANNOUNCEMENTS = 3;
export const MAX_ANNOUNCEMENT_TARGETS = 2000;

export const createAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Başlık zorunludur.")
      .max(MAX_ANNOUNCEMENT_TITLE, `Başlık en fazla ${MAX_ANNOUNCEMENT_TITLE} karakter olabilir.`),
    body: z
      .string()
      .trim()
      .min(1, "Mesaj zorunludur.")
      .max(MAX_ANNOUNCEMENT_BODY, `Mesaj en fazla ${MAX_ANNOUNCEMENT_BODY} karakter olabilir.`),
    kind: z.enum(ANNOUNCEMENT_KINDS),
    audienceStudent: z.boolean(),
    audienceTeacher: z.boolean(),
    targetUserIds: z
      .array(z.string().uuid("Geçersiz kullanıcı kimliği."))
      .max(MAX_ANNOUNCEMENT_TARGETS, `En fazla ${MAX_ANNOUNCEMENT_TARGETS} hedef seçebilirsiniz.`)
      .optional(),
    expiresAt: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), "Geçersiz bitiş tarihi.")
      .nullable()
      .optional(),
  })
  .refine(
    (value) =>
      (value.targetUserIds?.length ?? 0) > 0 ||
      value.audienceStudent ||
      value.audienceTeacher,
    {
      message: "En az bir hedef rol seçmelisiniz.",
    },
  );

export type CreateAnnouncementInput = z.input<typeof createAnnouncementSchema>;

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function toDismissedSet(
  dismissedIds: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  return dismissedIds instanceof Set ? dismissedIds : new Set(dismissedIds);
}

export function getVisibleAnnouncements(args: {
  user: { id?: string; role: string; createdAt: Date | string };
  announcements: readonly AnnouncementInput[];
  dismissedIds: ReadonlySet<string> | readonly string[];
  now: Date | string;
}): AnnouncementInput[] {
  const { user, announcements, now } = args;
  if (user.role !== "student" && user.role !== "teacher") {
    return [];
  }

  const dismissed = toDismissedSet(args.dismissedIds);
  const nowMs = toMs(now);
  const userCreatedMs = toMs(user.createdAt);

  const visible = announcements.filter((announcement) => {
    const targets = announcement.targetUserIds;
    if (targets && targets.length > 0) {
      if (!user.id || !targets.includes(user.id)) return false;
    } else {
      const inAudience =
        user.role === "student"
          ? announcement.audienceStudent
          : announcement.audienceTeacher;
      if (!inAudience) return false;
    }
    if (announcement.archivedAt !== null) return false;
    if (announcement.expiresAt !== null && toMs(announcement.expiresAt) <= nowMs) {
      return false;
    }
    if (dismissed.has(announcement.id)) return false;
    if (toMs(announcement.createdAt) < userCreatedMs) return false;
    return true;
  });

  visible.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  return visible.slice(0, MAX_VISIBLE_ANNOUNCEMENTS);
}

const HIDDEN_ANNOUNCEMENT_PATHS = new Set([
  "/login",
  "/change-password",
  "/force-change-password",
  "/offline",
]);

export function shouldShowAnnouncements(args: {
  mustChangePassword?: boolean | null;
  path?: string | null;
}): boolean {
  if (args.mustChangePassword === true) return false;
  if (args.path) {
    const normalized = args.path.replace(/\/+$/, "") || "/";
    if (HIDDEN_ANNOUNCEMENT_PATHS.has(normalized)) return false;
  }
  return true;
}

export function shouldRegisterDismissal(args: {
  announcementId: string;
  dismissedIds: ReadonlySet<string> | readonly string[];
}): boolean {
  return !toDismissedSet(args.dismissedIds).has(args.announcementId);
}
