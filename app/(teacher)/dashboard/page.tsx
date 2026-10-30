import Link from "next/link";
import { Toaster } from "sonner";
import { auth } from "@/auth";
import { getAttentionList } from "@/app/actions/teacher-actions";
import { getCurrentWeekMonday } from "@/lib/week-utils";
import {
  TeacherDashboard,
  type DashboardFilter,
  type DashboardSort,
} from "@/components/teacher/dashboard-client";
import { AnnouncementFab } from "@/components/teacher/announcement-fab";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface TeacherDashboardPageProps {
  searchParams?: Promise<{ q?: string; filter?: string; sort?: string }>;
}

export default async function TeacherDashboardPage({
  searchParams,
}: TeacherDashboardPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const [result, session] = await Promise.all([
    getAttentionList(),
    auth(),
  ]);
  const isAdmin = session?.user?.role === "admin";
  const weekStart = getCurrentWeekMonday();

  const initialFilter: DashboardFilter =
    params?.filter === "stale" || params?.filter === "waiting"
      ? params.filter
      : "all";
  const initialSort: DashboardSort =
    params?.sort === "week" || params?.sort === "recent"
      ? params.sort
      : "name";

  return (
    <main className="min-h-dvh bg-gray-50 px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className="mx-auto w-full max-w-md md:max-w-3xl xl:max-w-5xl">
        <header className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              {isAdmin ? "🎓 Öğrenci Profilleri (Koçluk Ekranı)" : "Öğrencilerim"}
            </h1>
            {isAdmin ? (
              <Link
                href="/admin"
                className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 touch-manipulation"
              >
                ← Yönetici Paneli
              </Link>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Bu hafta ({formatDate(weekStart)})
            {isAdmin ? " · Tüm öğrenciler" : ""}
          </p>
        </header>

        {result.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        ) : (
          <>
            <TeacherDashboard
              data={result.data}
              initialQ={params?.q ?? ""}
              initialFilter={initialFilter}
              initialSort={initialSort}
              isAdmin={isAdmin}
            />
            <AnnouncementFab
              studentCount={result.data.students.length}
            />
          </>
        )}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
