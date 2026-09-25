"use client";

import { useState } from "react";
import type { MockExamRecord } from "@/app/actions/mock-exam-actions";

type BranchKey =
  | "turkceNet"
  | "tarihNet"
  | "cografyaNet"
  | "felsefeNet"
  | "dinNet"
  | "matematikNet"
  | "geometriNet"
  | "fizikNet"
  | "kimyaNet"
  | "biyolojiNet";

const BRANCHES: Array<{ key: BranchKey; label: string }> = [
  { key: "turkceNet", label: "Türkçe" },
  { key: "tarihNet", label: "Tarih" },
  { key: "cografyaNet", label: "Coğrafya" },
  { key: "felsefeNet", label: "Felsefe" },
  { key: "dinNet", label: "Din K." },
  { key: "matematikNet", label: "Matematik" },
  { key: "geometriNet", label: "Geometri" },
  { key: "fizikNet", label: "Fizik" },
  { key: "kimyaNet", label: "Kimya" },
  { key: "biyolojiNet", label: "Biyoloji" },
];

function formatNet(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MockExamHistory({ records }: { records: MockExamRecord[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
        Henüz yüklenmiş bir deneme sınavı sonucu yok.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((r) => {
        const open = expandedId === r.id;
        return (
          <div
            key={r.id}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpandedId(open ? null : r.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 touch-manipulation"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {r.examName}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatDate(r.examDate)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-700">
                    {formatNet(r.toplamNet)}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-500">
                    TYT: {formatNet(r.tytPuani)}
                  </p>
                </div>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>

            {open ? (
              <div className="grid grid-cols-2 gap-1.5 border-t border-gray-100 bg-gray-50/60 px-3 py-3">
                {BRANCHES.map((b) => (
                  <div
                    key={b.key}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-gray-200"
                  >
                    <span className="text-[11px] font-medium text-gray-500">
                      {b.label}
                    </span>
                    <span className="text-xs font-bold text-gray-900">
                      {formatNet(r[b.key])}
                    </span>
                  </div>
                ))}
                <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg bg-indigo-50 px-2.5 py-1.5 ring-1 ring-indigo-100">
                  <span className="text-[11px] font-semibold text-indigo-600">
                    Toplam
                  </span>
                  <span className="text-xs font-bold text-indigo-700">
                    {formatNet(r.toplamNet)}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg bg-indigo-50 px-2.5 py-1.5 ring-1 ring-indigo-100">
                  <span className="text-[11px] font-semibold text-indigo-600">
                    TYT Puanı
                  </span>
                  <span className="text-xs font-bold text-indigo-700">
                    {formatNet(r.tytPuani)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
