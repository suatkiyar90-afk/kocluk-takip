"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  adminGetGradeSettings,
  adminUpdateGradeSettings,
  type AdminGradeSettings,
} from "@/app/actions/admin-actions";
import {
  GRADE_LABELS,
  GRADE_LEVELS,
  formatHourRange,
  type GradeLevel,
  type GradeSettings,
} from "@/lib/grade-config";

const HOURS = Array.from({ length: 25 }, (_, index) => index);

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

export function GradeSettingsCard() {
  const [settings, setSettings] = useState<AdminGradeSettings | null>(null);
  const [drafts, setDrafts] = useState<Record<GradeLevel, GradeSettings> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [savingLevel, setSavingLevel] = useState<GradeLevel | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGetGradeSettings();
      if (result.success === true) {
        setSettings(result.data.settings);
        setDrafts(result.data.settings);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Giriş saatleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(level: GradeLevel, patch: Partial<GradeSettings>) {
    setDrafts((prev) =>
      prev ? { ...prev, [level]: { ...prev[level], ...patch } } : prev,
    );
  }

  async function handleSave(level: GradeLevel) {
    if (!drafts) return;
    const draft = drafts[level];
    setSavingLevel(level);
    try {
      const result = await adminUpdateGradeSettings({
        gradeLevel: level,
        entryStartHour: draft.entryStartHour,
        entryEndHour: draft.entryEndHour,
        enforceTimeWindow: draft.enforceTimeWindow,
      });
      if (result.success === true) {
        toast.success(result.message);
        setSettings((prev) =>
          prev ? { ...prev, [level]: result.data.settings } : prev,
        );
        setDrafts((prev) =>
          prev ? { ...prev, [level]: result.data.settings } : prev,
        );
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Giriş saatleri kaydedilemedi.");
    } finally {
      setSavingLevel(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Clock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            Sınıf Grubu Veri Giriş Saatleri
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Her sınıf grubunun günlük soru girişi yapabileceği saat aralığını
            belirleyin. Zorunlu tutma kapalıyken öğrenciler her saat giriş
            yapabilir.
          </p>
        </div>
      </div>

      {loading || !drafts ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-medium text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Yükleniyor…
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {GRADE_LEVELS.map((level) => {
            const draft = drafts[level];
            const dirty =
              !settings ||
              settings[level].entryStartHour !== draft.entryStartHour ||
              settings[level].entryEndHour !== draft.entryEndHour ||
              settings[level].enforceTimeWindow !== draft.enforceTimeWindow;
            const busy = savingLevel === level;
            return (
              <div
                key={level}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">
                    {GRADE_LABELS[level]}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                    {formatHourRange(draft.entryStartHour, draft.entryEndHour)}
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={`grade-${level}-start`}
                      className="mb-1 block text-[11px] font-bold text-gray-500"
                    >
                      Başlangıç Saati
                    </label>
                    <select
                      id={`grade-${level}-start`}
                      value={draft.entryStartHour}
                      disabled={busy}
                      onChange={(e) =>
                        updateDraft(level, {
                          entryStartHour: Number(e.target.value),
                        })
                      }
                      className={inputClass}
                    >
                      {HOURS.slice(0, 24).map((hour) => (
                        <option key={hour} value={hour}>
                          {String(hour).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`grade-${level}-end`}
                      className="mb-1 block text-[11px] font-bold text-gray-500"
                    >
                      Bitiş Saati
                    </label>
                    <select
                      id={`grade-${level}-end`}
                      value={draft.entryEndHour}
                      disabled={busy}
                      onChange={(e) =>
                        updateDraft(level, {
                          entryEndHour: Number(e.target.value),
                        })
                      }
                      className={inputClass}
                    >
                      {HOURS.slice(1).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour === 24
                            ? "00:00 (ertesi gün)"
                            : `${String(hour).padStart(2, "0")}:00`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-lg bg-white px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={draft.enforceTimeWindow}
                    disabled={busy}
                    onChange={(e) =>
                      updateDraft(level, {
                        enforceTimeWindow: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    <span className="inline-flex items-center gap-1 font-bold text-gray-900">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Saat kısıtlamasını zorunlu tut
                    </span>
                    <br />
                    Açıkken öğrenci yalnızca bu aralıkta veri girebilir.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => void handleSave(level)}
                  disabled={busy || !dirty}
                  className="mt-2.5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Kaydediliyor…
                    </>
                  ) : (
                    "Kaydet"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
