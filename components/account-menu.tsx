"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { KeyRound, LogOut, ShieldCheck, User, X } from "lucide-react";
import { toast } from "sonner";
import { changeMyPassword } from "@/app/actions/auth-actions";

type MenuView = "menu" | "password" | "logout";

let privacyLinkOk: boolean | null = null;

const triggerClass =
  "flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm transition active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
const itemClass =
  "flex h-11 w-full touch-manipulation items-center gap-2.5 px-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-700/60 dark:active:bg-slate-700";
const labelClass =
  "mb-1 block text-xs font-semibold text-gray-600 dark:text-slate-300";
const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

function initialsOf(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
}

interface AccountMenuProps {
  userName: string;
}

export function AccountMenu({ userName }: AccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("menu");
  const [privacyOk, setPrivacyOk] = useState<boolean | null>(privacyLinkOk);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const initials = initialsOf(userName);

  useEffect(() => {
    if (privacyLinkOk !== null) return;
    let cancelled = false;
    fetch("/aydinlatma", { method: "HEAD" })
      .then((res) => {
        privacyLinkOk = res.ok;
        if (!cancelled) setPrivacyOk(res.ok);
      })
      .catch(() => {
        privacyLinkOk = false;
        if (!cancelled) setPrivacyOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function close() {
    setOpen(false);
    setView("menu");
    setError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    }

    function handleFocusOut(event: FocusEvent) {
      const next = event.relatedTarget as Node | null;
      if (next === null) return;
      if (!containerRef.current?.contains(next)) {
        close();
      }
    }

    const container = containerRef.current;
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    container?.addEventListener("focusout", handleFocusOut);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      container?.removeEventListener("focusout", handleFocusOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (view === "menu") {
      firstItemRef.current?.focus();
    } else if (view === "logout") {
      confirmRef.current?.focus();
    }
  }, [open, view]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (currentPassword.length < 1) {
      setError("Mevcut şifrenizi girin.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Yeni şifre en az 8 karakter olmalı.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setSaving(true);
    try {
      const result = await changeMyPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (result.success === true) {
        toast.success(result.message);
        close();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef} className="relative print:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={`${userName} için hesap menüsü`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        className={triggerClass}
      >
        {initials !== null ? (
          <span aria-hidden="true" className="text-xs font-extrabold">
            {initials}
          </span>
        ) : (
          <User aria-hidden="true" className="h-5 w-5" />
        )}
      </button>

      {open ? (
        <div
          id="account-menu"
          className="absolute right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-black/10 dark:border-slate-700 dark:bg-slate-800"
        >
          {view === "password" ? (
            <div
              role="dialog"
              aria-label="Şifre değiştir"
              className="w-72 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                  Şifre Değiştir
                </p>
                <button
                  type="button"
                  aria-label="Şifre değiştirmeyi kapat"
                  onClick={() => setView("menu")}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 dark:hover:text-slate-200"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} noValidate className="space-y-3">
                <div>
                  <label htmlFor="account-current-password" className={labelClass}>
                    Mevcut Şifre
                  </label>
                  <input
                    id="account-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="account-new-password" className={labelClass}>
                    Yeni Şifre
                  </label>
                  <input
                    id="account-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="En az 8 karakter"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="account-confirm-password"
                    className={labelClass}
                  >
                    Yeni Şifre (Tekrar)
                  </label>
                  <input
                    id="account-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>
                {error !== null ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/70 dark:text-red-300">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={
                    saving ||
                    currentPassword.length < 1 ||
                    newPassword.length < 8 ||
                    confirmPassword.length < 1
                  }
                  className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                >
                  {saving ? "Kaydediliyor…" : "Şifremi Değiştir"}
                </button>
              </form>
            </div>
          ) : view === "logout" ? (
            <div role="menu" aria-label="Çıkış onayı" className="w-60 p-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                Çıkış yapmak istediğine emin misin?
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="h-11 flex-1 rounded-xl bg-red-600 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-60 touch-manipulation"
                >
                  {loggingOut ? "Çıkış…" : "Evet, Çıkış Yap"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="h-11 flex-1 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 transition active:bg-gray-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700 touch-manipulation"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <div role="menu" aria-label="Hesap menüsü" className="w-56 py-1">
              <button
                ref={firstItemRef}
                type="button"
                role="menuitem"
                onClick={() => setView("password")}
                className={itemClass}
              >
                <KeyRound aria-hidden="true" className="h-4 w-4 shrink-0" />
                Şifre Değiştir
              </button>
              {privacyOk === true ? (
                <a
                  role="menuitem"
                  href="/aydinlatma"
                  onClick={close}
                  className={itemClass}
                >
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Aydınlatma Metni
                </a>
              ) : null}
              <div
                role="separator"
                aria-orientation="horizontal"
                className="my-1 border-t border-gray-100 dark:border-slate-700"
              />
              <button
                type="button"
                role="menuitem"
                onClick={() => setView("logout")}
                className={`${itemClass} text-red-600 dark:text-red-400`}
              >
                <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
