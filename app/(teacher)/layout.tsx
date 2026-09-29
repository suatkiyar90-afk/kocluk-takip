import "../globals.css";
import "@uploadthing/react/styles.css";
import { LogoutButton } from "@/components/auth/logout-button";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";

export const metadata = {
  ...pwaMetadata,
  title: "Öğretmen | Koçluk Takip",
};

export const viewport = pwaViewport;

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-dvh bg-gray-50">
        <AppleWebAppMeta />
        <SwRegister />
        <SchoolWatermark />
        <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
            <span className="text-base font-extrabold tracking-tight text-gray-900">
              Koçluk Takip
            </span>
            <LogoutButton />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}