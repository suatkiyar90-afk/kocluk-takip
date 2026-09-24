import Link from "next/link";
import { Toaster } from "sonner";
import { getStudentWeeklySummary } from "@/app/actions/teacher-actions";
import { getWeeklyReportByStudent } from "@/app/actions/quiz-actions";
import { FeedbackForm } from "@/components/coaching/feedback-form";
import { TeacherQASection } from "@/components/qa/teacher-qa-section";
import { listStudentThreads } from "@/app/actions/qa-actions";
import {
  getStudentCurriculumProgress,
} from "@/app/actions/curriculum-actions";
import { CurriculumProgress } from "@/components/curriculum/curriculum-progress";
import { parseMonday } from "@/lib/week-utils";
import { WeekPicker } from "@/components/ui/week-picker";
import { getStudentMockExams } from "@/app/actions/mock-exam-actions";
import { MockExamHistory } from "@/components/exams/mock-exam-history";
import { TopicAnalysis } from "@/components/reports/topic-analysis";
import { netScore } from "@/components/quiz-entry/weekly-quiz-schema";

const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatNet(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
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
  const report = reportResult.success === true ? reportResult.data : null;
  const reportError =
    reportResult.success === false ? reportResult.message : null;

  const totalCorrect = report
    ? report.days.reduce((sum, day) => sum + day.correct, 0)
    : 0;
  const totalWrong = report
    ? report.days.reduce((sum, day) => sum + day.wrong, 0)
    : 0;
  const totalBlank = report
    ? report.days.reduce((sum, day) => sum + day.blank, 0)
    : 0;
  const totalSolved = totalCorrect + totalWrong + totalBlank;
  const totalNet = Math.round(netScore(totalCorrect, totalWrong) * 100) / 100;
  const weeklyTarget = student.weeklyTarget;
  const targetPct =
    weeklyTarget > 0 ? Math.round((totalSolved / weeklyTarget) * 100) : null;
  const remaining = Math.max(weeklyTarget - totalSolved, 0);
  const maxDaySolved = report
    ? Math.max(...report.days.map((day) => day.solved), 1)
    : 1;
  const targetReached = targetPct !== null && targetPct >= 100;

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

        <div className="mb-6">
          <WeekPicker monday={weekStart} />
        </div>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
            Haftalık Özet
          </h2>
          {reportError !== null ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {reportError}
            </div>
          ) : report !== null ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Çözülen
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {totalSolved}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Doğru / Yanlış
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    <span className="text-green-700">{totalCorrect}</span>
                    <span className="mx-1 text-gray-300">/</span>
                    <span className="text-red-600">{totalWrong}</span>
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Net
                  </p>
                  <p className="mt-1 text-lg font-bold text-indigo-700">
                    {formatNet(totalNet)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-gray-500">Haftalık Hedef</span>
                  <span className="text-gray-900">
                    {totalSolved} / {weeklyTarget} soru
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-[width] ${
                      targetReached ? "bg-green-500" : "bg-indigo-500"
                    }`}
                    style={{
                      width: `${Math.min(targetPct !== null ? targetPct : 0, 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-gray-500">
                  {weeklyTarget <= 0
                    ? "Haftalık hedef tanımlanmamış."
                    : targetReached
                      ? `Haftalık hedef tamamlandı (%${targetPct}).`
                      : `Hedefin %${targetPct ?? 0} tamamlandı · ${remaining} soru kaldı.`}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {report.days.map((day) => {
                  const dow = new Date(`${day.date}T00:00:00`).getDay();
                  const heightPct =
                    day.solved > 0
                      ? Math.max((day.solved / maxDaySolved) * 100, 10)
                      : 0;
                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className="flex h-14 w-full items-end justify-center rounded-lg bg-gray-50 p-0.5">
                        <div
                          className={`w-full rounded-md ${
                            day.solved > 0 ? "bg-indigo-500" : "bg-transparent"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400">
                        {DAY_LABELS[dow]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {totalSolved === 0 && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700">
                  Bu hafta için henüz günlük soru kaydı girilmemiş.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
            Konu Bazlı Analiz
          </h2>
          {reportError !== null ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {reportError}
            </div>
          ) : report !== null ? (
            <TopicAnalysis key={weekStart} topics={report.byTopic} />
          ) : null}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
            Deneme Sınavı Geçmişi
          </h2>
          {examsResult.success === false ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {examsResult.message}
            </div>
          ) : (
            <MockExamHistory records={examsResult.data} />
          )}
        </section>

        <section className="mt-6">
          {qaResult.success === false ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {qaResult.message}
            </div>
          ) : (
            <TeacherQASection
              studentId={student.id}
              initialThreads={qaResult.data}
            />
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
            Müfredat İlerlemesi
          </h2>
          {curriculumResult.success === false ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {curriculumResult.message}
            </div>
          ) : (
            <CurriculumProgress snapshot={curriculumResult.data} />
          )}
        </section>

        <div className="mt-8">
          <FeedbackForm
            key={weekStart}
            studentId={student.id}
            initialComment={feedback?.comment}
            weekStart={weekStart}
          />
        </div>
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
