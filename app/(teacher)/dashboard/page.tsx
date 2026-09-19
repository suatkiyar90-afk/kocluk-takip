import Link from "next/link";
import { Toaster } from "sonner";
import { getAssignedStudents } from "@/app/actions/teacher-actions";
import { getCurrentWeekMonday } from "@/lib/week-utils";

function formatDate(iso: string, withYear = true): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase("tr-TR") || "?"
  );
}

export default async function TeacherDashboardPage() {
  const result = await getAssignedStudents();
  const weekStart = getCurrentWeekMonday();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Koç Paneli</h1>
          <p className="mt-1 text-sm text-gray-500">
            Öğrencilerim — Bu hafta ({formatDate(weekStart)})
          </p>
        </header>

        {result.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        ) : result.data.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-900">
              Henüz atanmış öğrenci yok
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Sorumlu olduğunuz öğrenciler burada listelenecek.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((student) => (
              <li key={student.studentId}>
                <Link
                  href={`/students/${student.studentId}`}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition active:scale-[0.99] touch-manipulation"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-bold text-indigo-700">
                    {initials(student.studentName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {student.studentName}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          student.hasEntriesThisWeek
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {student.hasEntriesThisWeek
                          ? "Veri girildi"
                          : "Veri yok"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span
                        className={`font-bold ${
                          student.weekTotalQuestions > 0
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      >
                        {student.weekTotalQuestions} soru
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="font-semibold text-indigo-700">
                        Net:{" "}
                        {student.weekNet.toLocaleString("tr-TR", {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}