import Link from "next/link";
import { Toaster } from "sonner";
import { getStudentWeeklySummary } from "@/app/actions/teacher-actions";
import { getWeeklyReportByStudent } from "@/app/actions/quiz-actions";
import { listStudentThreads } from "@/app/actions/qa-actions";
import { getStudentCurriculumProgress } from "@/app/actions/curriculum-actions";
import { getStudentMockExams } from "@/app/actions/mock-exam-actions";
import { parseMonday } from "@/lib/week-utils";
import { StudentDetailTabs } from "@/components/reports/student-detail-tabs";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ week?: string }>;
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: StudentDetailPageProps) {
  const { id } = await params;
  const resolvedParams = searchParams ? await searchParams : undefined;
  const weekStart = parseMonday(resolvedParams?.week);

  const result = await getStudentWeeklySummary(id, weekStart);
  const reportResult = await getWeeklyReportByStudent(id, weekStart);
  const qaResult = await listStudentThreads(id);
  const curriculumResult = await getStudentCurriculumProgress(id);
  const examsResult = await getStudentMockExams(id);

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
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-indigo-600"
        >
          ← Öğrencilerim
        </Link>

        <header className="mt-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {student.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Hafta: {formatDate(weekStart)}
          </p>
        </header>

        <StudentDetailTabs
          weekStart={weekStart}
          studentId={student.id}
          weeklyTarget={student.weeklyTarget}
          initialComment={feedback?.comment}
          reportResult={reportResult}
          examsResult={examsResult}
          curriculumResult={curriculumResult}
          qaResult={qaResult}
        />
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
