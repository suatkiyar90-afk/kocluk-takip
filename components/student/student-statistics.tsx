"use client";

import { useEffect, useState } from "react";
import {
  getStudentStatistics,
  type SubjectStatistics,
} from "@/app/actions/quiz-actions";

interface StudentStatisticsTabProps {
  studentId: string;
}

export function StudentStatisticsTab({ studentId }: StudentStatisticsTabProps) {
  const [rows, setRows] = useState<SubjectStatistics[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getStudentStatistics(studentId);
      if (cancelled) return;
      if (result.success === true) {
        setRows(result.data);
        setError("");
      } else {
        setError(result.message);
        setRows(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const totals = rows
    ? rows.reduce(
        (acc, r) => ({
          lastWeekTotal: acc.lastWeekTotal + r.lastWeekTotal,
          lastMonthTotal: acc.lastMonthTotal + r.lastMonthTotal,
          allTimeTotal: acc.allTimeTotal + r.allTimeTotal,
        }),
        { lastWeekTotal: 0, lastMonthTotal: 0, allTimeTotal: 0 },
      )
    : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3.5">
        <h2 className="text-sm font-bold text-gray-900">Ders Bazında İstatistik</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Çözdüğün toplam soru sayıları (doğru + yanlış + boş).
        </p>
      </div>

      {error ? (
        <div className="p-4 text-sm font-medium text-red-600">{error}</div>
      ) : rows === null ? (
        <div className="p-4 text-sm font-medium text-gray-500">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="p-4 text-sm font-medium text-gray-500">
          Henüz soru girişi bulunmuyor. Günlük giriş ekranından çözdüğün soruları
          kaydettiğinde istatistiklerin burada görünecek.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left font-bold">Ders</th>
                <th className="px-4 py-3 text-right font-bold whitespace-nowrap">
                  Son 1 Hafta
                </th>
                <th className="px-4 py-3 text-right font-bold whitespace-nowrap">
                  Son 1 Ay
                </th>
                <th className="px-4 py-3 text-right font-bold whitespace-nowrap">
                  Tüm Zamanlar
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.subjectId}
                  className="border-t border-gray-100 transition hover:bg-gray-50/60"
                >
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                    {row.subjectName}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {row.lastWeekTotal}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {row.lastMonthTotal}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">
                    {row.allTimeTotal}
                  </td>
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-indigo-50/60">
                  <td className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-indigo-700">
                    Toplam
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-indigo-900">
                    {totals.lastWeekTotal}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-indigo-900">
                    {totals.lastMonthTotal}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-indigo-900">
                    {totals.allTimeTotal}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}
