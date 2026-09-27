import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { auth } from "@/auth";
import { StudentNav } from "@/components/student/student-nav";
import { StudentStatisticsTab } from "@/components/student/student-statistics";

export const metadata = {
  title: "İstatistikler | Koçluk Takip",
};

export default async function StatisticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "student") redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10">
      <StudentNav />

      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">İstatistikler</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ders bazında çözdüğün soru sayıları: son 1 hafta, son 1 ay ve tüm
          zamanlar.
        </p>
      </header>

      <StudentStatisticsTab studentId={session.user.id} />

      <Toaster position="top-center" richColors />
    </main>
  );
}
