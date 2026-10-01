"use client";

import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { changeUserPassword } from "@/app/actions/auth-actions";

const changePasswordFormSchema = z
  .object({
    oldPassword: z.string().min(1, "Mevcut şifre boş olamaz."),
    newPassword: z
      .string()
      .min(6, "Yeni şifre en az 6 karakter olmalı.")
      .max(200, "Yeni şifre çok uzun."),
    confirmPassword: z.string().min(1, "Yeni şifre tekrarı boş olamaz."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Yeni şifreler eşleşmiyor.",
    path: ["confirmPassword"],
  })
  .refine((values) => values.oldPassword !== values.newPassword, {
    message: "Yeni şifre eski şifreyle aynı olamaz.",
    path: ["newPassword"],
  });

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

export function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = changePasswordFormSchema.safeParse({
      oldPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(", "));
      return;
    }

    setLoading(true);
    try {
      const result = await changeUserPassword(
        parsed.data.oldPassword,
        parsed.data.newPassword,
      );
      if (result.success === true) {
        toast.success("Şifreniz başarıyla güncellendi");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-gray-900">
        Şifre Değiştir
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Güvenliğiniz için şifrenizi düzenli olarak güncelleyin.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="old-password" className={labelClass}>
            Eski Şifre
          </label>
          <input
            id="old-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className={inputClass}
            placeholder="Mevcut şifreniz"
            autoComplete="current-password"
          />
        </div>

        <div>
          <label htmlFor="new-password" className={labelClass}>
            Yeni Şifre
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            placeholder="En az 6 karakter"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className={labelClass}>
            Yeni Şifre (Tekrar)
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            placeholder="Yeni şifrenizi tekrar girin"
            autoComplete="new-password"
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            loading || !oldPassword || !newPassword || !confirmPassword
          }
          className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
        >
          {loading ? "Güncelleniyor…" : "Şifreyi Güncelle"}
        </button>
      </div>
    </form>
  );
}
