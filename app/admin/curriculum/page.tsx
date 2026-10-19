import Link from "next/link";
import { Toaster } from "sonner";
import { adminListCurriculumTopics } from "@/app/actions/curriculum-actions";
import { CurriculumPanel } from "@/components/admin/curriculum-panel";
import { ALL_SUBJECTS } from "@/components/quiz-entry/weekly-quiz-schema";

export const metadata = {
  title: "Müfredat Yönetimi | Akademik Takip",
};

export default async function AdminCurriculumPage() {
  const defaultSubjectId = ALL_SUBJECTS.TYT[0]?.id ?? "";
  const result = await adminListCurriculumTopics({
    examType: "TYT",
    subjectId: defaultSubjectId,
  });

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/admin" className="text-sm font-semibold text-indigo-600">
          ← Yönetici Paneli
        </Link>
        <header className="mt-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">Müfredat Yönetimi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Konu ekleyin, adını veya sırasını düzenleyin. Bir konuyu silmeniz
            gerektiğinde bağlı soru kayıtları hedef konuya aktarılarak korunur.
          </p>
        </header>

        {result.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        ) : (
          <CurriculumPanel initialList={result.data} />
        )}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
