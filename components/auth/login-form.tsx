"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { SchoolLogo } from "@/components/brand/school-logo";

interface LoginFormProps {
  callbackUrl?: string;
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const target =
    callbackUrl && callbackUrl !== "/" && callbackUrl !== "/login"
      ? callbackUrl
      : undefined;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
        callbackUrl: "/",
        ...(target ? { redirectTo: target } : {}),
      });

      if (res?.error) {
        setError(
          res.error
            .toLowerCase()
            .includes("credentials")
            ? "Kullanıcı adı veya şifre hatalı."
            : "Giriş yapılamadı.",
        );
        return;
      }

      if (!res?.ok) {
        setError("Kullanıcı adı veya şifre hatalı.");
        return;
      }

      const destination = res.url ?? target ?? "/";
      window.location.assign(destination);
    } catch {
      setError("Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-105 rounded-3xl border border-gray-200 bg-white p-6 shadow-lg shadow-gray-200/60 sm:p-8">
        <header className="text-center">
          <div className="relative w-28 h-28 bg-white rounded-full flex items-center justify-center overflow-hidden shrink-0 mx-auto shadow-lg">
            <SchoolLogo className="w-full h-full object-contain p-2" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-gray-900">
            Akademik Takip
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Devam etmek için giriş yapın.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Kullanıcı Adı (Öğretmen/Yönetici) veya Öğrenci No
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="kullanıcı adın veya öğrenci numaran"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
          >
            {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>
      </div>
    </main>
  );
}