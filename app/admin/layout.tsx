import "../globals.css";
import Link from "next/link";
import { auth } from "@/auth";
import { touchLastSeen } from "@/lib/touch-last-seen";
import { LogoutButton } from "@/components/auth/logout-button";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  ...pwaMetadata,
  title: "Yönetici Paneli | Akademik Takip",
};

export const viewport = pwaViewport;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user?.id) {
    void touchLastSeen(session.user.id);
  }

  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-dvh bg-gray-50">
        <ThemeProvider>
          <AppleWebAppMeta />
          <SwRegister />
          <SchoolWatermark />
          <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur print:hidden">
            <div className="mx-auto flex min-h-14 w-full max-w-md flex-wrap items-center justify-between gap-y-1 px-4 py-1.5">
              <span className="text-base font-extrabold tracking-tight text-gray-900">
                Akademik Takip — Yönetici
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/admin/reports"
                  className="rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 touch-manipulation"
                >
                  Raporlar
                </Link>
                <Link
                  href="/admin/announcements"
                  className="rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 touch-manipulation"
                >
                  Duyurular
                </Link>
                <Link
                  href="/admin/activities"
                  className="rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 touch-manipulation"
                >
                  Aktiviteler
                </Link>
                <Link
                  href="/admin/settings"
                  className="rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 touch-manipulation"
                >
                  Ayarlar
                </Link>
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}