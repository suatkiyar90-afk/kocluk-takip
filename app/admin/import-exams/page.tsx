import Link from "next/link";
import { Toaster } from "sonner";
import { ImportExamsForm } from "@/components/admin/import-exams-form";

export const metadata = {
  title: "Deneme Sınavı Yükle | Koçluk Takip",
};

export default function AdminImportExamsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/admin"
          className="text-sm font-semibold text-indigo-600"
        >
          ← Yönetici Paneli
        </Link>
        <header className="mt-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Deneme Sınavı Sonucu Yükle
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Edesis gibi kurumlardan gelen Excel/CSV sonuç dosyalarını öğrenci
            numarası üzerinden topluca içe aktarın.
          </p>
        </header>

        <ImportExamsForm />
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}