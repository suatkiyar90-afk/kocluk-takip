"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getMyMockExams } from "@/app/actions/mock-exam-actions";
import {
  getMyDenemeAttempts,
  type DenemeAttemptsResult,
} from "@/app/actions/quiz-actions";
import { MockExamHistory } from "@/components/exams/mock-exam-history";
import { MyDenemeAttempts } from "@/components/exams/my-deneme-attempts";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";
import { ChartSkeleton } from "@/components/charts/chart-ui";

const ExamCharts = dynamic(() => import("@/components/charts/exam-charts"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

type ExamsResult = Awaited<ReturnType<typeof getMyMockExams>>;

export function ExamsPanel() {
  const [result, setResult] = useState<ExamsResult | null>(null);
  const [denemeResult, setDenemeResult] = useState<DenemeAttemptsResult | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [res, denemeRes] = await Promise.all([
        getMyMockExams(),
        getMyDenemeAttempts(),
      ]);
      if (cancelled) return;
      setResult(res);
      setDenemeResult(denemeRes);
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

      {denemeResult === null ? null : denemeResult.success === false ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {denemeResult.message}
        </div>
      ) : (
        <MyDenemeAttempts
          rows={denemeResult.data}
          title="Kendi Denemelerim"
          subtitle="Kendin çözdüğün denemeler (son 10)"
        />
      )}
    </>
  );
}
