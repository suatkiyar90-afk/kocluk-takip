import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export interface PushSendResult {
  sent: number;
  failed: number;
}

export function ensureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@kocluk.local",
    publicKey,
    privateKey,
  );
  return true;
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url = "/quiz-entry",
): Promise<PushSendResult> {
  try {
    if (!ensureVapid()) {
      console.warn("sendPushNotification: VAPID anahtarlari tanimli degil.");
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({ title, body, url });
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

    return { sent, failed };
  } catch (err) {
    console.error("sendPushNotification error:", err);
    return { sent: 0, failed: 0 };
  }
}
