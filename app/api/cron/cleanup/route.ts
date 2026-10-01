import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 90;

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

async function runCleanup(): Promise<NextResponse> {
  try {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const deleted = await db
      .delete(activityLogs)
      .where(lt(activityLogs.createdAt, cutoff))
      .returning({ id: activityLogs.id });

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      deleted: deleted.length,
    });
  } catch (err) {
    console.error("cleanup cron error:", err);
    return NextResponse.json(
      { success: false, message: "Kayit temizligi baslatilamadi." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  return runCleanup();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  return runCleanup();
}
