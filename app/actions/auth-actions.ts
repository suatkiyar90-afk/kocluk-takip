"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { actionErrorMessage } from "@/lib/action-error";

export type ChangePasswordResult =
  | { success: true; message: string }
  | {
      success: false;
      status: "UNAUTHORIZED" | "VALIDATION_FAILED" | "DATABASE_ERROR";
      message: string;
    };

const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(6, "Yeni şifre en az 6 karakter olmalı.")
    .max(200, "Şifre çok uzun."),
  confirmPassword: z.string().min(1, "Şifre tekrarı boş olamaz."),
});

export async function changeMyPassword(
  input: unknown,
): Promise<ChangePasswordResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    return {
      success: false,
      status: "UNAUTHORIZED",
      message: "Bu işlem için öğrenci oturumu gerekli.",
    };
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Şifreler eşleşmiyor.",
    };
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(users.id, session.user.id));

    return { success: true, message: "Şifreniz güncellendi." };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message:
        actionErrorMessage(err),
    };
  }
}
