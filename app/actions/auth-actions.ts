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
  currentPassword: z
    .string()
    .max(200, "Mevcut şifre çok uzun.")
    .optional()
    .default(""),
  newPassword: z
    .string()
    .min(8, "Yeni şifre en az 8 karakter olmalı.")
    .max(200, "Şifre çok uzun."),
  confirmPassword: z.string().min(1, "Şifre tekrarı boş olamaz."),
});

export async function changeMyPassword(
  input: unknown,
): Promise<ChangePasswordResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      status: "UNAUTHORIZED",
      message: "Bu işlem için oturum açmanız gerekiyor.",
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

  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: "Şifreler eşleşmiyor.",
    };
  }

  try {
    const rows = await db
      .select({
        passwordHash: users.passwordHash,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const user = rows[0];
    if (!user) {
      return {
        success: false,
        status: "UNAUTHORIZED",
        message: "Kullanıcı bulunamadı.",
      };
    }

    const forced = user.mustChangePassword === true;

    if (!forced) {
      if (!currentPassword) {
        return {
          success: false,
          status: "VALIDATION_FAILED",
          message: "Mevcut şifrenizi girin.",
        };
      }
      if (!user.passwordHash) {
        return {
          success: false,
          status: "VALIDATION_FAILED",
          message: "Mevcut şifrenizi doğrulayamadık.",
        };
      }
      const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!currentOk) {
        return {
          success: false,
          status: "VALIDATION_FAILED",
          message: "Mevcut şifre hatalı.",
        };
      }
    }

    if (
      user.passwordHash &&
      (await bcrypt.compare(newPassword, user.passwordHash))
    ) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Yeni şifre mevcut şifreyle aynı olamaz.",
      };
    }

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
      message: actionErrorMessage(err),
    };
  }
}

const changeUserPasswordSchema = z.object({
  oldPassword: z
    .string()
    .min(1, "Mevcut şifre boş olamaz.")
    .max(200, "Mevcut şifre çok uzun."),
  newPassword: z
    .string()
    .min(6, "Yeni şifre en az 6 karakter olmalı.")
    .max(200, "Yeni şifre çok uzun."),
});

export async function changeUserPassword(
  oldPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      status: "UNAUTHORIZED",
      message: "Bu işlem için oturum açmanız gerekiyor.",
    };
  }

  const parsed = changeUserPasswordSchema.safeParse({
    oldPassword,
    newPassword,
  });
  if (!parsed.success) {
    return {
      success: false,
      status: "VALIDATION_FAILED",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { oldPassword: currentPassword, newPassword: nextPassword } =
    parsed.data;

  try {
    const rows = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const user = rows[0];
    if (!user?.passwordHash) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Mevcut şifrenizi doğrulayamadık.",
      };
    }

    const oldPasswordOk = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!oldPasswordOk) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Eski şifre hatalı.",
      };
    }

    if (await bcrypt.compare(nextPassword, user.passwordHash)) {
      return {
        success: false,
        status: "VALIDATION_FAILED",
        message: "Yeni şifre eski şifreyle aynı olamaz.",
      };
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(users.id, session.user.id));

    return { success: true, message: "Şifreniz başarıyla güncellendi." };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}
