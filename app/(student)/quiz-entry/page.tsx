import { Toaster } from "sonner";
import {
  getStudentOverview,
  getThisWeeksEntries,
} from "@/app/actions/weekly-quiz-actions";
import { parseMonday } from "@/lib/week-utils";
import { QuizEntryClient } from "./quiz-entry-client";
import { WeeklyOverviewCard } from "@/components/student/weekly-overview-card";
import { StudentNav } from "@/components/student/student-nav";
import { WeekPicker } from "@/components/ui/week-picker";

interface QuizEntryPageProps {
  searchParams?: Promise<{ week?: string }>;
}

export default async function QuizEntryPage({
  searchParams,
}: QuizEntryPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const weekStart = parseMonday(resolvedParams?.week);

  const [result, overview] = await Promise.all([
    getThisWeeksEntries(weekStart),
    getStudentOverview(weekStart),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <StudentNav />
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Haftalık Soru Takibi
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            TYT ve AYT dersleri için bu hafta çözdüğün soru sayılarını gir.
          </p>
        </header>

        <div className="mb-6">
          <WeekPicker monday={weekStart} />
        </div>

        {overview.success && (
          <div className="mb-6">
            <WeeklyOverviewCard key={weekStart} data={overview.data} />
          </div>
        )}

        {result.success === true ? (
          <QuizEntryClient
            key={weekStart}
            initialEntries={result.data.entries}
            weekStart={result.data.weekStart}
          />
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        )}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}