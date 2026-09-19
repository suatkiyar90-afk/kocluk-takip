import { Toaster } from "sonner";
import { listMyQuestions } from "@/app/actions/qa-actions";
import { StudentNav } from "@/components/student/student-nav";
import { AskClient } from "./ask-client";

export const metadata = {
  title: "Öğretmene Soru Gönder",
};

export default async function AskPage() {
  const result = await listMyQuestions();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <StudentNav />
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Öğretmene Soru Gönder
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Çözemediğin sorunun fotoğrafını çek, notunu ekle; öğretmenin yanıtlasın.
          </p>
        </header>

        {result.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        ) : (
          <AskClient initialThreads={result.data} />
        )}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}