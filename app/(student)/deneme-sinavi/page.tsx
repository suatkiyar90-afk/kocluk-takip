import { Toaster } from "sonner";
import { getMyMockExams } from "@/app/actions/mock-exam-actions";
import { StudentNav } from "@/components/student/student-nav";
import { MockExamHistory } from "@/components/exams/mock-exam-history";

export const metadata = {
  title: "Deneme Sınavı Geçmişi | Koçluk Takip",
};

export default async function DenemeSinaviPage() {
  const result = await getMyMockExams();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <StudentNav />
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Deneme Sınavı Geçmişi
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Okulunun yüklediği deneme sınavı sonuçların burada listelenir.
          </p>
        </header>

        {result.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        ) : (
          <MockExamHistory records={result.data} />
        )}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}