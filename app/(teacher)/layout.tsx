import "../globals.css";
import "@uploadthing/react/styles.css";
import { LogoutButton } from "@/components/auth/logout-button";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";
import { TeacherBottomNav } from "@/components/teacher/teacher-bottom-nav";
import { NotificationStatusIcon } from "@/components/teacher/notification-status-icon";
import { getPendingQuestionCount } from "@/app/actions/qa-actions";

export const metadata = {
  ...pwaMetadata,
  title: "Öğretmen | Koçluk Takip",
};

export const viewport = pwaViewport;

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pendingCount = await getPendingQuestionCount();

  return (
    <html lang="tr">
      <body className="min-h-dvh bg-gray-50">
        <AppleWebAppMeta />
        <SwRegister />
        <SchoolWatermark />
        <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-3 px-4 md:max-w-3xl xl:max-w-5xl">
            <span className="text-base font-extrabold tracking-tight text-gray-900">
              Koç Paneli
            </span>
            <div className="flex items-center gap-2">
              <NotificationStatusIcon />
              <LogoutButton className="flex h-11 items-center rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-600 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation" />
            </div>
          </div>
        </div>
        {children}
        <TeacherBottomNav pendingCount={pendingCount} />
      </body>
    </html>
  );
}
