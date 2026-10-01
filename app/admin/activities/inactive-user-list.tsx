"use client";

import { useState } from "react";
import type { InactiveUserRow } from "@/app/actions/admin-actions";
import { formatTimeAgo } from "@/lib/time-ago";

const INITIAL_COUNT = 8;

function subtitleOf(
  row: InactiveUserRow,
  showTeacher: boolean,
  showLastSeen: boolean,
): string {
  const parts: string[] = [];
  if (showTeacher) {
    parts.push(row.assignedTeacher ? `Atanmış öğretmen: ${row.assignedTeacher}` : "Atanmamış");
  }
  if (showLastSeen) {
    parts.push(
      row.lastSeenAt ? `Son görülme: ${formatTimeAgo(row.lastSeenAt)}` : "Henüz giriş yapmadı",
    );
  }
  return parts.join(" · ");
}

export function InactiveUserList({
  rows,
  showTeacher = false,
  showLastSeen = false,
  emptyText,
}: {
  rows: InactiveUserRow[];
  showTeacher?: boolean;
  showLastSeen?: boolean;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
        {emptyText}
      </p>
    );
  }

  const trimmed = query.trim().toLocaleLowerCase("tr");
  const filtered = trimmed
    ? rows.filter((row) => row.name.toLocaleLowerCase("tr").includes(trimmed))
    : rows;
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_COUNT);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">İsimle ara</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İsimle ara"
          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none"
        />
      </label>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
          &quot;{query.trim()}&quot; için eşleşme yok.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-gray-50 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {row.name}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {subtitleOf(row, showTeacher, showLastSeen)}
                </p>
              </div>
              {row.studentNumber ? (
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
          className="flex h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-white text-sm font-bold text-indigo-700 transition active:scale-[0.98] touch-manipulation"
        >
          {expanded
            ? "Gizle"
            : `Tümünü göster (${filtered.length})`}
        </button>
      ) : null}
    </div>
  );
}
