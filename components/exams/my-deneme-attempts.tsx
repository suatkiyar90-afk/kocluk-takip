"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ChartSkeleton } from "@/components/charts/chart-ui";
import type { DenemeAttemptRow } from "@/lib/report-utils";

const MyDenemeTrend = dynamic(
  () => import("@/components/charts/my-deneme-trend"),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

type FilterKey = "all" | "tyt" | "ayt" | "brans";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "tyt", label: "TYT" },
  { id: "ayt", label: "AYT" },
  { id: "brans", label: "Branş" },
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function formatNet(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

interface MyDenemeAttemptsProps {
  rows: DenemeAttemptRow[];
  title: string;
  subtitle?: string;
}

export function MyDenemeAttempts({
  rows,
  title,
  subtitle,
}: MyDenemeAttemptsProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.type === filter)),
    [rows, filter],
  );

  const trendPoints = useMemo(
    () =>
      [...filtered]
        .reverse()
        .map((row) => ({ date: formatShortDate(row.date), net: row.net })),
    [filtered],
  );

  if (rows.length === 0) {
    return (
      <section className="mt-5">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        ) : null}
        <div className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm font-medium text-gray-600">
          Henüz kendi deneme kaydın yok.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
      ) : null}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.id)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-bold transition active:scale-[0.97] touch-manipulation ${
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                  : "border border-gray-200 bg-white text-gray-600"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {trendPoints.length >= 2 ? (
        <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="px-1 text-xs font-semibold text-gray-500">Net trendi</p>
          <div className="mt-2 h-56">
            <MyDenemeTrend points={trendPoints} />
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm font-medium text-gray-600">
          Bu türde deneme kaydı yok.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">
                  {row.label}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-gray-500">
                  {formatDate(row.date)} · D {row.correct} · Y {row.wrong} · B{" "}
                  {row.blank}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-extrabold text-indigo-700">
                  {formatNet(row.net)}
                </p>
                <p className="text-[11px] font-semibold text-gray-500">
                  {row.solved} soru
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
