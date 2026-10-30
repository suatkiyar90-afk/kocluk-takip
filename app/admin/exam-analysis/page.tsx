import Link from "next/link";
import { Toaster } from "sonner";
import { ExamAnalysisManager } from "@/components/admin/exam-analysis-manager";

export const metadata = {
  title: "Deneme Analizi Yükle | Akademik Takip",
};

export default function AdminExamAnalysisPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="text-sm font-semibold text-indigo-600">
          ← Yönetici Paneli
        </Link>
        <header className="mt-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Deneme Analizi Yükle
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Birleştirilmiş Karne ve Öncelikli Konu Listesi dosyalarını
            birleştirerek aylık bireysel öğrenci analiz dönemleri oluşturun.
          </p>
        </header>

        <ExamAnalysisManager />
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
