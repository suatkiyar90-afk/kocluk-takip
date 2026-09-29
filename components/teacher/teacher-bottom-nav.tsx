"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion, Users } from "lucide-react";

interface TeacherBottomNavProps {
  pendingCount: number;
}

const ITEMS = [
  { href: "/dashboard", label: "Öğrenciler", icon: Users },
  { href: "/sorular", label: "Sorular", icon: MessageCircleQuestion },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname.startsWith("/dashboard") || pathname.startsWith("/students");
  }
  return pathname.startsWith(href);
}

export function TeacherBottomNav({ pendingCount }: TeacherBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Panel gezinmesi"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const showBadge = item.href === "/sorular" && pendingCount > 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 transition touch-manipulation ${
                  active ? "text-indigo-600" : "text-gray-500"
                }`}
              >
                <span className="relative">
                  <Icon
                    aria-hidden="true"
                    className={`h-5 w-5 ${active ? "stroke-2" : "stroke-1.5"}`}
                  />
                  {showBadge ? (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-none text-white">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-bold leading-tight">
                  {item.label}
                </span>
                <span className="sr-only">
                  {showBadge
                    ? `${pendingCount} soru cevap bekliyor`
                    : undefined}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
