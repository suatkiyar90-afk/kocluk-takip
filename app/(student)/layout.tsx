import "../globals.css";
import { auth } from "@/auth";
import { touchLastSeen } from "@/lib/touch-last-seen";
import { TouchSeenObserver } from "@/components/touch-seen-observer";
import { AccountMenu } from "@/components/account-menu";
import { NotificationStatusIcon } from "@/components/teacher/notification-status-icon";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnnouncementDialog } from "@/components/announcements/announcement-dialog";
import { getMyPendingAnnouncements } from "@/app/actions/announcement-actions";
import { getMyPolicyStatus } from "@/app/actions/policy-actions";
import { shouldShowAnnouncements } from "@/lib/announcements";
import { redirect } from "next/navigation";

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

  const policyStatus = await getMyPolicyStatus();
  const policyPending = policyStatus.status === "required";
  if (policyPending) {
    redirect("/kvkk");
  }

  let announcements: Awaited<
    ReturnType<typeof getMyPendingAnnouncements>
  >["data"]["announcements"] = [];
  if (shouldShowAnnouncements({
    mustChangePassword: session?.user?.mustChangePassword === true,
    policyAcknowledged: !policyPending,
  })) {
    try {
      const pending = await getMyPendingAnnouncements();
      announcements = pending.data.announcements;
    } catch (err) {
      console.error("Duyurular yüklenemedi:", err);
    }
  }

  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-dvh bg-gray-50">
        <ThemeProvider>
          <AppleWebAppMeta />
          <SwRegister />
          <SchoolWatermark />
          <TouchSeenObserver />
          <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
            <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-3 px-4">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-base font-extrabold tracking-tight text-gray-900">
                  Akademik Takip
                </span>
                <p className="truncate text-xs font-medium text-gray-500">
                  {userName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                <NotificationStatusIcon />
                <AccountMenu userName={userName} />
              </div>
            </div>
          </header>
          {children}
          {announcements.length > 0 ? (
            <AnnouncementDialog initialAnnouncements={announcements} />
          ) : null}
        </ThemeProvider>
      </body>
    </html>
  );
}