import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { listPendingQuestions } from "@/app/actions/qa-actions";

function formatWaiting(iso: string): string {
  const hours = Math.max(
    1,
    Math.floor((Date.now() - Date.parse(iso)) / 3_600_000),
  );
  if (hours < 24) return `${hours} saattir bekliyor`;
  return `${Math.floor(hours / 24)} gündür bekliyor`;
}

function formatAskedAt(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PendingQuestionsPage() {
  const result = await listPendingQuestions();

  return (
    <main className="min-h-dvh bg-gray-50 px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className="mx-auto w-full max-w-md md:max-w-3xl xl:max-w-5xl">
        <header className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">
            Bekleyen Sorular
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {result.success === true
              ? `${result.data.length} soru cevabını bekliyor. En eskisi üstte.`
              : "Cevap bekleyen sorular listelenir."}
          </p>
        </header>

        {result.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        ) : result.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <MessageCircleQuestion
              aria-hidden="true"
              className="h-7 w-7 text-gray-400"
            />
            <p className="text-sm font-semibold text-gray-500">
              Cevap bekleyen soru yok
            </p>
            <p className="max-w-xs text-xs text-gray-400">
              Öğrencilerin yeni soru gönderdiğinde burada listelenecek ve
              bildirim alacaksın.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.data.map((question) => (
              <li key={question.id}>
                <Link
                  href={`/students/${question.studentId}?tab=qa`}
                  className="flex min-h-[4.5rem] w-full gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition active:scale-[0.99] touch-manipulation"
                >
                  <img
                    src={question.questionImageUrl}
                    alt={`${question.studentName} sorusu önizleme`}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-xl bg-gray-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-bold text-gray-900">
                        {question.studentName}
                      </p>
                      <span
                        suppressHydrationWarning
                        className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700"
                      >
                        {formatWaiting(question.createdAt)}
                      </span>
                    </div>
                    {question.studentNote ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed break-words text-gray-600">
                        {question.studentNote}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-400">
                        Not eklenmemiş.
                      </p>
                    )}
                    <p
                      suppressHydrationWarning
                      className="mt-1.5 text-[11px] font-medium text-gray-400"
                    >
                      Soruldu: {formatAskedAt(question.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
