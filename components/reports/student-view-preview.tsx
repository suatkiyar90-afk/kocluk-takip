"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, Loader2, X } from "lucide-react";
import {
  getWeeklyStudyPlan,
  type WeeklyStudyPlanView,
} from "@/app/actions/study-plan-actions";
import type { CurriculumSnapshot } from "@/app/actions/curriculum-actions";
import { StudentStudyPlan } from "@/components/student/study-plan-view";
import { ExamAnalysisView } from "@/components/exam-analysis/exam-analysis-view";
import { CurriculumProgress } from "@/components/curriculum/curriculum-progress";

type PreviewTab = "plan" | "analysis" | "curriculum";

const TABS: Array<{ id: PreviewTab; label: string }> = [
  { id: "plan", label: "🗓️ Haftalık Çalışma Çizelgesi" },
  { id: "analysis", label: "🎯 Deneme Analizi Karnesi" },
  { id: "curriculum", label: "📚 Müfredat" },
];

interface StudentViewPreviewProps {
  studentId: string;
  studentName: string;
  weekStart: string;
  curriculum: CurriculumSnapshot | null;
}

export function StudentViewPreview({
  studentId,
  studentName,
  weekStart,
  curriculum,
}: StudentViewPreviewProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("plan");
  const [plan, setPlan] = useState<WeeklyStudyPlanView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlan(null);

    void getWeeklyStudyPlan(studentId, weekStart)
      .then((result) => {
        if (cancelled) return;
        if (result.success === true) {
          setPlan(result.data);
        } else {
          setError(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Öğrenci programı yüklenemedi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, studentId, weekStart]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Öğrenci Ekranı Önizlemesi"
          title="Öğrenci Ekranı Önizlemesi"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-2.5 text-[11px] font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[0.98] touch-manipulation"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          <span>Öğrenci Ekranı Önizlemesi</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] w-full flex-col rounded-t-2xl border border-gray-200 bg-white shadow-xl focus:outline-none sm:inset-4 sm:mx-auto sm:h-auto sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-bold text-gray-900">
                👁️ Öğrenci Ekranı Önizlemesi — {studentName}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[11px] font-medium text-gray-500">
                Öğrencinin kendi telefonunda gördüğü ekranlar. Şifreyle çıkış
                yapmadan inceleyebilirsiniz.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Önizlemeyi kapat"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 touch-manipulation"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTab(item.id)}
                  className={`h-10 shrink-0 rounded-full px-3 text-xs font-bold transition active:scale-[0.97] touch-manipulation ${
                    active
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                      : "border border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4">
            {tab === "plan" ? (
              loading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-8 text-sm font-semibold text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Öğrenci programı yükleniyor…
                </div>
              ) : error !== null ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : plan !== null ? (
                <StudentStudyPlan
                  plan={plan}
                  weekStart={weekStart}
                  approving={false}
                  onApprove={() => {}}
                  readOnly
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
                  <p className="text-sm font-semibold text-gray-700">
                    Bu hafta için yayınlanmış çalışma programı yok
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Öğrencinin ekranında da bu hafta için program
                    görünmüyor.
                  </p>
                </div>
              )
            ) : null}

            {tab === "analysis" ? (
              <ExamAnalysisView
                mode="teacher"
                studentId={studentId}
                weekStart={weekStart}
                canAssignTarget={false}
              />
            ) : null}

            {tab === "curriculum" ? (
              curriculum !== null ? (
                <CurriculumProgress snapshot={curriculum} />
              ) : (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  Müfredat verisi yüklenemedi.
                </div>
              )
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
