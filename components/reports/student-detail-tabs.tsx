"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileText,
  MessageCircle,
  Target,
} from "lucide-react";
import { WeekPicker } from "@/components/ui/week-picker";
import { TopicAnalysis } from "@/components/reports/topic-analysis";
import { FeedbackForm } from "@/components/coaching/feedback-form";
import { MockExamHistory } from "@/components/exams/mock-exam-history";
import { CurriculumProgress } from "@/components/curriculum/curriculum-progress";
import { TeacherQASection } from "@/components/qa/teacher-qa-section";
import { TargetsPanel } from "@/components/reports/targets-panel";
import { TeacherReportsTab } from "@/components/reports/teacher-reports-tab";
import { ChartSkeleton } from "@/components/charts/chart-ui";
import { BottomTabBar } from "@/components/ui/bottom-tab-bar";
import { netScore } from "@/components/quiz-entry/weekly-quiz-schema";
import { weekdayOfISO } from "@/lib/week-utils";
import { normalizeStudentDetailTab } from "@/lib/student-detail-tabs";
import { getStudentPendingQuestionCount } from "@/app/actions/qa-actions";
import type { WeeklyReportResult } from "@/app/actions/quiz-actions";
import type { MockExamsResult } from "@/app/actions/mock-exam-actions";
import type {
  WeeklyTargetActionResult,
  WeeklyTargetView,
  WeeklyDenemeBundleResult,
} from "@/app/actions/weekly-target-actions";
import type {
  CurriculumActionResult,
  CurriculumSnapshot,
} from "@/app/actions/curriculum-actions";
import type {
  QaActionResult,
  QaThreadSummary,
} from "@/app/actions/qa-actions";

const TargetComparisonChart = dynamic(
  () => import("@/components/charts/target-comparison-chart"),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

const TABS = [
  { id: "report", label: "Haftalık", icon: BarChart3 },
  { id: "targets", label: "Hedef", icon: Target },
  { id: "exams", label: "Deneme", icon: ClipboardList },
  { id: "curriculum", label: "Müfredat", icon: BookOpen },
  { id: "qa", label: "Soru", icon: MessageCircle },
  { id: "reports", label: "Raporlar", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function formatNet(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSelectedDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

interface StudentDetailTabsProps {
  weekStart: string;
  studentId: string;
  initialComment: string | undefined;
  initialTab?: string;
  reportResult: WeeklyReportResult;
  examsResult: MockExamsResult;
  targetsResult: WeeklyTargetActionResult<WeeklyTargetView[]>;
  denemeBundleResult: WeeklyDenemeBundleResult;
  curriculumResult: CurriculumActionResult<CurriculumSnapshot>;
  qaResult: QaActionResult<QaThreadSummary[]>;
  actorName?: string;
  schoolName?: string;
}

export function StudentDetailTabs({
  weekStart,
  studentId,
  initialComment,
  initialTab,
  reportResult,
  examsResult,
  targetsResult,
  denemeBundleResult,
  curriculumResult,
  qaResult,
  actorName,
  schoolName,
}: StudentDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(
    normalizeStudentDetailTab(initialTab) as TabId,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setSelectedDate(null);
  }, [weekStart]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    void getStudentPendingQuestionCount(studentId)
      .then((count) => {
        if (!cancelled && Number.isFinite(count)) {
          setPendingCount(count);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const report = reportResult.success === true ? reportResult.data : null;
  const reportError =
    reportResult.success === false ? reportResult.message : null;

  const totalCorrect = report
    ? report.days.reduce((sum, day) => sum + day.correct, 0)
    : 0;
  const totalWrong = report
    ? report.days.reduce((sum, day) => sum + day.wrong, 0)
    : 0;
  const totalBlank = report
    ? report.days.reduce((sum, day) => sum + day.blank, 0)
    : 0;
  const totalSolved = totalCorrect + totalWrong + totalBlank;
  const totalNet = Math.round(netScore(totalCorrect, totalWrong) * 100) / 100;
  const maxDaySolved = report
    ? Math.max(...report.days.map((day) => day.solved), 1)
    : 1;
  const selectedDayNote =
    selectedDate !== null && report !== null
      ? report.dailyNotes.find((note) => note.date === selectedDate)
      : undefined;
  const targetItems =
    targetsResult.success === true
      ? targetsResult.data.map((t) => ({
          subjectName: t.subjectName,
          target: t.targetQuestionCount,
          actual: t.solvedCount,
        }))
      : [];
  const denemeBundle =
    denemeBundleResult.success === true ? denemeBundleResult.data : null;
  const denemeTargets = denemeBundle?.targets ?? [];
  const denemeAttempts = denemeBundle?.attempts ?? [];

  return (
    <div>
      <div role="tabpanel" id="detail-panel-report" aria-labelledby="detail-tab-report" hidden={activeTab !== "report"}>
        <div className="space-y-6">
          <WeekPicker monday={weekStart} compact />

          {reportError !== null ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {reportError}
            </div>
          ) : report !== null ? (
            <>
              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                  Haftalık Özet
                </h2>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Çözülen
                      </p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {totalSolved}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Doğru / Yanlış
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        <span className="text-green-700">{totalCorrect}</span>
                        <span className="mx-1 text-gray-300">/</span>
                        <span className="text-red-600">{totalWrong}</span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Net
                      </p>
                      <p className="mt-1 text-lg font-bold text-indigo-700">
                        {formatNet(totalNet)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1.5">
                    {report.days.map((day) => {
                      const dow = weekdayOfISO(day.date);
                      const heightPct =
                        day.solved > 0
                          ? Math.max((day.solved / maxDaySolved) * 100, 10)
                          : 0;
                      const isSelected = selectedDate === day.date;
                      const isDimmed =
                        selectedDate !== null && !isSelected;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${day.date} tarihini filtrele`}
                          onClick={() =>
                            setSelectedDate((prev) =>
                              prev === day.date ? null : day.date,
                            )
                          }
                          className="flex touch-manipulation flex-col items-center gap-1 rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                          <div
                            className={`flex h-14 w-full items-end justify-center rounded-lg p-0.5 transition-all ${
                              isSelected
                                ? "bg-indigo-50 ring-2 ring-indigo-400"
                                : "bg-gray-50"
                            } ${isDimmed ? "opacity-40" : "opacity-100"}`}
                          >
                            <div
                              className={`w-full rounded-md transition-all ${
                                day.solved > 0
                                  ? isSelected
                                    ? "bg-indigo-700"
                                    : "bg-indigo-500"
                                  : "bg-transparent"
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span
                            className={`text-[10px] font-semibold transition-colors ${
                              isSelected
                                ? "text-indigo-700"
                                : "text-gray-400"
                            }`}
                          >
                            {DAY_LABELS[dow]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDate !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(null)}
                      className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition active:scale-95 touch-manipulation"
                    >
                      {formatSelectedDay(selectedDate)}
                      <span aria-hidden>✕</span>
                      <span className="sr-only">Filtreyi temizle</span>
                    </button>
                  )}

                  {totalSolved === 0 && (
                    <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700">
                      Bu hafta için henüz günlük soru kaydı girilmemiş.
                    </p>
                  )}
                </div>
              </section>

              {selectedDate !== null && report.entries.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
                      Günlük Soru Detayı
                    </h2>
                    {selectedDate !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedDate(null)}
                        className="flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition active:scale-95 touch-manipulation"
                      >
                        {formatSelectedDay(selectedDate)}
                        <span aria-hidden>✕</span>
                        <span className="sr-only">Filtreyi temizle</span>
                      </button>
                    )}
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    {selectedDate !== null && selectedDayNote !== undefined && (
                      <div className="mb-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                            Günün Özeti
                          </span>
                          <span
                            className="text-xs font-bold text-indigo-700"
                            suppressHydrationWarning
                          >
                            {formatSelectedDay(selectedDate)}
                          </span>
                        </div>
                        <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">
                          {selectedDayNote.note}
                        </p>
                        <p
                          className="mt-2 text-[11px] font-medium text-gray-400"
                          suppressHydrationWarning
                        >
                          Öğrenci notu · Son güncelleme:{" "}
                          {new Date(
                            selectedDayNote.updatedAt,
                          ).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                          })}
                        </p>
                      </div>
                    )}
                    {(() => {
                      const filteredEntries = report.entries.filter((entry) =>
                        selectedDate ? entry.date === selectedDate : true,
                      );
                      if (filteredEntries.length === 0) {
                        return (
                          <p className="rounded-xl bg-gray-50 px-3 py-3 text-center text-xs font-medium text-gray-500">
                            {selectedDate !== null
                              ? `${formatSelectedDay(selectedDate)} için kayıt bulunamadı.`
                              : "Kayıt bulunamadı."}
                          </p>
                        );
                      }
                      return (
                        <ul className="space-y-2">
                          {filteredEntries.map((entry, index) => (
                            <li
                              key={`${entry.date}-${entry.examType}-${entry.topicName}-${index}`}
                              className="rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                  {entry.examType}
                                </span>
                                <span
                                  className="shrink-0 text-[11px] font-semibold text-gray-400"
                                  suppressHydrationWarning
                                >
                                  {formatEntryDate(entry.date)}
                                </span>
                                <p className="min-w-0 text-sm font-semibold break-words text-gray-900">
                                  {entry.subjectName} · {entry.topicName}
                                </p>
                                <p className="ml-auto shrink-0 text-xs font-medium text-gray-500">
                                  <span className="font-bold text-green-600">
                                    {entry.correct} Doğru
                                  </span>
                                  ,{" "}
                                  <span className="font-bold text-red-600">
                                    {entry.wrong} Yanlış
                                  </span>
                                  ,{" "}
                                  <span className="font-bold text-stone-500">
                                    {entry.blank} Boş
                                  </span>
                                  · Net{" "}
                                  <span className="font-bold text-indigo-700">
                                    {formatNet(entry.net)}
                                  </span>
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                </section>
              )}

              {denemeTargets.length > 0 || denemeAttempts.length > 0 ? (
                <section>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                    Denemeler
                  </h2>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    {denemeTargets.length > 0 ? (
                      <ul className="space-y-2">
                        {denemeTargets.map((target) => (
                          <li
                            key={target.denemeKey}
                            className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-3"
                          >
                            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                              {target.label}
                            </span>
                            <span className="min-w-0 text-sm font-semibold text-gray-900">
                              {target.solvedCount} / {target.targetCount} adet
                            </span>
                            {target.reached ? (
                              <span className="shrink-0 text-[11px] font-bold text-green-600">
                                ✓ Tamamlandı
                              </span>
                            ) : (
                              <span className="shrink-0 text-[11px] font-medium text-gray-500">
                                {Math.max(
                                  target.targetCount - target.solvedCount,
                                  0,
                                )}{" "}
                                kaldı
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {denemeAttempts.length > 0 ? (
                      <ul
                        className={
                          denemeTargets.length > 0 ? "mt-3 space-y-2" : "space-y-2"
                        }
                      >
                        {denemeAttempts.map((attempt) => (
                          <li
                            key={attempt.id}
                            className="rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span
                                className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700"
                                suppressHydrationWarning
                              >
                                {formatEntryDate(attempt.date)}
                              </span>
                              <p className="min-w-0 text-sm font-semibold break-words text-gray-900">
                                {attempt.label}
                              </p>
                              <p className="ml-auto shrink-0 text-xs font-medium text-gray-500">
                                <span className="font-bold text-green-600">
                                  {attempt.correct} Doğru
                                </span>
                                ,{" "}
                                <span className="font-bold text-red-600">
                                  {attempt.wrong} Yanlış
                                </span>
                                ,{" "}
                                <span className="font-bold text-stone-500">
                                  {attempt.blank} Boş
                                </span>
                                · Net{" "}
                                <span className="font-bold text-indigo-700">
                                  {formatNet(attempt.net)}
                                </span>
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-xl bg-gray-50 px-3 py-3 text-center text-xs font-medium text-gray-500">
                        Bu hafta için deneme kaydı bulunamadı.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}

              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                  Konu Bazlı Analiz
                </h2>
                <TopicAnalysis key={weekStart} topics={report.byTopic} />
              </section>

              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                  Hedef / Gerçekleşen
                </h2>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <TargetComparisonChart items={targetItems} />
                  {targetsResult.success === false ? (
                    <p className="mt-3 text-xs font-medium text-red-600">
                      {targetsResult.message}
                    </p>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          <FeedbackForm
            key={weekStart}
            studentId={studentId}
            initialComment={initialComment}
            weekStart={weekStart}
          />
        </div>
      </div>

      <div role="tabpanel" id="detail-panel-targets" aria-labelledby="detail-tab-targets" hidden={activeTab !== "targets"}>
        <TargetsPanel
          studentId={studentId}
          weekStart={weekStart}
          snapshot={curriculumResult.success === true ? curriculumResult.data : null}
        />
      </div>

      <div role="tabpanel" id="detail-panel-exams" aria-labelledby="detail-tab-exams" hidden={activeTab !== "exams"}>
        {examsResult.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {examsResult.message}
          </div>
        ) : (
          <MockExamHistory records={examsResult.data} />
        )}
      </div>

      <div role="tabpanel" id="detail-panel-curriculum" aria-labelledby="detail-tab-curriculum" hidden={activeTab !== "curriculum"}>
        {curriculumResult.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {curriculumResult.message}
          </div>
        ) : (
          <CurriculumProgress snapshot={curriculumResult.data} />
        )}
      </div>

      <div role="tabpanel" id="detail-panel-qa" aria-labelledby="detail-tab-qa" hidden={activeTab !== "qa"}>
        {qaResult.success === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {qaResult.message}
          </div>
        ) : (
          <TeacherQASection
            studentId={studentId}
            initialThreads={qaResult.data}
          />
        )}
      </div>

      <div role="tabpanel" id="detail-panel-reports" aria-labelledby="detail-tab-reports" hidden={activeTab !== "reports"}>
        {activeTab === "reports" ? (
          <TeacherReportsTab
            studentId={studentId}
            actorName={actorName}
            schoolName={schoolName}
          />
        ) : null}
      </div>

      <BottomTabBar
        ariaLabel="Öğrenci detay sekmeleri"
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as TabId)}
        items={TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
          panelId: `detail-panel-${tab.id}`,
          tabId: `detail-tab-${tab.id}`,
          badge: tab.id === "qa" ? pendingCount : undefined,
          badgeSrText:
            tab.id === "qa" && pendingCount > 0
              ? `${pendingCount} soru cevap bekliyor`
              : undefined,
        }))}
      />
    </div>
  );
}
