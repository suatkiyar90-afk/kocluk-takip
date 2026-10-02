import "../globals.css";
import { auth } from "@/auth";
import { touchLastSeen } from "@/lib/touch-last-seen";
import { TouchSeenObserver } from "@/components/touch-seen-observer";
import { LogoutButton } from "@/components/auth/logout-button";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  ...pwaMetadata,
  title: "Öğrenci | Akademik Takip",
};

export const viewport = pwaViewport;

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userName = session?.user?.name || "Kullanıcı";
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
          <TouchSeenObserver />
          <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur print:hidden">
            <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
              <div className="min-w-0">
                <span className="block text-base font-extrabold tracking-tight text-gray-900">
                  Akademik Takip
                </span>
                <p className="mt-0.5 truncate text-sm font-medium text-gray-500">
                  {userName}
                </p>
              </div>
              <div className="flex items-center gap-2">
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