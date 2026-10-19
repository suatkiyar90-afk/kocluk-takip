"use client";

import { useMemo, useRef, useState } from "react";
import { FileDown, Loader2, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { SchoolLogo } from "@/components/brand/school-logo";
import type {
  CurriculumSnapshot,
  CurriculumSubjectGroup,
  CurriculumTopicRow,
} from "@/app/actions/curriculum-actions";
import { GRADE_LABELS, type GradeLevel } from "@/lib/grade-config";
import {
  OSYM_GUARANTEED_AVG,
  OSYM_REGULAR_AVG,
  weightedMastery,
} from "@/lib/osym-frequency";
import { STUDY_FIELD_LABELS, type StudyField } from "@/components/quiz-entry/weekly-quiz-schema";

export interface CurriculumReportProfile {
  name: string;
  studentNumber: string | null;
  studyField: string | null;
  gradeLevel: GradeLevel;
  advisorName: string | null;
}

type Scope = "all" | "tyt" | "ayt" | "incomplete";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "Tüm Müfredat" },
  { id: "tyt", label: "Sadece TYT" },
  { id: "ayt", label: "Sadece Alan AYT" },
  { id: "incomplete", label: "Bitmeyen Konular" },
];

const STATUS_META: Record<
  CurriculumTopicRow["status"],
  { label: string; dot: string; text: string }
> = {
  bitti: { label: "Bitti", dot: "bg-emerald-500", text: "text-emerald-700" },
  calisiliyor: {
    label: "Çalışılıyor",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  baslamadi: { label: "Başlanmadı", dot: "bg-gray-400", text: "text-gray-500" },
};

function importanceLabel(avg: number): { label: string; className: string } | null {
  if (avg >= OSYM_GUARANTEED_AVG) {
    return { label: "🔥 Garanti", className: "text-red-700" };
  }
  if (avg >= OSYM_REGULAR_AVG) {
    return { label: "⭐ Düzenli", className: "text-amber-700" };
  }
  if (avg > 0) {
    return { label: "Seyrek", className: "text-gray-500" };
  }
  return null;
}

function studyFieldLabel(value: string | null): string {
  if (!value) return "Seçilmedi";
  return STUDY_FIELD_LABELS[value as StudyField] ?? value;
}

function filterTopics(
  topics: CurriculumTopicRow[],
  scope: Scope,
): CurriculumTopicRow[] {
  if (scope === "incomplete") {
    return topics.filter((topic) => topic.status !== "bitti");
  }
  return topics;
}

function filterGroups(
  groups: CurriculumSubjectGroup[],
  scope: Scope,
): CurriculumSubjectGroup[] {
  const examFiltered = groups.filter((group) => {
    if (scope === "tyt") return group.examType === "TYT";
    if (scope === "ayt") return group.examType === "AYT" || group.examType === "YDT";
    return true;
  });

  return examFiltered
    .map((group) => {
      const topics = filterTopics(group.topics, scope);
      return {
        ...group,
        topics,
        totalTopics: topics.length,
        doneTopics: topics.filter((topic) => topic.status === "bitti").length,
        inProgressTopics: topics.filter((topic) => topic.status === "calisiliyor")
          .length,
      };
    })
    .filter((group) => group.topics.length > 0);
}

export function CurriculumReport({
  snapshot,
  profile,
}: {
  snapshot: CurriculumSnapshot;
  profile: CurriculumReportProfile | null;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const printRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => filterGroups(snapshot.tyt.concat(snapshot.ayt, snapshot.ydt), scope), [snapshot, scope]);

  const totals = useMemo(() => {
    const topics = groups.flatMap((group) => group.topics);
    const done = topics.filter((topic) => topic.status === "bitti").length;
    const inProgress = topics.filter(
      (topic) => topic.status === "calisiliyor",
    ).length;
    const mastery = weightedMastery(
      topics.map((topic) => ({
        status: topic.status,
        avgRecentQuestions: topic.avgRecentQuestions,
      })),
    );
    const solved = topics.reduce((sum, topic) => sum + topic.totalSolved, 0);
    return {
      total: topics.length,
      done,
      inProgress,
      notStarted: topics.length - done - inProgress,
      masteryPercent: mastery.percent,
      solved,
    };
  }, [groups]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Mufredat_İlerleme_Raporu_${profile?.studentNumber ?? profile?.name ?? "ogrenci"}`,
    pageStyle:
      "@page { size: A4 portrait; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }",
  });

  const today = useMemo(() => new Date().toLocaleDateString("tr-TR"), []);
  const donePercent =
    totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <style>
        {"@media print { .curriculum-report-print { background: #ffffff !important; color: #111827 !important; } }"}
      </style>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm print:hidden">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {SCOPES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setScope(option.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition touch-manipulation ${
                scope === option.id
                  ? "border-indigo-600 bg-indigo-600 text-white shadow"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handlePrint()}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] touch-manipulation sm:w-auto"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          PDF Çıktısı Al / Yazdır
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          ref={printRef}
          className="curriculum-report-print mx-auto w-full min-w-[720px] max-w-[190mm] rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm print:min-w-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <header className="flex items-start justify-between gap-4 border-b-2 border-gray-900 pb-3">
            <div className="flex items-center gap-3">
              <SchoolLogo className="h-14 w-14 shrink-0 object-contain" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Demirci AİHL · Akademik Takip Sistemi
                </p>
                <h1 className="mt-0.5 text-lg font-black leading-tight">
                  Müfredat İlerleme Raporu
                </h1>
              </div>
            </div>
            <div className="text-right text-[11px] font-semibold text-gray-600">
              <p>Rapor Tarihi</p>
              <p className="text-sm font-bold text-gray-900" suppressHydrationWarning>
                {today}
              </p>
            </div>
          </header>

          <section className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px]">
            <p>
              <span className="font-bold text-gray-500">Ad Soyad:</span>{" "}
              <span className="font-bold">{profile?.name ?? "—"}</span>
            </p>
            <p>
              <span className="font-bold text-gray-500">Okul No:</span>{" "}
              <span className="font-semibold">{profile?.studentNumber ?? "—"}</span>
            </p>
            <p>
              <span className="font-bold text-gray-500">Sınıf:</span>{" "}
              <span className="font-semibold">
                {profile ? GRADE_LABELS[profile.gradeLevel] : "—"}
              </span>
            </p>
            <p>
              <span className="font-bold text-gray-500">Alan:</span>{" "}
              <span className="font-semibold">
                {studyFieldLabel(profile?.studyField ?? null)}
              </span>
            </p>
            <p className="col-span-2">
              <span className="font-bold text-gray-500">Danışman Öğretmen:</span>{" "}
              <span className="font-semibold">{profile?.advisorName ?? "—"}</span>
            </p>
          </section>

          <section className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg border border-gray-200 bg-white p-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
                Toplam Konu
              </p>
              <p className="text-base font-black">{totals.total}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                ✅ Biten
              </p>
              <p className="text-base font-black text-emerald-800">
                {totals.done}
                <span className="ml-1 text-[10px] font-bold">%{donePercent}</span>
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">
                ⏳ Çalışılıyor
              </p>
              <p className="text-base font-black text-amber-800">
                {totals.inProgress}
              </p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-700">
                🔥 Genel Hakimiyet
              </p>
              <p className="text-base font-black text-indigo-800">
                {totals.masteryPercent === null
                  ? "—"
                  : `%${totals.masteryPercent}`}
              </p>
            </div>
          </section>

          <section className="mt-3 grid grid-cols-2 gap-2.5">
            {groups.map((group) => {
              const key = `${group.examType}:${group.subjectId}`;
              return (
                <article
                  key={key}
                  className="break-inside-avoid rounded-lg border border-gray-300 p-2.5"
                >
                  <header className="mb-1.5 flex items-start justify-between gap-2 border-b border-gray-200 pb-1">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black leading-tight">
                        {group.examType} · {group.subjectName}
                      </p>
                      <p className="text-[9px] font-semibold text-gray-500">
                        {group.doneTopics}/{group.totalTopics} konu
                        {group.weightedPercent === null
                          ? ""
                          : ` · ÖSYM Hakimiyeti: %${group.weightedPercent}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">
                      {group.examType}
                    </span>
                  </header>

                  <ul className="space-y-0.5">
                    {group.topics.map((topic) => {
                      const status = STATUS_META[topic.status];
                      const importance = importanceLabel(topic.avgRecentQuestions);
                      return (
                        <li
                          key={topic.topicId}
                          className="flex items-start gap-1.5 border-b border-dashed border-gray-100 py-0.5 last:border-b-0"
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold leading-tight">
                              {topic.topicName}
                            </p>
                            <p className="text-[9px] leading-tight text-gray-500">
                              {status.label}
                              {" · "}
                              {topic.totalSolved > 0
                                ? `${topic.totalSolved} Soru · %${topic.accuracy ?? 0}`
                                : "Henüz soru yok"}
                            </p>
                          </div>
                          {importance ? (
                            <span
                              className={`shrink-0 whitespace-nowrap text-[9px] font-bold ${importance.className}`}
                            >
                              {importance.label}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </section>

          {groups.length === 0 ? (
            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs font-semibold text-gray-500">
              Seçilen kapsamda gösterilecek konu bulunmuyor.
            </p>
          ) : null}

          <footer className="mt-4 flex items-center justify-between border-t border-gray-200 pt-2 text-[9px] font-medium text-gray-500">
            <p>
              Toplam çözülen soru: {totals.solved} · Başlanmamış konu:{" "}
              {totals.notStarted}
            </p>
            <p className="inline-flex items-center gap-1">
              <FileDown className="h-3 w-3" aria-hidden="true" />
              Demirci AİHL Akademik Takip Sistemi
            </p>
          </footer>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 print:hidden">
          <Loader2 className="h-3.5 w-3.5" aria-hidden="true" />
          Kapsam değiştirerek diğer konuları görebilirsiniz.
        </p>
      ) : null}
    </div>
  );
}
