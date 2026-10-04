"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  getStudentRangeReport,
  searchStudentsForReport,
  type MockExamNets,
  type ReportStudentOption,
  type StudentRangeReportData,
} from "@/app/actions/report-actions";
import {
  buildReportSheets,
  excelFileName,
  quickReportRange,
  validateReportRange,
  type QuickRangeKind,
} from "@/lib/report-utils";

const QUICK_CHIPS: { kind: QuickRangeKind; label: string }[] = [
  { kind: "this-week", label: "Bu hafta" },
  { kind: "last-week", label: "Geçen hafta" },
  { kind: "last-7", label: "Son 7 gün" },
  { kind: "last-30", label: "Son 30 gün" },
  { kind: "this-month", label: "Bu ay" },
  { kind: "last-month", label: "Geçen ay" },
];

const MOCK_NET_LABELS: { key: keyof MockExamNets; label: string }[] = [
  { key: "turkce", label: "Türkçe" },
  { key: "matematik", label: "Matematik" },
  { key: "geometri", label: "Geometri" },
  { key: "fizik", label: "Fizik" },
  { key: "kimya", label: "Kimya" },
  { key: "biyoloji", label: "Biyoloji" },
  { key: "tarih", label: "Tarih" },
  { key: "cografya", label: "Coğrafya" },
  { key: "felsefe", label: "Felsefe" },
  { key: "din", label: "Din" },
];

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("tr-TR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function NetBar({
  correct,
  wrong,
  blank,
}: {
  correct: number;
  wrong: number;
  blank: number;
}) {
  const total = correct + wrong + blank;
  if (total <= 0) {
    return <div className="mt-2 h-2 rounded-full bg-gray-100" />;
  }
  const correctPct = (correct / total) * 100;
  const wrongPct = (wrong / total) * 100;
  const blankPct = (blank / total) * 100;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="flex h-full w-full">
        <div
          className="h-full bg-green-500"
          style={{ width: `${correctPct}%` }}
        />
        <div
          className="h-full bg-red-400"
          style={{ width: `${wrongPct}%` }}
        />
        <div
          className="h-full bg-stone-300"
          style={{ width: `${blankPct}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="report-block rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold text-gray-900">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[11px] font-medium text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

function DeltaBadge({ diff }: { diff: number | null }) {
  if (diff === null) {
    return <span className="text-xs font-semibold text-gray-400">—</span>;
  }
  if (diff > 0) {
    return (
      <span className="text-xs font-bold text-emerald-600">
        ▲ +{formatNumber(diff, 2)}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="text-xs font-bold text-red-600">
        ▼ {formatNumber(diff, 2)}
      </span>
    );
  }
  return <span className="text-xs font-semibold text-gray-500">● 0</span>;
}

export interface StudentRangeReportProps {
  initialStudentId: string;
  initialFrom: string;
  initialTo: string;
  initialDetail: boolean;
  initialNotes: boolean;
  adminName: string;
  schoolName: string;
}

export function StudentRangeReport({
  initialStudentId,
  initialFrom,
  initialTo,
  initialDetail,
  initialNotes,
  adminName,
  schoolName,
}: StudentRangeReportProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReportStudentOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] =
    useState<ReportStudentOption | null>(null);

  const defaultFrom =
    initialFrom || quickReportRange("last-7").from;
  const defaultTo = initialTo || quickReportRange("last-7").to;
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [includeDetail, setIncludeDetail] = useState(initialDetail);
  const [includeNotes, setIncludeNotes] = useState(initialNotes);

  const [report, setReport] = useState<StudentRangeReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [closedSubjects, setClosedSubjects] = useState<Set<string>>(
    () => new Set(),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const result = await searchStudentsForReport(query);
      if (controller.signal.aborted) return;
      setSearching(false);
      if (result.success) {
        setResults(result.data.students);
      } else {
        toast.error(result.message);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function generate(input: {
    studentId: string;
    rangeFrom: string;
    rangeTo: string;
    detail: boolean;
    notes: boolean;
    silent?: boolean;
  }) {
    if (loading) return;
    const range = validateReportRange(input.rangeFrom, input.rangeTo);
    if (range.ok === false) {
      toast.error(range.message);
      return;
    }

    setLoading(true);
    try {
      const result = await getStudentRangeReport({
        studentId: input.studentId,
        from: range.from,
        to: range.to,
        includeDailyDetail: input.detail,
        includeNotes: input.notes,
      });
      if (result.success === false) {
        toast.error(result.message);
        return;
      }
      const next = result.data.report;
      setReport(next);
      setSelectedStudent({
        id: next.student.id,
        name: next.student.name,
        studentNumber: next.student.studentNumber,
      });
      setFrom(range.from);
      setTo(range.to);
      setClosedSubjects(new Set());
      const params = new URLSearchParams();
      params.set("student", next.student.id);
      params.set("from", range.from);
      params.set("to", range.to);
      if (input.detail) params.set("detail", "1");
      if (input.notes) params.set("notes", "1");
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`,
      );
      if (input.silent !== true) {
        toast.success(result.message);
      }
    } catch {
      toast.error("Rapor oluşturulurken beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (initialStudentId && initialFrom && initialTo) {
      void generate({
        studentId: initialStudentId,
        rangeFrom: initialFrom,
        rangeTo: initialTo,
        detail: initialDetail,
        notes: initialNotes,
        silent: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickStudent(student: ReportStudentOption) {
    setSelectedStudent(student);
    setResults(null);
    setQuery("");
    void generate({
      studentId: student.id,
      rangeFrom: from,
      rangeTo: to,
      detail: includeDetail,
      notes: includeNotes,
      silent: true,
    });
  }

  function clearStudent() {
    setSelectedStudent(null);
    setResults(null);
    setQuery("");
    setReport(null);
    searchInputRef.current?.focus();
  }

  function applyQuickRange(kind: QuickRangeKind) {
    const range = quickReportRange(kind);
    setFrom(range.from);
    setTo(range.to);
  }

  function handleGenerate() {
    if (!selectedStudent) {
      toast.error("Önce öğrenci seçin.");
      return;
    }
    void generate({
      studentId: selectedStudent.id,
      rangeFrom: from,
      rangeTo: to,
      detail: includeDetail,
      notes: includeNotes,
    });
  }

  function toggleSubject(key: string) {
    setClosedSubjects((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExcel() {
    if (!report) return;
    const sheets = buildReportSheets(report, {
      includeDailyDetail: report.days.length > 0,
      includeNotes: report.notes.length > 0,
    });
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(sheet.rows),
        sheet.name,
      );
    }
    XLSX.writeFile(
      workbook,
      excelFileName(report.student.studentNumber, report.range.from, report.range.to),
    );
  }

  const hasEntries = report !== null && report.subjects.length > 0;
  const hasOnlyMocks =
    report !== null && report.subjects.length === 0 && report.mocks.length > 0;
  const hasNothing =
    report !== null &&
    report.subjects.length === 0 &&
    report.mocks.length === 0;

  return (
    <main className="min-h-dvh bg-gray-50 px-4 py-6 pb-16 print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: #ffffff !important; }
          .report-block { break-inside: avoid; page-break-inside: avoid; }
          .report-root { background: #ffffff !important; color: #111111 !important; }
        }
      `}</style>

      <div className="report-root mx-auto w-full max-w-2xl">
        <div className="print:hidden">
          <header className="mb-5">
            <h1 className="text-xl font-bold text-gray-900">
              Öğrenci Raporu
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Tarih aralığına göre günlük soru çözümü ve deneme sonuçları.
            </p>
          </header>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Öğrenci
                </span>
                {selectedStudent ? (
                  <div className="mt-1.5 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-indigo-900">
                        {selectedStudent.name || "İsimsiz öğrenci"}
                      </span>
                      {selectedStudent.studentNumber ? (
                        <span className="block text-[11px] font-semibold text-indigo-700">
                          Numara: {selectedStudent.studentNumber}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={clearStudent}
                      className="h-11 shrink-0 touch-manipulation rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      Değiştir
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1.5">
                    <label htmlFor="report-student-search" className="sr-only">
                      Öğrenci ara
                    </label>
                    <input
                      id="report-student-search"
                      ref={searchInputRef}
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Ad veya numara yazın…"
                      autoComplete="off"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    />
                    {searching ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                        Aranıyor…
                      </span>
                    ) : null}
                    {results && results.length > 0 ? (
                      <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
                        {results.map((student) => (
                          <li key={student.id}>
                            <button
                              type="button"
                              onClick={() => pickStudent(student)}
                              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left transition hover:bg-gray-50 touch-manipulation"
                            >
                              <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                                {student.name || "İsimsiz öğrenci"}
                              </span>
                              {student.studentNumber ? (
                                <span className="shrink-0 text-xs font-semibold text-gray-400">
                                  {student.studentNumber}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {results && results.length === 0 && query.trim() ? (
                      <p className="mt-1.5 text-xs font-semibold text-gray-500">
                        Eşleşen öğrenci yok.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Tarih aralığı
                </span>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-gray-500">
                      Başlangıç
                    </span>
                    <input
                      type="date"
                      value={from}
                      max={to}
                      onChange={(event) => setFrom(event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-gray-500">
                      Bitiş
                    </span>
                    <input
                      type="date"
                      value={to}
                      min={from}
                      onChange={(event) => setTo(event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip.kind}
                      type="button"
                      onClick={() => applyQuickRange(chip.kind)}
                      className="min-h-9 touch-manipulation rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:border-indigo-300 hover:text-indigo-700 active:bg-gray-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={includeDetail}
                    onChange={(event) => setIncludeDetail(event.target.checked)}
                    className="h-5 w-5 shrink-0 accent-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Gün gün detay
                  </span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(event) => setIncludeNotes(event.target.checked)}
                    className="h-5 w-5 shrink-0 accent-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Günün özeti notlarını ekle
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!selectedStudent || loading}
                className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Rapor hazırlanıyor…" : "Raporu Oluştur"}
              </button>
            </div>
          </section>
        </div>

        {loading && report === null ? (
          <div
            className="mt-5 space-y-2"
            role="status"
            aria-label="Rapor yükleniyor"
          >
            {[0, 1, 2, 3].map((value) => (
              <div
                key={value}
                aria-hidden="true"
                className="h-20 animate-pulse rounded-2xl bg-gray-200"
              />
            ))}
          </div>
        ) : null}

        {report !== null ? (
          <div className={`mt-5 ${loading ? "opacity-60" : ""}`}>
            <div className="report-block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="hidden text-center text-sm font-extrabold uppercase tracking-widest text-gray-900 print:block">
                {schoolName} — Öğrenci Raporu
              </p>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-gray-900">
                    {report.student.name || "İsimsiz öğrenci"}
                    {report.student.studentNumber ? (
                      <span className="ml-2 align-middle text-xs font-bold text-indigo-700">
                        #{report.student.studentNumber}
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-gray-600">
                    {formatDayLabel(report.range.from)} –{" "}
                    {formatDayLabel(report.range.to)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Oluşturulma: {formatDateTimeLabel(report.generatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex h-11 touch-manipulation items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
                  >
                    Yazdır / PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleExcel}
                    className="flex h-11 touch-manipulation items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 active:bg-emerald-100"
                  >
                    Excel indir
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryCard
                label="Toplam Soru"
                value={formatNumber(report.summary.totalSolved)}
              />
              <SummaryCard
                label="Net"
                value={formatNumber(report.summary.net, 2)}
              />
              <SummaryCard
                label="Başarı %"
                value={`${formatNumber(report.summary.rate, 1)}%`}
              />
              <SummaryCard
                label="D / Y / B"
                value={`${report.summary.correct} / ${report.summary.wrong} / ${report.summary.blank}`}
              />
              <SummaryCard
                label="Veri Girilen Gün"
                value={`${report.summary.daysWithData} / ${report.summary.totalDays}`}
                hint={
                  report.summary.bestDay
                    ? `En çok: ${formatDayLabel(report.summary.bestDay.date)}`
                    : undefined
                }
              />
              <SummaryCard
                label="Günlük Ortalama"
                value={`${formatNumber(report.summary.avgPerActiveDay, 1)} soru`}
                hint="Veri girilen günlere göre"
              />
            </div>

            {hasEntries ? (
              <section className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 print:text-gray-900">
                  Ders ve Konu Dağılımı
                </h3>
                <div className="mt-2 space-y-3">
                  {report.subjects.map((subject) => {
                    const key = `${subject.examType}:${subject.subjectId}`;
                    const isOpen = !closedSubjects.has(key);
                    return (
                      <div
                        key={key}
                        className="report-block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubject(key)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-gray-50 touch-manipulation print:hover:bg-white"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                              {subject.examType}
                            </span>
                            <span className="truncate text-sm font-bold text-gray-900">
                              {subject.subjectName}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-gray-500">
                            <span>{formatNumber(subject.solved)} soru</span>
                            <span className="text-indigo-700">
                              Net {formatNumber(subject.net, 2)}
                            </span>
                            <span className="text-gray-600">
                              %{formatNumber(subject.rate, 1)}
                            </span>
                            <svg
                              className={`h-4 w-4 text-gray-400 transition-transform print:hidden ${
                                isOpen ? "rotate-180" : ""
                              }`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        </button>
                        <div className="px-4 pb-4">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-600">
                            <span className="text-green-700">
                              Doğru {subject.correct}
                            </span>
                            <span className="text-red-600">
                              Yanlış {subject.wrong}
                            </span>
                            <span className="text-stone-500">
                              Boş {subject.blank}
                            </span>
                          </div>
                          <div className="mt-1">
                            <NetBar
                              correct={subject.correct}
                              wrong={subject.wrong}
                              blank={subject.blank}
                            />
                          </div>
                          <div
                            className={`mt-3 space-y-2 ${isOpen ? "" : "hidden print:block"}`}
                          >
                            {subject.topics.map((topic) => (
                              <div
                                key={topic.topicId}
                                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 print:bg-gray-100"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-900">
                                    {topic.topicName}
                                  </p>
                                  <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                                    <span className="font-bold text-green-700">
                                      D {topic.correct}
                                    </span>
                                    {" · "}
                                    <span className="font-bold text-red-600">
                                      Y {topic.wrong}
                                    </span>
                                    {" · "}
                                    <span className="font-bold text-stone-500">
                                      B {topic.blank}
                                    </span>
                                    {" · "}
                                    <span className="font-bold text-gray-700">
                                      %{formatNumber(topic.rate, 1)}
                                    </span>
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-bold text-gray-900">
                                    {formatNumber(topic.solved)} soru
                                  </p>
                                  <p className="text-[11px] font-semibold text-indigo-700">
                                    Net {formatNumber(topic.net, 2)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {hasOnlyMocks || hasNothing ? (
              <div className="report-block mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm font-medium text-gray-600">
                Seçilen aralıkta bu öğrenci için günlük veri girişi yok.
              </div>
            ) : null}

            {report.mocks.length > 0 ? (
              <section className="report-block mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 print:text-gray-900">
                  Deneme Sınavları
                </h3>

                <div className="mt-2 hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-bold">Tarih</th>
                        <th className="px-3 py-2 font-bold">Deneme</th>
                        <th className="px-3 py-2 font-bold">Toplam Net</th>
                        <th className="px-3 py-2 font-bold">Fark</th>
                        <th className="px-3 py-2 font-bold">TYT Puanı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.mocks.map((mock) => {
                        const activeNets = MOCK_NET_LABELS.filter(
                          (item) => mock.nets[item.key] !== 0,
                        );
                        return (
                          <tr key={mock.id} className="align-top">
                            <td className="px-3 py-2.5 text-xs font-semibold text-gray-700">
                              {formatDayLabel(mock.examDate)}
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="text-sm font-bold text-gray-900">
                                {mock.examName}
                              </p>
                              <p className="mt-0.5 text-[11px] text-gray-500">
                                {activeNets.length > 0
                                  ? activeNets
                                      .map(
                                        (item) =>
                                          `${item.label} ${formatNumber(mock.nets[item.key], 2)}`,
                                      )
                                      .join(" · ")
                                  : "—"}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-sm font-extrabold text-gray-900">
                              {formatNumber(mock.toplamNet, 2)}
                            </td>
                            <td className="px-3 py-2.5">
                              <DeltaBadge diff={mock.netDiff} />
                            </td>
                            <td className="px-3 py-2.5 text-sm font-bold text-indigo-700">
                              {formatNumber(mock.tytPuani, 2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="mt-2 space-y-2 md:hidden">
                  {report.mocks.map((mock) => {
                    const activeNets = MOCK_NET_LABELS.filter(
                      (item) => mock.nets[item.key] !== 0,
                    );
                    return (
                      <li
                        key={mock.id}
                        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">
                              {mock.examName}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-gray-500">
                              {formatDayLabel(mock.examDate)}
                            </p>
                          </div>
                          <DeltaBadge diff={mock.netDiff} />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-gray-500">
                            Toplam net
                          </span>
                          <span className="text-base font-extrabold text-gray-900">
                            {formatNumber(mock.toplamNet, 2)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-gray-500">
                            TYT puanı
                          </span>
                          <span className="text-sm font-bold text-indigo-700">
                            {formatNumber(mock.tytPuani, 2)}
                          </span>
                        </div>
                        {activeNets.length > 0 ? (
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-100 pt-2 sm:grid-cols-3">
                            {activeNets.map((item) => (
                              <div
                                key={item.key}
                                className="flex items-center justify-between gap-1 text-[11px]"
                              >
                                <span className="font-semibold text-gray-500">
                                  {item.label}
                                </span>
                                <span className="font-bold text-gray-800">
                                  {formatNumber(mock.nets[item.key], 2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {report.days.length > 0 ? (
              <section className="report-block mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 print:text-gray-900">
                  Gün Gün Detay
                </h3>
                <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-bold">Gün</th>
                        <th className="px-3 py-2 font-bold">Konu</th>
                        <th className="px-3 py-2 font-bold">Soru</th>
                        <th className="px-3 py-2 font-bold">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.days.map((day) => (
                        <tr key={day.date}>
                          <td className="px-3 py-2 text-xs font-semibold text-gray-700">
                            {formatDayLabel(day.date)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-800">
                            {day.topicCount}
                          </td>
                          <td className="px-3 py-2 text-sm font-bold text-gray-900">
                            {formatNumber(day.solved)}
                          </td>
                          <td className="px-3 py-2 text-sm font-bold text-indigo-700">
                            {formatNumber(day.net, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {report.notes.length > 0 ? (
              <section className="report-block mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 print:text-gray-900">
                  Günün Özeti Notları
                </h3>
                <ul className="mt-2 space-y-2">
                  {report.notes.map((note) => (
                    <li
                      key={note.date}
                      className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm"
                    >
                      <p className="text-xs font-bold text-indigo-700">
                        {formatDayLabel(note.date)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                        {note.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="mt-6 border-t border-gray-200 pt-3 text-[11px] leading-relaxed text-gray-500 print:text-gray-700">
              Bu rapor kişisel veri içerir; yalnızca yetkili kişiler tarafından
              kullanılmalıdır. {formatDateTimeLabel(report.generatedAt)} tarihinde{" "}
              {adminName || "yönetici"} tarafından oluşturuldu.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
