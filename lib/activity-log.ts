import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export const ACTIVITY_ACTIONS = [
  "feedback_saved",
  "target_saved",
  "qa_replied",
  "mock_exam_uploaded",
  "announcement_sent",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface LogActivityInput {
  actorId: string;
  action: ActivityAction;
  studentId?: string | null;
}

export async function logActivity({
  actorId,
  action,
  studentId,
}: LogActivityInput): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      actorId,
      action,
      studentId: studentId ?? null,
    } as unknown as typeof activityLogs.$inferInsert);
  } catch (err) {
    console.error("logActivity error:", err);
  }
}
