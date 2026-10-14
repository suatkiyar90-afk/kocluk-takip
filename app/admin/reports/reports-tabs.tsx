"use client";

import { useState } from "react";

type ReportsTab = "genel" | "ogrenci";

interface ReportsTabsProps {
  defaultTab: ReportsTab;
  genel: React.ReactNode;
  ogrenci: React.ReactNode;
}

const TAB_ITEMS: { id: ReportsTab; label: string }[] = [
  { id: "genel", label: "Genel Değerlendirme Raporu" },
  { id: "ogrenci", label: "Öğrenci Bazlı Rapor" },
];

export function ReportsTabs({ defaultTab, genel, ogrenci }: ReportsTabsProps) {
  const [tab, setTab] = useState<ReportsTab>(defaultTab);

  return (
    <div>
      <nav className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm print:hidden dark:border-slate-700 dark:bg-slate-900">
        {TAB_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-2 py-2.5 text-center text-xs font-bold transition touch-manipulation ${
              tab === item.id
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === "genel" ? genel : ogrenci}
    </div>
  );
}
