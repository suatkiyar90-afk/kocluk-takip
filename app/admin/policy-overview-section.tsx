"use client";

import { useState } from "react";
import { normalizeSearchText } from "@/lib/search-text";
import type {
  PolicyAcknowledgmentOverview,
  PolicyOverviewPerson,
} from "@/lib/policy-overview";
import { formatTimeAgo } from "@/lib/time-ago";

const INITIAL_COUNT = 8;

function roleLabel(role: "student" | "teacher"): string {
  return role === "teacher" ? "Öğretmen" : "Öğrenci";
}

function roleBadgeClass(role: "student" | "teacher"): string {
  if (role === "teacher") {
    return "whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600";
  }
  return "whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600";
}

function subtitleOf(row: PolicyOverviewPerson): string {
  const parts: string[] = [];
  if (row.role === "student") {
    parts.push(
      row.assignedTeacher
        ? `Atanmış öğretmen: ${row.assignedTeacher}`
        : "Atanmamış",
    );
  }
  parts.push(
    row.lastSeenAt
      ? `Son görülme: ${formatTimeAgo(row.lastSeenAt)}`
      : "Henüz giriş yapmadı",
  );
  return parts.join(" · ");
}

function ProgressBar({
  label,
  acknowledged,
  total,
}: {
  label: string;
  acknowledged: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((acknowledged / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700">
        <span>{label}</span>
        <span className="text-gray-500">
          {acknowledged}/{total} · %{percent}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-indigo-600"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function PolicyOverviewSection({
  overview,
  errorMessage,
}: {
  overview: PolicyAcknowledgmentOverview | null;
  errorMessage: string | null;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const trimmed = normalizeSearchText(query);
  const filtered = !overview
    ? []
    : overview.notAcknowledged.filter((row) => {
        if (!trimmed) return true;
        if (normalizeSearchText(row.name).includes(trimmed)) return true;
        return (
          row.studentNumber !== null &&
          normalizeSearchText(row.studentNumber).includes(trimmed)
        );
      });
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_COUNT);

  const versionLabel = overview
    ? overview.studentVersion === overview.teacherVersion
      ? overview.studentVersion
      : `öğrenci ${overview.studentVersion} · öğretmen ${overview.teacherVersion}`
    : "";

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900">KVKK Onay Durumu</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        {versionLabel
          ? `Güncel sürüm: ${versionLabel}`
          : "Güncel aydınlatma metni onayları"}
      </p>

      {errorMessage ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {overview ? (
        <>
          <div className="mt-4 space-y-3">
            <ProgressBar
              label="Öğrenciler"
              acknowledged={overview.students.acknowledged}
              total={overview.students.total}
            />
            <ProgressBar
              label="Öğretmenler"
              acknowledged={overview.teachers.acknowledged}
              total={overview.teachers.total}
            />
          </div>

          <label className="mt-4 block">
            <span className="sr-only">Ad veya numara ile ara</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ad veya numara ile ara"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none"
            />
          </label>

          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">
            Onaylamayanlar ({filtered.length})
          </h3>

          {filtered.length === 0 ? (
            <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
              {trimmed
                ? `"${query.trim()}" için eşleşme yok.`
                : "Tüm kullanıcılar güncel sürümü onaylamış."}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {visible.map((row) => (
                <li
                  key={row.id}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-gray-50 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {row.name}
                      </p>
                      <span className={roleBadgeClass(row.role)}>
                        {roleLabel(row.role)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {subtitleOf(row)}
                    </p>
                  </div>
                  {row.role === "student" && row.studentNumber ? (
                    <span className="whitespace-nowrap text-xs font-semibold text-indigo-700">
                      {row.studentNumber}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {filtered.length > INITIAL_COUNT ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-white text-sm font-bold text-indigo-700 transition active:scale-[0.98] touch-manipulation"
            >
              {expanded ? "Gizle" : `Tümünü göster (${filtered.length})`}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
