import type { MockExamRecord } from "@/app/actions/mock-exam-actions";

function formatNet(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MockExamHistory({ records }: { records: MockExamRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
        Henüz yüklenmiş bir deneme sınavı sonucu yok.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
            <th className="px-3 py-2.5">Tarih</th>
            <th className="px-3 py-2.5">Deneme Adı</th>
            <th className="px-3 py-2.5 text-right">TYT Net</th>
            <th className="px-3 py-2.5 text-right">AYT Net</th>
            <th className="px-3 py-2.5 text-right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const total = r.tytNet + r.aytNet;
            return (
              <tr
                key={r.id}
                className="border-b border-gray-100 last:border-b-0"
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-500">
                  {formatDate(r.examDate)}
                </td>
                <td className="px-3 py-2.5 font-semibold text-gray-900">
                  {r.examName}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-indigo-700">
                  {formatNet(r.tytNet)}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-indigo-700">
                  {formatNet(r.aytNet)}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                  {formatNet(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}