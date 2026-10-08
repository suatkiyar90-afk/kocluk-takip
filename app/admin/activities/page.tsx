import Link from "next/link";
import { getUsersActivityList } from "@/app/actions/admin-actions";
import { ActivitiesAutoRefresh } from "./auto-refresh";
import { ActivityView } from "./activity-view";

export const metadata = {
  title: "Sistem Aktiviteleri | Akademik Takip",
};

export default async function ActivitiesPage() {
  const result = await getUsersActivityList();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Sistem Aktiviteleri
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Kullanıcıları listeleyin; detay için satıra dokunun. Liste 30
              saniyede bir otomatik yenilenir.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 text-sm font-bold text-indigo-700 transition active:scale-[0.98] touch-manipulation"
          >
            Panele Dön
          </Link>
        </header>

        {result.success === false ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
            {result.message}
          </p>
        ) : (
          <ActivityView users={result.data.users} />
        )}
      </div>
      <ActivitiesAutoRefresh />
    </main>
  );
}
