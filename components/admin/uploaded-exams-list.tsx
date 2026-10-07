"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteMockExamGroup,
  listMockExamGroups,
  type MockExamGroup,
} from "@/app/actions/mock-exam-actions";

function formatDate(value: string): string {
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

export function UploadedExamsList() {
  const [groups, setGroups] = useState<MockExamGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listMockExamGroups();
    if (result.success === true) {
      setGroups(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(group: MockExamGroup) {
    const key = `${group.examName}|${group.examDate}`;
    const confirmed = window.confirm(
      `"${group.examName}" denemesinin ${group.studentCount} kaydı silinecek. Emin misiniz?`,
    );
    if (!confirmed) return;

    setBusyKey(key);
    try {
      const result = await deleteMockExamGroup({
        examName: group.examName,
        examDate: group.examDate,
      });
      if (result.success === true) {
        toast.success(result.message);
        await load();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Bilinmeyen bir hata oluştu.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Yüklü Denemeler</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Deneme adı ve tarihine göre gruplanır. Silme, o denemenin tüm öğrenci
        kayıtlarını kaldırır.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {groups === null && !error ? (
        <p className="mt-3 text-xs font-medium text-gray-500">Yükleniyor…</p>
      ) : null}

      {groups !== null && groups.length === 0 && !error ? (
        <p className="mt-3 text-xs font-medium text-gray-500">
          Henüz deneme sonucu yüklenmemiş.
        </p>
      ) : null}

      {groups !== null && groups.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {groups.map((g) => {
            const key = `${g.examName}|${g.examDate}`;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {g.examName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDate(g.examDate)} · {g.studentCount} öğrenci
                    {g.lastUploaded
                      ? ` · son yükleme ${new Date(g.lastUploaded).toLocaleString(
                          "tr-TR",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(g)}
                  disabled={busyKey !== null}
                  className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 active:scale-[0.97] disabled:opacity-50 touch-manipulation"
                >
                  {busyKey === key ? "Siliniyor…" : "Sil"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
