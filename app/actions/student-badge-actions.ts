"use server";

import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { coachingFeedbacks, qaThreads } from "@/db/schema";
import { actionErrorMessage } from "@/lib/action-error";

export interface StudentBadges {
  latestFeedbackId: number | null;
  latestAnsweredQaId: number | null;
}

export type StudentBadgesResult =
  | { success: true; data: StudentBadges }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export async function getStudentBadges(): Promise<StudentBadgesResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      success: false,
      status: "UNAUTHORIZED",
      message: "Oturum açmanız gerekiyor.",
    };
  }
  if (session?.user?.role !== "student") {
    return {
      success: false,
      status: "FORBIDDEN",
      message: "Bu işlem için yetkiniz yok.",
    };
  }

  try {
    const [feedbackRows, answeredRows] = await Promise.all([
      db
        .select({ id: coachingFeedbacks.id })
        .from(coachingFeedbacks)
        .where(eq(coachingFeedbacks.studentId, userId))
        .orderBy(desc(coachingFeedbacks.id))
        .limit(1),
      db
        .select({ id: qaThreads.id })
        .from(qaThreads)
        .where(
          and(eq(qaThreads.studentId, userId), eq(qaThreads.status, "cevaplandı")),
        )
        .orderBy(desc(qaThreads.id))
        .limit(1),
    ]);

    return {
      success: true,
      data: {
        latestFeedbackId: feedbackRows[0]?.id ?? null,
        latestAnsweredQaId: answeredRows[0]?.id ?? null,
      },
    };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}
