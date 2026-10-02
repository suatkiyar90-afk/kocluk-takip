"use server";

import { auth } from "@/auth";
import { touchLastSeen } from "@/lib/touch-last-seen";

export async function touchSeenAction(): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return;
    }
    await touchLastSeen(session.user.id);
  } catch (err) {
    console.error("touchSeenAction error:", err);
  }
}
