import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function normalizeLoginIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

export function getClientIp(request?: Request): string {
  const forwarded = request?.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request?.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function isLoginRateLimited(identifier: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ identifier: loginAttempts.identifier })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.identifier, identifier),
          gt(loginAttempts.createdAt, new Date(Date.now() - WINDOW_MS)),
        ),
      )
      .limit(MAX_ATTEMPTS);
    return rows.length >= MAX_ATTEMPTS;
  } catch (err) {
    console.error("Login rate limit check failed:", err);
    return false;
  }
}

export async function recordFailedLogin(
  identifier: string,
  ip: string,
): Promise<void> {
  try {
    const attempt = { identifier, ip };
    await db.insert(loginAttempts).values(attempt);
  } catch (err) {
    console.error("Failed login record insert failed:", err);
  }
}

export async function clearLoginAttempts(identifier: string): Promise<void> {
  try {
    await db
      .delete(loginAttempts)
      .where(eq(loginAttempts.identifier, identifier));
  } catch (err) {
    console.error("Failed login record cleanup failed:", err);
  }
}
