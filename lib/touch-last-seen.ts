import { sql } from "drizzle-orm";
import { db } from "@/db";

const TOUCH_INTERVAL = "interval '10 minutes'";

export async function touchLastSeen(userId: string): Promise<void> {
  try {
    await db.execute(sql`
      update users
      set last_seen_at = now()
      where id = ${userId}
        and (
          last_seen_at is null
          or last_seen_at < now() - ${sql.raw(TOUCH_INTERVAL)}
        )
    `);
  } catch (err) {
    console.error("touchLastSeen error:", err);
  }
}
