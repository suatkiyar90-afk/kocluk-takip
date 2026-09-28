"use client";

import { useEffect, useState } from "react";
import { getMyCurriculum } from "@/app/actions/curriculum-actions";
import { MufredatClient } from "@/app/(student)/mufredat/mufredat-client";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";

type CurriculumResult = Awaited<ReturnType<typeof getMyCurriculum>>;

export function CurriculumPanel() {
  const [result, setResult] = useState<CurriculumResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getMyCurriculum();
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
        <h1 className="text-xl font-bold text-gray-900">Müfredat Takip</h1>
        <p className="mt-1 text-sm text-gray-500">
          Konuları işleme durumuna göre güncelle: başlamadı, çalışılıyor veya
          bitti.
        </p>
      </header>

      {result === null ? (
        <PanelSkeleton rows={8} />
      ) : result.success === false ? (
        <PanelError message={result.message} />
      ) : (
        <MufredatClient snapshot={result.data} />
      )}
    </>
  );
}
