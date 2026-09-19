import Link from "next/link";
import { Toaster } from "sonner";
import {
  getStudentWeeklySummary,
  type SubjectSummary,
} from "@/app/actions/teacher-actions";
import { FeedbackForm } from "@/components/coaching/feedback-form";
import { TeacherQASection } from "@/components/qa/teacher-qa-section";
import { listStudentThreads } from "@/app/actions/qa-actions";
import {
  getStudentCurriculumProgress,
} from "@/app/actions/curriculum-actions";
import { CurriculumProgress } from "@/components/curriculum/curriculum-progress";

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

function SubjectRow({ s }: { s: SubjectSummary }) {
  const pct = s.maxQuestions > 0 ? (s.solved / s.maxQuestions) * 100 : 0;
  const overTarget = s.maxQuestions > 0 && s.solved > s.maxQuestions;
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">
          {s.subjectName}
        </p>
        <span className="text-xs font-bold text-indigo-700">
          Net: {formatNet(s.net)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
        <span className="text-green-700">D {s.correct}</span>
        <span className="text-red-600">Y {s.wrong}</span>
        <span className="text-stone-500">B {s.blank}</span>
        <span
          className={`ml-auto flex items-center gap-1 ${
            overTarget ? "text-green-700" : "text-gray-400"
          }`}
        >
          {s.solved}/{s.maxQuestions}
          {overTarget && <span title="Hedef aşıldı">✓</span>}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-[width] ${
            overTarget ? "bg-green-500" : "bg-indigo-500"
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] font-medium text-gray-400">
        Hedef: {s.maxQuestions} soru
        {overTarget && " · Hedeften fazla çözüldü"}
      </p>
    </div>
  );
}

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { id } = await params;
  const result = await getStudentWeeklySummary(id);
  const qaResult = await listStudentThreads(id);
  const curriculumResult = await getStudentCurriculumProgress(id);

  if (!result.success) {
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

  const { student, weekStart, subjects, totals, feedback } = result.data;
  const tyt = subjects.filter((s) => s.examType === "TYT");
  const ayt = subjects.filter((s) => s.examType === "AYT");
  const tytNet = tyt.reduce((sum, s) => sum + s.net, 0);
  const aytNet = ayt.reduce((sum, s) => sum + s.net, 0);

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

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              TYT Net
            </p>
            <p className="mt-1 text-base font-bold text-indigo-700">
              {formatNet(tytNet)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              AYT Net
            </p>
            <p className="mt-1 text-base font-bold text-indigo-700">
              {formatNet(aytNet)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Soru
            </p>
            <p className="mt-1 text-base font-bold text-gray-900">
              {totals.solved}
            </p>
          </div>
        </div>

        {totals.solved === 0 ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-700">
            Bu hafta için henüz soru verisi girilmemiş.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                TYT
              </h2>
              <div className="space-y-2">
                {tyt.map((s) => (
                  <SubjectRow key={s.subjectId} s={s} />
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                AYT
              </h2>
              <div className="space-y-2">
                {ayt.map((s) => (
                  <SubjectRow key={s.subjectId} s={s} />
                ))}
              </div>
            </section>
          </div>
        )}

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
            studentId={student.id}
            initialComment={feedback?.comment}
          />
        </div>
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}