"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Printer, Search } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import {
  getAdminBulkStudentReport,
  type BulkStudentReportData,
  type BulkStudentReportRow,
} from "@/app/actions/admin-actions";
import { SchoolLogo } from "@/components/brand/school-logo";
import {
  addDaysISO,
  getCurrentWeekMonday,
  todayInIstanbul,
} from "@/lib/week-utils";

const nf = new Intl.NumberFormat("tr-TR");

const STATUS_SORT_ORDER: Record<string, number> = {
  "Pasif (Veri Yok)": 0,
  "Düşük / Riskli": 1,
  "Orta / Takip Edilmeli": 2,
  "Çok İyi / Düzenli": 3,
};

const TONE_BADGE_CLASS: Record<BulkStudentReportRow["statusTone"], string> = {
  green: "border-emerald-300 bg-emerald-100 text-emerald-900",
  amber: "border-amber-300 bg-amber-100 text-amber-900",
  orange: "border-orange-300 bg-orange-100 text-orange-900",
  red: "border-red-300 bg-red-100 text-red-900",
};

type SortKey = "questions" | "number" | "name" | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "questions", label: "Çözülen Soru Sayısına Göre (Azalan)" },
  { value: "number", label: "Öğrenci Numarasına Göre" },
  { value: "name", label: "İsme Göre" },
  { value: "status", label: "Duruma Göre (Riskli Öncelikli)" },
];

const ADVISOR_ALL = "__all__";
const ADVISOR_NONE = "__none__";

function formatDateTR(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

function netLabel(value: number): string {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500";
const labelClass = "mb-1 block text-xs font-bold text-gray-600 dark:text-slate-400";
const selectClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

interface BulkStudentReportProps {
  adminName?: string;
}

export function BulkStudentReport({ adminName = "" }: BulkStudentReportProps) {
  const today = todayInIstanbul();
  const [startDate, setStartDate] = useState(() => addDaysISO(today, -6));
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<BulkStudentReportData | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisorFilter, setAdvisorFilter] = useState<string>(ADVISOR_ALL);
  const [sortKey, setSortKey] = useState<SortKey>("questions");
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Genel_Ogrenci_Degerlendirme_Raporu_${startDate}_${endDate}`,
    pageStyle: "@page { size: A4 portrait; margin: 10mm; }",
  });

  const fetchReport = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminBulkStudentReport(from, to);
      if (result.success === true) {
        setData(result.data);
        setGeneratedAt(
          new Date().toLocaleString("tr-TR", {
            dateStyle: "short",
            timeStyle: "short",
          }),
        );
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    } catch {
      const message = "Rapor oluşturulurken beklenmeyen bir hata oluştu.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyRange(from: string, to: string) {
    setStartDate(from);
    setEndDate(to);
    void fetchReport(from, to);
  }

  const advisorOptions = useMemo(() => {
    if (!data) return [];
    const names = new Set<string>();
    let hasUnassigned = false;
    for (const row of data.students) {
      if (row.advisorName === null) {
        hasUnassigned = true;
      } else {
        names.add(row.advisorName);
      }
    }
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "tr"));
    return hasUnassigned
      ? [...sorted, ADVISOR_NONE]
      : sorted;
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    let rows = [...data.students];
    if (advisorFilter !== ADVISOR_ALL) {
      rows = rows.filter((row) =>
        advisorFilter === ADVISOR_NONE
          ? row.advisorName === null
          : row.advisorName === advisorFilter,
      );
    }
    switch (sortKey) {
      case "number":
        rows.sort((a, b) =>
          (a.studentNumber ?? "zzz").localeCompare(
            b.studentNumber ?? "zzz",
            "tr",
            { numeric: true },
          ),
        );
        break;
      case "name":
        rows.sort((a, b) => a.name.localeCompare(b.name, "tr"));
        break;
      case "status":
        rows.sort(
          (a, b) =>
            (STATUS_SORT_ORDER[a.statusLabel] ?? 99) -
            (STATUS_SORT_ORDER[b.statusLabel] ?? 99),
        );
        break;
      default:
        rows.sort((a, b) => b.totalSolved - a.totalSolved);
    }
    return rows;
  }, [data, advisorFilter, sortKey]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <style>
        {"@page { size: A4 portrait; margin: 10mm; }" +
          "@media print { .bulk-report-print { background: #ffffff !important; color: #111827 !important; } }"}
      </style>

      <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm print:hidden dark:border-slate-700 dark:bg-slate-900">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void fetchReport(startDate, endDate);
          }}
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <label className={labelClass} htmlFor="bulk-start-date">
                Başlangıç Tarihi
              </label>
              <input
                id="bulk-start-date"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bulk-end-date">
                Bitiş Tarihi
              </label>
              <input
                id="bulk-end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              Raporu Getir
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              {
                label: "Bu Hafta",
                from: getCurrentWeekMonday(),
                to: todayInIstanbul(),
              },
              {
                label: "Son 7 Gün",
                from: addDaysISO(today, -6),
                to: today,
              },
              {
                label: "Son 30 Gün",
                from: addDaysISO(today, -29),
                to: today,
              },
              {
                label: "Bu Ay",
                from: `${today.slice(0, 8)}01`,
                to: today,
              },
            ].map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => applyRange(quick.from, quick.to)}
                disabled={loading}
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50 touch-manipulation dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              >
                {quick.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="bulk-advisor-filter">
                Danışman Öğretmene Göre Filtrele
              </label>
              <select
                id="bulk-advisor-filter"
                value={advisorFilter}
                onChange={(event) => setAdvisorFilter(event.target.value)}
                className={selectClass}
              >
                <option value={ADVISOR_ALL}>Tüm Danışmanlar</option>
                {advisorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name === ADVISOR_NONE ? "Atanmamış" : name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="bulk-sort">
                Sıralama
              </label>
              <select
                id="bulk-sort"
                value={sortKey}
                onChange={(event) =>
                  setSortKey(event.target.value as SortKey)
                }
                className={selectClass}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => handlePrint()}
              disabled={loading || data === null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-bold text-white shadow-lg shadow-gray-900/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation dark:bg-white dark:text-gray-900"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              PDF Olarak İndir / Yazdır
            </button>
          </div>
        </form>

        {error ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </section>

      <div
        ref={printRef}
        className="bulk-report-print print-exact-colors rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm sm:p-5 print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        {loading && data === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Rapor hazırlanıyor…
          </div>
        ) : null}

        {!loading && data === null && error === null ? (
          <p className="py-16 text-center text-sm font-semibold text-gray-500">
            Görüntülenecek rapor bulunamadı.
          </p>
        ) : null}

        {data ? (
          <>
            <header className="flex items-start gap-3 border-b-2 border-gray-800 pb-2.5 print:break-inside-avoid">
              <SchoolLogo className="h-12 w-12 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-extrabold leading-snug text-gray-900 sm:text-base">
                  Demirci AİHL - Akademik Takip Sistemi | Genel Öğrenci
                  Değerlendirme Raporu
                </h1>
                <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-700">
                  Dönem: {formatDateTR(data.startDate)} –{" "}
                  {formatDateTR(data.endDate)} · {data.totalDays} günlük dönem ·
                  Rapor Tarihi: {generatedAt ?? "—"}
                </p>
                {adminName ? (
                  <p className="text-[11px] leading-snug text-gray-600">
                    Hazırlayan: {adminName}
                  </p>
                ) : null}
              </div>
            </header>

            <section className="mt-3 grid grid-cols-2 gap-2 print:gap-1.5 sm:grid-cols-4">
              <SummaryCard
                label="Toplam Öğrenci"
                value={nf.format(data.summary.totalStudents)}
              />
              <SummaryCard
                label="Veri Giren Aktif Öğrenci"
                value={nf.format(data.summary.activeStudents)}
              />
              <SummaryCard
                label="Çözülen Toplam Soru"
                value={nf.format(data.summary.totalSolved)}
              />
              <SummaryCard
                label="Öğrenci Başı Ortalama Soru"
                value={nf.format(data.summary.avgSolvedPerStudent)}
              />
            </section>

            <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[780px] border-collapse text-left text-[11px] print:min-w-0">
                <thead className="table-header-group">
                  <tr className="border-y border-gray-800 bg-gray-100 text-[10px] font-extrabold uppercase tracking-wide text-gray-800">
                    <th className="px-1.5 py-1.5">No &amp; Ad Soyad</th>
                    <th className="px-1.5 py-1.5">Danışman Öğretmen</th>
                    <th className="px-1.5 py-1.5 text-center">Aktif Gün</th>
                    <th className="px-1.5 py-1.5 text-center">
                      TYT / AYT / YDT
                    </th>
                    <th className="px-1.5 py-1.5 text-right">
                      Toplam Soru &amp; Net
                    </th>
                    <th className="px-1.5 py-1.5 text-right">Deneme Ort.</th>
                    <th className="px-1.5 py-1.5">Genel Değerlendirme</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-2 py-8 text-center text-xs font-semibold text-gray-500"
                      >
                        Seçilen filtreye uygun öğrenci bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-200 break-inside-avoid align-top even:bg-gray-50"
                      >
                        <td className="px-1.5 py-1 leading-tight">
                          <span className="font-extrabold tabular-nums text-gray-900">
                            {row.studentNumber ?? "—"}
                          </span>
                          <span className="ml-1.5 font-semibold text-gray-800">
                            {row.name}
                          </span>
                        </td>
                        <td className="px-1.5 py-1 leading-tight text-gray-700">
                          {row.advisorName ?? (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-1.5 py-1 text-center font-bold tabular-nums text-gray-900">
                          {row.activeDays} / {data.totalDays} Gün
                        </td>
                        <td className="px-1.5 py-1 text-center font-semibold tabular-nums text-gray-800">
                          {row.tytSolved} / {row.aytSolved} / {row.ydtSolved}
                        </td>
                        <td className="px-1.5 py-1 text-right leading-tight">
                          <span className="text-[12px] font-extrabold text-gray-900">
                            {nf.format(row.totalSolved)}
                          </span>
                          <span className="ml-1 text-[10px] text-gray-600">
                            ({netLabel(row.net)} net)
                          </span>
                        </td>
                        <td className="px-1.5 py-1 text-right font-semibold tabular-nums text-gray-800">
                          {row.denemeAvgNet !== null
                            ? netLabel(row.denemeAvgNet)
                            : "–"}
                        </td>
                        <td className="px-1.5 py-1">
                          <span
                            className={`inline-block whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9.5px] font-extrabold ${TONE_BADGE_CLASS[row.statusTone]}`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <footer className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-gray-300 pt-1.5 text-[10px] font-semibold text-gray-500 print:break-inside-avoid">
              <span>
                Genel Öğrenci Değerlendirme Raporu · {formatDateTR(data.startDate)} –{" "}
                {formatDateTR(data.endDate)}
              </span>
              <span>
                {visibleRows.length} / {data.students.length} öğrenci
                listeleniyor · Demirci AİHL
              </span>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 print:rounded-md">
      <p className="text-[9.5px] font-extrabold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-extrabold leading-none tabular-nums text-gray-900 print:text-base">
        {value}
      </p>
    </div>
  );
}
