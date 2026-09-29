import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dailyQuestionEntries, users } from "@/db/schema";
import { sendPushNotification } from "@/lib/web-push-helper";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, message: "Unauthorized" },
    { status: 401 },
  );
}

async function runDailyReminder(): Promise<NextResponse> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [students, activeToday] = await Promise.all([
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "student")),
      db
        .selectDistinct({ studentId: dailyQuestionEntries.studentId })
        .from(dailyQuestionEntries)
        .where(eq(dailyQuestionEntries.date, today)),
    ]);

    const activeSet = new Set(activeToday.map((r) => r.studentId));
    const inactiveIds = students
      .map((s) => s.id)
      .filter((id) => !activeSet.has(id));

    await Promise.all(
      inactiveIds.map((studentId) =>
        sendPushNotification(
          studentId,
          "Günün Özeti Eksik!",
          "Bugün henüz soru çözümü girmedin. Hedeflerinden geri kalmamak için hemen sisteme gir.",
          "/quiz-entry",
        ),
      ),
    );

    return NextResponse.json({
      success: true,
      date: today,
      totalStudents: students.length,
      notified: inactiveIds.length,
    });
  } catch (err) {
    console.error("daily-reminder cron error:", err);
    return NextResponse.json(
      { success: false, message: "Bildirimler gonderilemedi." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  return runDailyReminder();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  return runDailyReminder();
}
