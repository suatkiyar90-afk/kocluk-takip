"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/quiz-entry", label: "Günlük Giriş" },
  { href: "/deneme-sinavi", label: "Denemeler" },
  { href: "/mufredat", label: "Müfredat" },
  { href: "/ask", label: "Soru Sor" },
] as const;

export function StudentNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 grid grid-cols-4 gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-2 py-2.5 text-center text-xs font-bold transition touch-manipulation ${
              active
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-500 hover:text-indigo-600"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}