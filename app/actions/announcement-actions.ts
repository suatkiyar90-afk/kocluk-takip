"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcementDismissals,
  announcementTargets,
  announcements,
  users,
} from "@/db/schema";
import { actionErrorMessage } from "@/lib/action-error";
import {
  createAnnouncementSchema,
  getVisibleAnnouncements,
  shouldRegisterDismissal,
  type AnnouncementKind,
  type AnnouncementItem,
  type CreateAnnouncementInput,
} from "@/lib/announcements";

const UNAUTHORIZED_MESSAGE = "Oturum açmanız gerekiyor.";
const NOT_ADMIN_MESSAGE = "Bu işlem için yönetici yetkisi gerekli.";

type AdminGuard =
  | { ok: true; adminId: string }
  | { ok: false; status: "UNAUTHORIZED" | "FORBIDDEN"; message: string };

async function requireAdmin(): Promise<AdminGuard> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, status: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE };
  }
  if (session.user.role !== "admin") {
    return { ok: false, status: "FORBIDDEN", message: NOT_ADMIN_MESSAGE };
  }
  return { ok: true, adminId: session.user.id };
}

type UserGuard =
  | { ok: true; userId: string; role: "student" | "teacher" }
  | { ok: false; message: string };

async function requireOwnUser(): Promise<UserGuard> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: UNAUTHORIZED_MESSAGE };
  }
  if (session.user.role !== "student" && session.user.role !== "teacher") {
    return { ok: false, message: NOT_ADMIN_MESSAGE };
  }
  return { ok: true, userId: session.user.id, role: session.user.role };
}

export type AnnouncementActionResult<T> =
  | { success: true; data: T; message: string }
  | {
      success: false;
      status:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "VALIDATION_FAILED"
        | "DATABASE_ERROR";
      message: string;
    };

export interface AnnouncementListRow {
  id: string;
  title: string;
  kind: AnnouncementKind;
  audienceStudent: boolean;
  audienceTeacher: boolean;
  createdAt: string;
  expiresAt: string | null;
  archivedAt: string | null;
  audienceCount: number;
  dismissCount: number;
  targeted: boolean;
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
): Promise<AnnouncementActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  const parsed = createAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message:
        parsed.error.issues[0]?.message ?? "Girdiler geçerli değil.",
    };
  }

  try {
    const targetIds = [...new Set(parsed.data.targetUserIds ?? [])];
    let audienceStudent = parsed.data.audienceStudent;
    let audienceTeacher = parsed.data.audienceTeacher;
    let validTargetIds: string[] = [];

    if (targetIds.length > 0) {
      const targetUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(inArray(users.id, targetIds));
      if (targetUsers.length !== targetIds.length) {
        return {
          success: false,
          status: "VALIDATION_FAILED",
          message: "Seçilen kullanıcılar arasında geçersiz kayıt var.",
        };
      }
      validTargetIds = targetUsers.map((row) => row.id);
      audienceStudent = targetUsers.some((row) => row.role === "student");
      audienceTeacher = targetUsers.some((row) => row.role === "teacher");
    }

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(announcements)
        .values({
          title: parsed.data.title,
          body: parsed.data.body,
          kind: parsed.data.kind,
          audienceStudent,
          audienceTeacher,
          createdBy: guard.adminId,
          expiresAt: parsed.data.expiresAt
            ? new Date(parsed.data.expiresAt)
            : null,
        } as typeof announcements.$inferInsert)
        .returning({ id: announcements.id });

      if (validTargetIds.length > 0) {
        await tx.insert(announcementTargets).values(
          validTargetIds.map((userId) => ({
            announcementId: row.id,
            userId,
          })),
        );
      }
      return row.id;
    });

    return {
      success: true,
      data: { id },
      message: "Duyuru yayınlandı.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

const announcementIdSchema = z.string().uuid("Geçersiz duyuru.");

export async function archiveAnnouncement(
  id: string,
): Promise<AnnouncementActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  const parsed = announcementIdSchema.safeParse(id);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues[0]?.message ?? "Geçersiz duyuru.",
    };
  }

  try {
    const rows = await db
      .update(announcements)
      .set({ archivedAt: new Date() } as Partial<typeof announcements.$inferInsert>)
      .where(eq(announcements.id, parsed.data))
      .returning({ id: announcements.id });
    if (rows.length === 0) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Duyuru bulunamadı.",
      };
    }
    return {
      success: true,
      data: { id: rows[0].id },
      message: "Duyuru arşivlendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export async function listAnnouncements(): Promise<
  AnnouncementActionResult<{ announcements: AnnouncementListRow[] }>
> {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  try {
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        kind: announcements.kind,
        audienceStudent: announcements.audienceStudent,
        audienceTeacher: announcements.audienceTeacher,
        createdAt: announcements.createdAt,
        expiresAt: announcements.expiresAt,
        archivedAt: announcements.archivedAt,
        audienceCount: sql<number>`(
          SELECT count(*)::int FROM users u
          WHERE (u.role = 'student' AND ${announcements.audienceStudent})
             OR (u.role = 'teacher' AND ${announcements.audienceTeacher})
        )`,
        targetCount: sql<number>`(
          SELECT count(*)::int FROM announcement_targets t
          WHERE t.announcement_id = ${announcements.id}
        )`,
        dismissCount: sql<number>`(
          SELECT count(*)::int FROM announcement_dismissals d
          WHERE d.announcement_id = ${announcements.id}
        )`,
      })
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(30);

    const data = rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      audienceStudent: row.audienceStudent,
      audienceTeacher: row.audienceTeacher,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      audienceCount: row.targetCount > 0 ? row.targetCount : row.audienceCount,
      dismissCount: row.dismissCount,
      targeted: row.targetCount > 0,
    }));

    return {
      success: true,
      data: { announcements: data },
      message: "Duyurular yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export async function getAudienceCounts(): Promise<
  AnnouncementActionResult<{ students: number; teachers: number }>
> {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  try {
    const rows = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(sql`${users.role} IN ('student', 'teacher')`)
      .groupBy(users.role);

    let students = 0;
    let teachers = 0;
    for (const row of rows) {
      if (row.role === "student") students = row.count;
      if (row.role === "teacher") teachers = row.count;
    }
    return {
      success: true,
      data: { students, teachers },
      message: "Hedef sayılar yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export interface AudienceUserRow {
  id: string;
  name: string;
  role: "student" | "teacher";
  studentNumber: string | null;
}

export async function listAudienceUsers(): Promise<
  AnnouncementActionResult<{ users: AudienceUserRow[] }>
> {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return { success: false, status: guard.status, message: guard.message };
  }

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        studentNumber: users.studentNumber,
      })
      .from(users)
      .where(inArray(users.role, ["student", "teacher"]))
      .orderBy(asc(users.name), asc(users.studentNumber));

    return {
      success: true,
      data: {
        users: rows.map((row) => ({
          id: row.id,
          name: row.name,
          role: row.role === "teacher" ? "teacher" : "student",
          studentNumber: row.studentNumber,
        })),
      },
      message: "Kullanıcılar yüklendi.",
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}

export type GetPendingAnnouncementsResult = {
  success: true;
  data: { announcements: AnnouncementItem[] };
};

function emptyPending(): GetPendingAnnouncementsResult {
  return { success: true, data: { announcements: [] } };
}

type VisibilitySnapshot = {
  announcements: import("@/lib/announcements").AnnouncementInput[];
  dismissedIds: string[];
  me: { createdAt: Date; role: string } | null;
};

async function loadVisibilitySnapshot(userId: string): Promise<VisibilitySnapshot> {
  const [rows, dismissedRows, meRows] = await Promise.all([
    db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        kind: announcements.kind,
        audienceStudent: announcements.audienceStudent,
        audienceTeacher: announcements.audienceTeacher,
        createdAt: announcements.createdAt,
        expiresAt: announcements.expiresAt,
        archivedAt: announcements.archivedAt,
        targetIds: sql<string[] | null>`(
          SELECT array_agg(t.user_id::text)
          FROM announcement_targets t
          WHERE t.announcement_id = ${announcements.id}
        )`,
      })
      .from(announcements)
      .orderBy(asc(announcements.createdAt)),
    db
      .select({ announcementId: announcementDismissals.announcementId })
      .from(announcementDismissals)
      .where(eq(announcementDismissals.userId, userId)),
    db
      .select({ createdAt: users.createdAt, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  return {
    announcements: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      kind: row.kind,
      audienceStudent: row.audienceStudent,
      audienceTeacher: row.audienceTeacher,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      archivedAt: row.archivedAt,
      targetUserIds: row.targetIds ?? [],
    })),
    dismissedIds: dismissedRows.map((row) => row.announcementId),
    me: meRows[0] ?? null,
  };
}

export async function getMyPendingAnnouncements(): Promise<GetPendingAnnouncementsResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  if (!userId || !role || role === "admin") {
    return emptyPending();
  }

  try {
    const snapshot = await loadVisibilitySnapshot(userId);
    if (snapshot.me === null) {
      return emptyPending();
    }

    const visible = getVisibleAnnouncements({
      user: {
        id: userId,
        role: snapshot.me.role,
        createdAt: snapshot.me.createdAt,
      },
      announcements: snapshot.announcements,
      dismissedIds: snapshot.dismissedIds,
      now: new Date(),
    });

    const items: AnnouncementItem[] = visible.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      kind: row.kind,
      audienceStudent: row.audienceStudent,
      audienceTeacher: row.audienceTeacher,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString(),
      expiresAt: row.expiresAt
        ? row.expiresAt instanceof Date
          ? row.expiresAt.toISOString()
          : new Date(row.expiresAt).toISOString()
        : null,
    }));

    return { success: true, data: { announcements: items } };
  } catch (err) {
    console.error("getMyPendingAnnouncements failed:", err);
    return emptyPending();
  }
}

export type DismissAnnouncementResult =
  | { success: true }
  | { success: false; message: string };

export async function dismissAnnouncement(
  id: string,
): Promise<DismissAnnouncementResult> {
  const guard = await requireOwnUser();
  if (guard.ok === false) {
    return { success: false, message: guard.message };
  }

  const parsed = announcementIdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, message: "Geçersiz duyuru." };
  }

  try {
    const snapshot = await loadVisibilitySnapshot(guard.userId);
    if (snapshot.me === null) {
      return { success: false, message: UNAUTHORIZED_MESSAGE };
    }

    const visibleIds = new Set(
      getVisibleAnnouncements({
        user: {
          id: guard.userId,
          role: snapshot.me.role,
          createdAt: snapshot.me.createdAt,
        },
        announcements: snapshot.announcements,
        dismissedIds: snapshot.dismissedIds,
        now: new Date(),
      }).map((row) => row.id),
    );

    if (!visibleIds.has(parsed.data)) {
      return { success: true };
    }

    if (
      !shouldRegisterDismissal({
        announcementId: parsed.data,
        dismissedIds: snapshot.dismissedIds,
      })
    ) {
      return { success: true };
    }

    await db
      .insert(announcementDismissals)
      .values({ announcementId: parsed.data, userId: guard.userId })
      .onConflictDoNothing({
        target: [
          announcementDismissals.announcementId,
          announcementDismissals.userId,
        ],
      });

    return { success: true };
  } catch (err) {
    console.error("dismissAnnouncement failed:", err);
    return { success: false, message: "İşlem tamamlanamadı." };
  }
}
