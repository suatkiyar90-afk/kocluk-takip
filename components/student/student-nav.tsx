"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/quiz-entry", label: "Günlük Giriş" },
  { href: "/weekly-targets", label: "Hedeflerim" },
  { href: "/deneme-sinavi", label: "Denemeler" },
  { href: "/mufredat", label: "Müfredat" },
  { href: "/ask", label: "Soru Sor" },
] as const;

export function StudentNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex w-full flex-nowrap items-center justify-start space-x-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 pb-2 shadow-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex-shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition touch-manipulation ${
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