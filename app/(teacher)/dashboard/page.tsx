import Link from "next/link";
import { Toaster } from "sonner";
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
  const result = await getAttentionList();
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
          <h1 className="text-xl font-bold text-gray-900">Öğrencilerim</h1>
          <p className="mt-1 text-sm text-gray-500">
            Bu hafta ({formatDate(weekStart)})
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
