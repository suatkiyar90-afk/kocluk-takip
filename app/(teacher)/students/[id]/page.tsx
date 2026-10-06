import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "sonner";
import { auth } from "@/auth";
import { getStudentWeeklySummary } from "@/app/actions/teacher-actions";
import { getWeeklyReportByStudent } from "@/app/actions/quiz-actions";
import { listStudentThreads } from "@/app/actions/qa-actions";
import { getStudentCurriculumProgress } from "@/app/actions/curriculum-actions";
import { getStudentMockExams } from "@/app/actions/mock-exam-actions";
import {
  getWeeklyDenemeBundle,
  listWeeklyTargets,
} from "@/app/actions/weekly-target-actions";
import { parseMonday } from "@/lib/week-utils";
import { normalizeStudentDetailTab } from "@/lib/student-detail-tabs";
import { StudentDetailTabs } from "@/components/reports/student-detail-tabs";

function formatWeekShort(iso: string): string {
  const start = new Date(`${iso}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const opts = { day: "numeric", month: "short" } as const;
  return `${start.toLocaleDateString("tr-TR", opts)} – ${end.toLocaleDateString("tr-TR", opts)}`;
}

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ week?: string; tab?: string }>;
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: StudentDetailPageProps) {
  const { id } = await params;
  const resolvedParams = searchParams ? await searchParams : undefined;
  const weekStart = parseMonday(resolvedParams?.week);
  const initialTab = normalizeStudentDetailTab(resolvedParams?.tab);
  const session = await auth();

  const result = await getStudentWeeklySummary(id, weekStart);
  const reportResult = await getWeeklyReportByStudent(id, weekStart);
  const qaResult = await listStudentThreads(id);
  const curriculumResult = await getStudentCurriculumProgress(id);
  const examsResult = await getStudentMockExams(id);
  const targetsResult = await listWeeklyTargets(id, weekStart);
  const denemeBundleResult = await getWeeklyDenemeBundle(id, weekStart);

  if (result.success === false) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-indigo-600"
          >
            ← Öğrencilerim
          </Link>
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        </div>
      </main>
    );
  }

  const { student, feedback } = result.data;

  return (
    <main className="min-h-dvh bg-gray-50 px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md md:max-w-3xl xl:max-w-5xl">
        <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-gray-200 bg-gray-50/95 px-4 py-1.5 backdrop-blur print:hidden">
          <Link
            href="/dashboard"
            aria-label="Öğrencilerim"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 active:scale-95 touch-manipulation"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold text-gray-900">
            {student.name}
          </h1>
          <p className="shrink-0 text-[11px] font-semibold text-gray-400">
            {formatWeekShort(weekStart)}
          </p>
        </div>

        <StudentDetailTabs
          weekStart={weekStart}
          studentId={student.id}
          initialComment={feedback?.comment}
          initialTab={initialTab}
          reportResult={reportResult}
          examsResult={examsResult}
          targetsResult={targetsResult}
          denemeBundleResult={denemeBundleResult}
          curriculumResult={curriculumResult}
          qaResult={qaResult}
          actorName={session?.user?.name ?? ""}
          schoolName={process.env.SCHOOL_NAME ?? "Koçluk Takip Sistemi"}
        />
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
