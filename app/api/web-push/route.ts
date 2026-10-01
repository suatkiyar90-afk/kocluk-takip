import { NextResponse } from "next/server";
import { z } from "zod";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { logActivity } from "@/lib/activity-log";
import { pushSubscriptions, teacherStudents } from "@/db/schema";
import { ensureVapid } from "@/lib/web-push-helper";

const subscribeSchema = z.object({
  action: z.literal("subscribe"),
  subscription: z.object({
    endpoint: z.string().min(1).max(4096),
    keys: z.object({
      p256dh: z.string().min(1).max(512),
      auth: z.string().min(1).max(512),
    }),
  }),
});

const sendSchema = z.object({
  action: z.literal("send"),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  url: z.string().max(500).optional(),
  userId: z.string().uuid().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  subscribeSchema,
  sendSchema,
]);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Oturum gerekli." },
      { status: 401 },
    );
  }

  const endpoint = new URL(req.url).searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ success: true, subscribed: false });
  }

  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    )
    .limit(1);

  return NextResponse.json({ success: true, subscribed: rows.length > 0 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Oturum gerekli." },
      { status: 401 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Gecersiz istek govdesi." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "subscribe") {
    const { subscription } = parsed.data;
    try {
      await db
        .insert(pushSubscriptions)
        .values({
          userId: session.user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        })
        .onConflictDoUpdate({
          target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
          set: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("push subscribe error:", err);
      return NextResponse.json(
        { success: false, message: "Abonelik kaydedilemedi." },
        { status: 500 },
      );
    }
  }

  const { title, body, url, userId } = parsed.data;
  const role = session.user.role;

  if (role !== "admin" && role !== "teacher") {
    return NextResponse.json(
      { success: false, message: "Bu islem sadece yonetici/ogretmen icin." },
      { status: 403 },
    );
  }

  if (!ensureVapid()) {
    return NextResponse.json(
      {
        success: false,
        message:
          "VAPID anahtarlari tanimli degil. NEXT_PUBLIC_VAPID_PUBLIC_KEY ve VAPID_PRIVATE_KEY .env dosyasina eklenmeli.",
      },
      { status: 503 },
    );
  }

  let targetUserIds: string[];
  if (role === "admin") {
    if (userId) {
      targetUserIds = [userId];
    } else {
      const rows = await db
        .select({ userId: pushSubscriptions.userId })
        .from(pushSubscriptions);
      targetUserIds = [...new Set(rows.map((r) => r.userId))];
    }
  } else {
    if (userId) {
      const assigned = await db
        .select({ studentId: teacherStudents.studentId })
        .from(teacherStudents)
        .where(
          and(
            eq(teacherStudents.studentId, userId),
            eq(teacherStudents.teacherId, session.user.id),
          ),
        )
        .limit(1);
      if (assigned.length === 0) {
        return NextResponse.json(
          { success: false, message: "Ogrenci size atanmamis." },
          { status: 403 },
        );
      }
      targetUserIds = [userId];
    } else {
      const assigned = await db
        .select({ studentId: teacherStudents.studentId })
        .from(teacherStudents)
        .where(eq(teacherStudents.teacherId, session.user.id));
      targetUserIds = assigned.map((r) => r.studentId);
    }
  }

  if (targetUserIds.length === 0) {
    return NextResponse.json({ success: true, sent: 0, failed: 0, total: 0 });
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, targetUserIds));

  const payload = JSON.stringify({
    title,
    body,
    url: url || "/quiz-entry",
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, row.id));
        } else {
          console.error("webpush send error:", status, err);
        }
      }
    }),
  );

  await logActivity({
    actorId: session.user.id,
    action: "announcement_sent",
    studentId: userId ?? null,
  });

  return NextResponse.json({
    success: true,
    sent,
    failed,
    total: subscriptions.length,
  });
}
