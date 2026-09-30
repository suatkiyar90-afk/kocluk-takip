import "../globals.css";
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

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-dvh bg-gray-50">
        <ThemeProvider>
          <AppleWebAppMeta />
          <SwRegister />
          <SchoolWatermark />
          <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur print:hidden">
            <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
              <span className="text-base font-extrabold tracking-tight text-gray-900">
                Akademik Takip
              </span>
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