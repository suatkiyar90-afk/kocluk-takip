"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { QuizPanel } from "@/components/student/panels/quiz-panel";
import { WeeklyTargetsPanel } from "@/components/student/panels/weekly-targets-panel";
import { ExamsPanel } from "@/components/student/panels/exams-panel";
import { CurriculumPanel } from "@/components/student/panels/curriculum-panel";
import { QAPanel } from "@/components/student/panels/qa-panel";
import { StudentStatisticsTab } from "@/components/student/student-statistics";

const TABS = [
  { id: "quiz", label: "Günlük Giriş" },
  { id: "targets", label: "Hedeflerim" },
  { id: "exams", label: "Denemeler" },
  { id: "curriculum", label: "Müfredat" },
  { id: "qa", label: "Soru Sor" },
  { id: "stats", label: "İstatistikler" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

interface StudentPanelProps {
  studentId: string;
}

export function StudentPanel({ studentId }: StudentPanelProps) {
  const [tab, setTab] = useState<TabId>("quiz");
  const [mounted, setMounted] = useState<Set<TabId>>(
    () => new Set<TabId>(["quiz"]),
  );

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("student-tab");
      if (stored && isTabId(stored)) {
        setTab(stored);
        setMounted((prev) => new Set(prev).add(stored));
      }
      if (stored) sessionStorage.removeItem("student-tab");
    } catch {
      // sessionStorage yoksa varsayılan sekmede kal
    }
  }, []);

  function selectTab(id: TabId) {
    setTab(id);
    setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <nav
          aria-label="Panel sekmeleri"
          className="mb-6 flex w-full flex-nowrap items-center justify-start space-x-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 pb-2 shadow-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => selectTab(item.id)}
                className={`flex-shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition touch-manipulation ${
                  active
                    ? "bg-indigo-600 text-white shadow"
                    : "text-gray-500 hover:text-indigo-600"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {mounted.has("quiz") ? (
          <div hidden={tab !== "quiz"}>
            <QuizPanel />
          </div>
        ) : null}
        {mounted.has("targets") ? (
          <div hidden={tab !== "targets"}>
            <WeeklyTargetsPanel />
          </div>
        ) : null}
        {mounted.has("exams") ? (
          <div hidden={tab !== "exams"}>
            <ExamsPanel />
          </div>
        ) : null}
        {mounted.has("curriculum") ? (
          <div hidden={tab !== "curriculum"}>
            <CurriculumPanel />
          </div>
        ) : null}
        {mounted.has("qa") ? (
          <div hidden={tab !== "qa"}>
            <QAPanel />
          </div>
        ) : null}
        {mounted.has("stats") ? (
          <div hidden={tab !== "stats"}>
            <header className="mb-4">
              <h1 className="text-xl font-bold text-gray-900">İstatistikler</h1>
              <p className="mt-1 text-sm text-gray-500">
                Ders bazında çözdüğün soru sayıları: son 1 hafta, son 1 ay ve tüm
                zamanlar.
              </p>
            </header>
            <StudentStatisticsTab studentId={studentId} active={tab === "stats"} />
          </div>
        ) : null}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
