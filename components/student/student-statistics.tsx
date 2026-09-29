"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  getStudentStatistics,
  getStudentTrends,
  type StudentTrendsData,
  type SubjectStatistics,
} from "@/app/actions/quiz-actions";
import { ChartSkeleton } from "@/components/charts/chart-ui";

const StatisticsCharts = dynamic(
  () => import("@/components/charts/statistics-charts"),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

interface StudentStatisticsTabProps {
  studentId: string;
  active?: boolean;
}

export function StudentStatisticsTab({
  studentId,
  active = true,
}: StudentStatisticsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SubjectStatistics[] | null>(null);
  const [error, setError] = useState("");
  const [trends, setTrends] = useState<StudentTrendsData | null>(null);
  const [trendsError, setTrendsError] = useState("");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!active || loadedRef.current) return;
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      const [result, trendsResult] = await Promise.all([
        getStudentStatistics(studentId),
        getStudentTrends(studentId, 8),
      ]);
      if (cancelled) return;
      if (result.success === true) {
        setData(result.data);
        setError("");
        loadedRef.current = true;
      } else {
        setError(result.message);
      }
      if (trendsResult.success === true) {
        setTrends(trendsResult.data);
        setTrendsError("");
      } else {
        setTrendsError(trendsResult.message);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, studentId]);

  const totals = data
    ? data.reduce(
        (acc, r) => ({
          lastWeekTotal: acc.lastWeekTotal + r.lastWeekTotal,
          lastMonthTotal: acc.lastMonthTotal + r.lastMonthTotal,
          allTimeTotal: acc.allTimeTotal + r.allTimeTotal,
        }),
        { lastWeekTotal: 0, lastMonthTotal: 0, allTimeTotal: 0 },
      )
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3.5">
          <h2 className="text-sm font-bold text-gray-900">
            Ders Bazında İstatistik
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Çözdüğün toplam soru sayıları (doğru + yanlış + boş).
          </p>
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-label="Veriler yükleniyor"
            className="space-y-3 p-4"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              Veriler hesaplanıyor...
            </div>
            <div className="space-y-2.5 pt-1">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ) : error ? (
          <div className="p-4 text-sm font-medium text-red-600">{error}</div>
        ) : data === null || data.length === 0 ? (
          <div className="p-4 text-sm font-medium text-gray-500">
            Henüz soru girişi bulunmuyor. Günlük giriş ekranından çözdüğün
            soruları kaydettiğinde istatistiklerin burada görünecek.
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
                {data.map((row) => (
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

      {error === "" && !isLoading ? (
        trendsError !== "" ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-red-600 shadow-sm">
            {trendsError}
          </div>
        ) : trends !== null ? (
          <StatisticsCharts data={trends} />
        ) : (
          <ChartSkeleton />
        )
      ) : null}
    </div>
  );
}
