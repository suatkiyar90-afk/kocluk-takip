import Link from "next/link";
import {
  getRecentDataEntries,
  getRecentLogins,
} from "@/app/actions/admin-actions";
import { formatTimeAgo } from "@/lib/time-ago";
import { ActivitiesAutoRefresh } from "./auto-refresh";

export const metadata = {
  title: "Sistem Aktiviteleri | Akademik Takip",
};

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
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

const tableHeadClass =
  "border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";

export default async function ActivitiesPage() {
  const [loginsResult, entriesResult] = await Promise.all([
    getRecentLogins(),
    getRecentDataEntries(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Sistem Aktiviteleri
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Son girişler ve son soru kayıtları. Sayfa 30 saniyede bir
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

        <div className="grid gap-4 lg:grid-cols-2">
          <CardShell
            title="Son Giriş Yapanlar"
            subtitle="Son 20 kullanıcının giriş zamanı"
          >
            {loginsResult.success === false ? (
              <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                {loginsResult.message}
              </p>
            ) : loginsResult.data.logins.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                Henüz giriş kaydı yok.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={tableHeadClass}>Ad Soyad</th>
                    <th className={tableHeadClass}>Rol</th>
                    <th className={tableHeadClass}>Son Giriş</th>
                  </tr>
                </thead>
                <tbody>
                  {loginsResult.data.logins.map((login) => (
                    <tr
                      key={login.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-3 py-2.5 font-semibold text-gray-900">
                        {login.name}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={roleBadgeClass(login.roleLabel)}>
                          {login.roleLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">
                        {formatTimeAgo(login.lastLoginAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardShell>

          <CardShell
            title="Son Veri Girişleri"
            subtitle="Son 20 soru kaydı (yeniden eskiye)"
          >
            {entriesResult.success === false ? (
              <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                {entriesResult.message}
              </p>
            ) : entriesResult.data.entries.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                Henüz veri girişi yok.
              </p>
            ) : (
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
            )}
          </CardShell>
        </div>
      </div>
      <ActivitiesAutoRefresh />
    </main>
  );
}
