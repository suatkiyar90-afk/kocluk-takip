import Link from "next/link";
import {
  getRecentDataEntries,
  getRecentLogins,
  getRecentTeacherActivities,
  getTodayInactivity,
} from "@/app/actions/admin-actions";
import type { RecentLogin, RecentTeacherActivity } from "@/app/actions/admin-actions";
import { groupConsecutiveActivities } from "@/lib/activity-group";
import { formatTimeAgo } from "@/lib/time-ago";
import { ActivitiesAutoRefresh } from "./auto-refresh";
import { InactiveUserList } from "./inactive-user-list";

export const metadata = {
  title: "Sistem Aktiviteleri | Akademik Takip",
};

type TabKey = "students" | "teachers";

function roleBadgeClass(roleLabel: string): string {
  if (roleLabel === "Yönetici") {
    return "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600";
  }
  if (roleLabel === "Öğretmen") {
    return "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600";
  }
  return "rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600";
}

function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
        {lines.map((line) => (
          <li key={line} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
      {message}
    </p>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
      {message}
    </p>
  );
}

const tableHeadClass =
  "border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";

function LoginsTable({
  logins,
  showRole,
}: {
  logins: RecentLogin[];
  showRole: boolean;
}) {
  if (logins.length === 0) {
    return <EmptyBox message="Henüz görülen kullanıcı yok." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={tableHeadClass}>Ad Soyad</th>
            {showRole ? <th className={tableHeadClass}>Rol</th> : null}
            <th className={tableHeadClass}>Son Görülme</th>
          </tr>
        </thead>
        <tbody>
          {logins.map((login) => (
            <tr
              key={login.id}
              className="border-b border-gray-100 last:border-0"
            >
              <td className="px-3 py-2.5 font-semibold text-gray-900">
                {login.name}
              </td>
              {showRole ? (
                <td className="px-3 py-2.5">
                  <span className={roleBadgeClass(login.roleLabel)}>
                    {login.roleLabel}
                  </span>
                </td>
              ) : null}
              <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                {formatTimeAgo(login.lastActiveAt)}
                {login.lastLoginAt ? (
                  <span className="ml-2 text-xs text-gray-400">
                    son şifreli giriş: {formatTimeAgo(login.lastLoginAt)}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: TabKey = params?.tab === "teachers" ? "teachers" : "students";

  const [loginsResult, entriesResult, activityResult, inactivityResult] =
    await Promise.all([
      getRecentLogins(),
      tab === "students" ? getRecentDataEntries() : Promise.resolve(null),
      tab === "teachers" ? getRecentTeacherActivities() : Promise.resolve(null),
      getTodayInactivity(),
    ]);

  const inactivity = inactivityResult.success ? inactivityResult.data : null;
  const summary = inactivity ? inactivity.summary : null;

  const logins =
    loginsResult.success ? loginsResult.data.logins : ([] as RecentLogin[]);
  const studentLogins = logins.filter((login) => login.role === "student");
  const staffLogins = logins.filter((login) => login.role !== "student");

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Sistem Aktiviteleri
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Bugünün özeti, yapmayanlar ve son işlemler. Sayfa 30 saniyede bir
              otomatik yenilenir.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 text-sm font-bold text-indigo-700 transition active:scale-[0.98] touch-manipulation"
          >
            Panele Dön
          </Link>
        </header>

        {summary ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              title="Öğrenciler"
              lines={[
                `${summary.studentOpenedToday}/${summary.studentTotal} bugün açtı`,
                `${summary.studentDataEnteredToday}/${summary.studentTotal} veri girdi`,
              ]}
            />
            <SummaryCard
              title="Öğretmenler"
              lines={[
                `${summary.teacherOpenedToday}/${summary.teacherTotal} bugün açtı`,
                `${summary.teacherActionedToday}/${summary.teacherTotal} işlem yaptı`,
              ]}
            />
          </div>
        ) : inactivityResult.success === false ? (
          <ErrorBox message={inactivityResult.message} />
        ) : null}

        <div
          className="flex gap-2"
          role="tablist"
          aria-label="Aktivite sekmeleri"
        >
          {(["students", "teachers"] as const).map((key) => (
            <Link
              key={key}
              href={`/admin/activities?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={`flex h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold transition touch-manipulation ${
                tab === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-gray-600"
              }`}
            >
              {key === "students" ? "Öğrenciler" : "Öğretmenler"}
            </Link>
          ))}
        </div>

        {tab === "students" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <CardShell
              title="Bugün giriş yapmayanlar"
              subtitle="Bugün sistemi açmayan öğrenciler"
            >
              {inactivity ? (
                <InactiveUserList
                  rows={inactivity.inactiveStudents}
                  showTeacher
                  showLastSeen
                  emptyText="Bugün giriş yapmayan yok."
                />
              ) : (
                <EmptyBox message="Veri yüklenemedi." />
              )}
            </CardShell>

            <CardShell
              title="Bugün veri girmeyenler"
              subtitle="Bugün soru kaydı girmeyen öğrenciler"
            >
              {inactivity ? (
                <InactiveUserList
                  rows={inactivity.studentsWithoutData}
                  showTeacher
                  emptyText="Bugün veri girmeyen yok."
                />
              ) : (
                <EmptyBox message="Veri yüklenemedi." />
              )}
            </CardShell>

            <CardShell
              title="Son Görülenler"
              subtitle="Son görülen öğrenciler (şifreli giriş dahil)"
            >
              {loginsResult.success === false ? (
                <ErrorBox message={loginsResult.message} />
              ) : (
                <LoginsTable logins={studentLogins} showRole={false} />
              )}
            </CardShell>

            <CardShell
              title="Son Veri Girişleri"
              subtitle="Son 20 soru kaydı (yeniden eskiye)"
            >
              {entriesResult === null ? null : entriesResult.success ===
                false ? (
                <ErrorBox message={entriesResult.message} />
              ) : entriesResult.data.entries.length === 0 ? (
                <EmptyBox message="Henüz veri girişi yok." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={tableHeadClass}>Öğrenci</th>
                        <th className={tableHeadClass}>Kayıt</th>
                        <th className={tableHeadClass}>Zaman</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entriesResult.data.entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="px-3 py-2.5 font-semibold text-gray-900">
                            {entry.studentName}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {entry.examType} {entry.subjectName}{" "}
                            <span className="whitespace-nowrap font-semibold text-indigo-700">
                              ({entry.totalSolved} Soru)
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                            {formatTimeAgo(entry.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardShell>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <CardShell
              title="Bugün işlem yapmayanlar"
              subtitle="Bugün dönüt, hedef, cevap, deneme veya duyuru işlemi yapmayan öğretmenler"
            >
              {inactivity ? (
                <InactiveUserList
                  rows={inactivity.teachersWithoutActivity}
                  showLastSeen
                  emptyText="Bugün işlem yapmayan yok."
                />
              ) : (
                <EmptyBox message="Veri yüklenemedi." />
              )}
            </CardShell>

            <CardShell
              title="Bugün açmayanlar"
              subtitle="Bugün sistemi açmayan öğretmenler"
            >
              {inactivity ? (
                <InactiveUserList
                  rows={inactivity.inactiveTeachers}
                  showLastSeen
                  emptyText="Bugün açmayan öğretmen yok."
                />
              ) : (
                <EmptyBox message="Veri yüklenemedi." />
              )}
            </CardShell>

            <CardShell
              title="Son Görülenler"
              subtitle="Son görülen yönetici ve öğretmenler (şifreli giriş dahil)"
            >
              {loginsResult.success === false ? (
                <ErrorBox message={loginsResult.message} />
              ) : (
                <LoginsTable logins={staffLogins} showRole />
              )}
            </CardShell>

            <CardShell
              title="Son İşlemler"
              subtitle="Son 30 öğretmen işlemi (yeniden eskiye, ardışık tekrarlar tek satırda)"
            >
              {activityResult === null ? null : activityResult.success ===
                false ? (
                <ErrorBox message={activityResult.message} />
              ) : activityResult.data.activities.length === 0 ? (
                <EmptyBox message="Henüz kayıtlı işlem yok." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={tableHeadClass}>Öğretmen</th>
                        <th className={tableHeadClass}>İşlem</th>
                        <th className={tableHeadClass}>Öğrenci</th>
                        <th className={tableHeadClass}>Zaman</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupConsecutiveActivities<RecentTeacherActivity>(
                        activityResult.data.activities,
                      ).map((group) => {
                        const activity = group.items[0];
                        return (
                          <tr
                            key={activity.id}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="px-3 py-2.5 font-semibold text-gray-900">
                              {activity.actorName}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {activity.actionLabel}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {activity.studentName ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                              {formatTimeAgo(activity.createdAt)}
                              {group.count > 1 ? (
                                <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-500">
                                  ×{group.count}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardShell>
          </div>
        )}
      </div>
      <ActivitiesAutoRefresh />
    </main>
  );
}
