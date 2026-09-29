"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";

const THEME_OPTIONS = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const activeTheme = mounted ? (theme ?? "system") : "system";
  const ActiveIcon =
    mounted && resolvedTheme === "dark"
      ? Moon
      : activeTheme === "system"
        ? Monitor
        : Sun;

  return (
    <div ref={containerRef} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Tema seç"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition active:scale-[0.97] touch-manipulation dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      >
        <ActiveIcon aria-hidden="true" className="h-5 w-5" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Tema seçenekleri"
          className="absolute right-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl shadow-black/10 dark:border-slate-700 dark:bg-slate-800"
        >
          {THEME_OPTIONS.map((option) => {
            const isActive = activeTheme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className="flex h-11 w-full items-center gap-2.5 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-700/60 dark:active:bg-slate-700 touch-manipulation"
              >
                <option.icon aria-hidden="true" className="h-4 w-4" />
                <span>{option.label}</span>
                {isActive ? (
                  <Check
                    aria-hidden="true"
                    className="ml-auto h-4 w-4 text-indigo-600 dark:text-indigo-400"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
