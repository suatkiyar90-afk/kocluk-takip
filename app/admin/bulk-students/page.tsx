import Link from "next/link";
import { Toaster } from "sonner";
import { BulkStudentsForm } from "@/components/admin/bulk-students-form";

export const metadata = {
  title: "Toplu Öğrenci Ekle | Akademik Takip",
};

export default function AdminBulkStudentsPage() {
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
            Toplu Öğrenci Ekle
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Excel/CSV dosyasındaki &quot;Ad Soyad&quot; ve &quot;Öğrenci No&quot;
            sütunlarıyla öğrenci hesaplarını topluca oluşturun.
          </p>
        </header>

        <BulkStudentsForm />
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
