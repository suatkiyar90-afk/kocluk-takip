"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getMyMockExams } from "@/app/actions/mock-exam-actions";
import { MockExamHistory } from "@/components/exams/mock-exam-history";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";
import { ChartSkeleton } from "@/components/charts/chart-ui";

const ExamCharts = dynamic(() => import("@/components/charts/exam-charts"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

type ExamsResult = Awaited<ReturnType<typeof getMyMockExams>>;

export function ExamsPanel() {
  const [result, setResult] = useState<ExamsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getMyMockExams();
      if (cancelled) return;
      setResult(res);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          Deneme Sınavı Geçmişi
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Okulunun yüklediği deneme sınavı sonuçların burada listelenir.
        </p>
      </header>

      {result === null ? (
        <PanelSkeleton rows={6} />
      ) : result.success === false ? (
        <PanelError message={result.message} />
      ) : (
        <div className="space-y-4">
          <ExamCharts records={result.data} />
          <MockExamHistory records={result.data} />
        </div>
      )}
    </>
  );
}
