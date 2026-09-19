import type { StudentOverviewData } from "@/app/actions/weekly-quiz-actions";

function formatNet(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WeeklyOverviewCard({ data }: { data: StudentOverviewData }) {
  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-indigo-50 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
            TYT Net
          </p>
          <p className="mt-1 text-lg font-bold text-indigo-700">
            {formatNet(data.totals.tytNet)}
          </p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
            AYT Net
          </p>
          <p className="mt-1 text-lg font-bold text-indigo-700">
            {formatNet(data.totals.aytNet)}
          </p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
            Soru
          </p>
          <p className="mt-1 text-lg font-bold text-indigo-700">
            {data.totals.solved}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
          Öğretmen Dönütü
        </h2>
        {data.feedback.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">
            Bu hafta için öğretmeniniz henüz dönüt yazmadı.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.feedback.map((f) => (
              <li
                key={`${f.teacherId}:${f.createdAt}`}
                className="rounded-xl bg-gray-50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {f.teacherName}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {formatDate(f.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">
                  {f.comment}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}