"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchX, TriangleAlert } from "lucide-react";
import { NotificationBanner } from "@/components/notifications/notification-banner";
import type { AttentionListData } from "@/app/actions/teacher-actions";

export type DashboardFilter = "all" | "stale" | "waiting";
export type DashboardSort = "name" | "week" | "recent";

const FILTERS: Array<{ id: DashboardFilter; label: string }> = [
  { id: "all", label: "Tümü" },
  { id: "stale", label: "Veri girmeyenler" },
  { id: "waiting", label: "Cevap bekleyenler" },
];

const SORT_OPTIONS: Array<{ id: DashboardSort; label: string }> = [
  { id: "name", label: "Ada göre" },
  { id: "week", label: "Bu hafta soru sayısına göre" },
  { id: "recent", label: "Son girişe göre" },
];

const STALE_DAYS = 3;

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase("tr-TR") || "?"
  );
}

function lastEntryLabel(days: number | null): string {
  if (days === null) return "Hiç veri yok";
  if (days === 0) return "Bugün";
  if (days === 1) return "Dün";
  return `${days} gün önce`;
}

function isStale(days: number | null): boolean {
  return days === null || days >= STALE_DAYS;
}

interface TeacherDashboardProps {
  data: AttentionListData;
  initialQ: string;
  initialFilter: DashboardFilter;
  initialSort: DashboardSort;
}

export function TeacherDashboard({
  data,
  initialQ,
  initialFilter,
  initialSort,
}: TeacherDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initialQ);
  const [filter, setFilter] = useState<DashboardFilter>(initialFilter);
  const [sort, setSort] = useState<DashboardSort>(initialSort);
  const firstRunRef = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (firstRunRef.current) {
        firstRunRef.current = false;
        return;
      }
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filter !== "all") params.set("filter", filter);
      if (sort !== "name") params.set("sort", sort);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, filter, sort, pathname, router]);

  if (data.students.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-gray-900">
          Henüz atanmış öğrenci yok
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Sorumlu olduğunuz öğrenciler burada listelenecek.
        </p>
      </div>
    );
  }

  const normalizedQ = q.trim().toLocaleLowerCase("tr");
  const filtered = data.students.filter((student) => {
    const matchesQuery =
      normalizedQ === "" ||
      student.studentName.toLocaleLowerCase("tr").includes(normalizedQ) ||
      (student.studentNumber ?? "").includes(normalizedQ);
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "stale"
          ? isStale(student.daysSinceEntry)
          : student.pendingQuestionCount > 0;
    return matchesQuery && matchesFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "week") {
      return (
        b.weekTotalQuestions - a.weekTotalQuestions ||
        a.studentName.localeCompare(b.studentName, "tr")
      );
    }
    if (sort === "recent") {
      const aTime = a.lastEntryDate ? Date.parse(a.lastEntryDate) : -1;
      const bTime = b.lastEntryDate ? Date.parse(b.lastEntryDate) : -1;
      return bTime - aTime || a.studentName.localeCompare(b.studentName, "tr");
    }
    return a.studentName.localeCompare(b.studentName, "tr");
  });

  const showAttention = data.stale.length > 0 || data.waiting.length > 0;

  return (
    <div className="space-y-4">
      <NotificationBanner
        title="Öğrenci sorularında gecikme yaşama"
        description="Bildirimleri aç; öğrencilerin soru sorduğunda anında haberdar ol ve cevaplarını bekletme."
        enableLabel="Bildirimleri Aç"
        activateLabel="Bildirimleri Aktifleştir"
      />

      {showAttention ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
            <TriangleAlert aria-hidden="true" className="h-4 w-4" />
            Dikkat Gerektirenler
          </h2>
          <ul className="mt-1.5 divide-y divide-amber-200/70">
            {data.stale.map((item) => (
              <li key={`stale-${item.studentId}`}>
                <Link
                  href={`/students/${item.studentId}`}
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left transition active:opacity-70 touch-manipulation"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
                    {item.studentName}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-amber-700">
                    {item.daysSinceEntry === null
                      ? "Hiç veri girmemiş"
                      : `${item.daysSinceEntry} gündür veri girmiyor`}
                  </span>
                </Link>
              </li>
            ))}
            {data.waiting.map((item) => (
              <li key={`waiting-${item.studentId}`}>
                <Link
                  href={`/students/${item.studentId}?tab=qa`}
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left transition active:opacity-70 touch-manipulation"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
                    {item.studentName}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-orange-700">
                    {item.pendingCount} soru{" "}
                    {item.oldestWaitingHours < 24
                      ? `${item.oldestWaitingHours} saattir`
                      : `${Math.floor(item.oldestWaitingHours / 24)} gündür`}{" "}
                    bekliyor
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="relative">
        <SearchInput value={q} onChange={setQ} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.id)}
              className={`h-11 shrink-0 rounded-full px-4 text-xs font-bold transition active:scale-[0.97] touch-manipulation ${
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-gray-500">
          {sorted.length} öğrenci
        </p>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
          Sırala
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as DashboardSort)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 touch-manipulation"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <SearchX aria-hidden="true" className="h-6 w-6 text-gray-400" />
          <p className="text-sm font-semibold text-gray-500">
            Eşleşen öğrenci yok
          </p>
          <p className="text-xs text-gray-400">
            Aramayı veya filtreyi değiştirmeyi dene.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((student) => {
            const stale = isStale(student.daysSinceEntry);
            return (
              <li key={student.studentId}>
                <Link
                  href={`/students/${student.studentId}`}
                  className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition active:scale-[0.99] touch-manipulation"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-bold text-indigo-700">
                    {initials(student.studentName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {student.studentName}
                      {student.studentNumber ? (
                        <span className="ml-1.5 text-xs font-medium text-gray-400">
                          No: {student.studentNumber}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span
                        className={`font-bold ${
                          student.weekTotalQuestions > 0
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      >
                        Bu hafta {student.weekTotalQuestions} soru
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="font-medium">
                        Son giriş: {lastEntryLabel(student.daysSinceEntry)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                        stale
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {stale ? "Veri yok" : "Veri girildi"}
                    </span>
                    {student.pendingQuestionCount > 0 ? (
                      <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">
                        {student.pendingQuestionCount} soru
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-gray-400"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.28 3.28a.75.75 0 1 0 1.06-1.06l-3.28-3.28A5.5 5.5 0 0 0 9 3.5ZM6.5 9a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="İsim veya numara ara"
        enterKeyHint="search"
        aria-label="Öğrenci ara"
        className="h-12 w-full rounded-2xl border border-gray-200 bg-white pr-4 pl-11 text-base text-gray-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
      />
    </div>
  );
}
