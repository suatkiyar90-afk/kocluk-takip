"use client";

import { useEffect, useState } from "react";
import { listMyQuestions } from "@/app/actions/qa-actions";
import { AskClient } from "@/app/(student)/ask/ask-client";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";

type QuestionsResult = Awaited<ReturnType<typeof listMyQuestions>>;

export function QAPanel() {
  const [result, setResult] = useState<QuestionsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listMyQuestions();
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
          Öğretmene Soru Gönder
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Çözemediğin sorunun fotoğrafını çek, notunu ekle; öğretmenin
          yanıtlasın.
        </p>
      </header>

      {result === null ? (
        <PanelSkeleton rows={5} />
      ) : result.success === false ? (
        <PanelError message={result.message} />
      ) : (
        <AskClient initialThreads={result.data} />
      )}
    </>
  );
}
