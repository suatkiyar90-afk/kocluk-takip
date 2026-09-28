"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeMyPassword } from "@/app/actions/auth-actions";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

export function ForceChangePasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Yeni şifre en az 6 karakter olmalı.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const result = await changeMyPassword({ newPassword, confirmPassword });
      if (result.success === true) {
        toast.success("Şifreniz güncellendi. Yönlendiriliyorsunuz…");
        router.push("/panel");
        router.refresh();
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
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
          autoFocus
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
          placeholder="Şifrenizi tekrar girin"
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
        disabled={loading || newPassword.length < 6 || confirmPassword.length < 1}
        className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
      >
        {loading ? "Kaydediliyor…" : "Şifremi Değiştir"}
      </button>
    </form>
  );
}
