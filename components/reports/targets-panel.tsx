"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WeekPicker } from "@/components/ui/week-picker";
import { UploadDropzone } from "@/lib/uploadthing";
import { saveWeeklyScheduleFile } from "@/app/actions/weekly-target-actions";
import { isImageUrl, isPdfUrl } from "@/lib/schedule-file";
import {
  deleteWeeklyTarget,
  getWeeklyDenemeBundle,
  listWeeklyTargets,
  saveWeeklyDenemeTargets,
  saveWeeklyTarget,
  type WeeklyTargetView,
} from "@/app/actions/weekly-target-actions";
import {
  MAX_WEEK_TARGET_COUNT,
  MIN_WEEK_TARGET_COUNT,
  bransSubjects,
  denemeTypeOptions,
  getDenemeLabel,
} from "@/lib/deneme";
import type { CurriculumSnapshot } from "@/app/actions/curriculum-actions";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

interface DenemeItemRow {
  uid: number;
  denemeKey: string;
  targetCount: number;
}

interface TargetsPanelProps {
  studentId: string;
  weekStart: string;
  snapshot: CurriculumSnapshot | null;
}

function formatRange(mondayIso: string): string {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const opts = { day: "numeric", month: "long" } as const;
  return `${start.toLocaleDateString("tr-TR", opts)} - ${end.toLocaleDateString("tr-TR", opts)}`;
}

export function TargetsPanel({ studentId, weekStart, snapshot }: TargetsPanelProps) {
  const [targets, setTargets] = useState<WeeklyTargetView[]>([]);
  const [mode, setMode] = useState<"ders" | "deneme">("ders");
  const [subjectId, setSubjectId] = useState("");
  const [count, setCount] = useState("100");
  const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set());
  const [denemeItems, setDenemeItems] = useState<DenemeItemRow[]>([]);
  const [denemeSaving, setDenemeSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSchedule, setUploadingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const denemeUidRef = useRef(1);

  const refresh = useCallback(async () => {
    setLoadingList(true);
    const [listResult, denemeResult] = await Promise.all([
      listWeeklyTargets(studentId, weekStart),
      getWeeklyDenemeBundle(studentId, weekStart),
    ]);
    if (listResult.success === true) {
      setTargets(listResult.data);
      setError(null);
    } else {
      setError(listResult.message);
    }
    if (denemeResult.success === true) {
      setDenemeItems(
        denemeResult.data.targets.map((target) => ({
          uid: denemeUidRef.current++,
          denemeKey: target.denemeKey,
          targetCount: target.targetCount,
        })),
      );
    }
    setLoadingList(false);
  }, [studentId, weekStart]);

  useEffect(() => {
    setSubjectId("");
    setSelectedTopics(new Set());
    setMode("ders");
    void refresh();
  }, [refresh]);

  const subjectGroups = snapshot
    ? [...snapshot.tyt, ...snapshot.ayt, ...snapshot.ydt]
    : [];
  const activeGroup = subjectGroups.find((g) => g.subjectId === subjectId);
  const scheduleUrl =
    targets.find((t) => t.scheduleFileUrl !== null)?.scheduleFileUrl ?? null;

  function changeSubject(next: string) {
    setSubjectId(next);
    setSelectedTopics(new Set());
    const existing = targets.find((t) => t.subjectId === next);
    if (existing) {
      setCount(String(existing.targetQuestionCount));
      setSelectedTopics(new Set(existing.targetTopics.map((t) => t.topicId)));
    }
  }

  function toggleTopic(topicId: number) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }

  function usedDenemeKeys(exceptUid?: number): Set<string> {
    return new Set(
      denemeItems
        .filter((row) => row.uid !== exceptUid)
        .map((row) => row.denemeKey),
    );
  }

  function addDenemeRow() {
    const used = usedDenemeKeys();
    const firstFree = denemeTypeOptions
      .flatMap((type) =>
        type.key === "brans"
          ? bransSubjects.map(
              (subject) => `brans:${subject.id}`,
            )
          : type.key,
      )
      .find((key) => !used.has(key));
    if (firstFree === undefined) return;
    setDenemeItems((current) => [
      ...current,
      { uid: denemeUidRef.current++, denemeKey: firstFree, targetCount: 1 },
    ]);
  }

  function changeDenemeKey(uid: number, nextKey: string) {
    setDenemeItems((current) =>
      current.map((row) => (row.uid === uid ? { ...row, denemeKey: nextKey } : row)),
    );
  }

  function changeDenemeCount(uid: number, delta: number) {
    setDenemeItems((current) =>
      current.map((row) =>
        row.uid === uid
          ? {
              ...row,
              targetCount: Math.min(
                MAX_WEEK_TARGET_COUNT,
                Math.max(MIN_WEEK_TARGET_COUNT, row.targetCount + delta),
              ),
            }
          : row,
      ),
    );
  }

  function removeDenemeRow(uid: number) {
    setDenemeItems((current) => current.filter((row) => row.uid !== uid));
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (mode === "deneme") {
      setDenemeSaving(true);
      try {
        const result = await saveWeeklyDenemeTargets({
          studentId,
          weekStart,
          items: denemeItems.map((row) => ({
            denemeKey: row.denemeKey,
            targetCount: row.targetCount,
          })),
        });
        if (result.success === true) {
          toast.success("Deneme hedefleri kaydedildi.");
          await refresh();
        } else {
          setError(result.message);
        }
      } catch {
        setError("Bilinmeyen bir hata oluştu.");
      } finally {
        setDenemeSaving(false);
      }
      return;
    }

    const parsedCount = Number(count);
    if (subjectId === "") {
      setError("Önce bir ders seçin.");
      return;
    }
    if (!Number.isInteger(parsedCount) || parsedCount < 1) {
      setError("Hedef soru sayısı en az 1 olmalı.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveWeeklyTarget({
        studentId,
        weekStart,
        subjectId,
        targetQuestionCount: parsedCount,
        targetTopics: [...selectedTopics],
      });
      if (result.success === true) {
        toast.success("Haftalık hedef kaydedildi.");
        setSubjectId("");
        setSelectedTopics(new Set());
        await refresh();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(targetId: number) {
    const result = await deleteWeeklyTarget(targetId);
    if (result.success === true) {
      toast.success("Hedef silindi.");
      await refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleScheduleUpload(url: string | undefined | null) {
    if (!url) return;
    setUploadingSchedule(true);
    try {
      const result = await saveWeeklyScheduleFile(studentId, weekStart, url);
      if (result.success === true) {
        toast.success("Haftalık çizelge yüklendi.");
        await refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Çizelge kaydedilirken bir hata oluştu.");
    } finally {
      setUploadingSchedule(false);
    }
  }

  return (
    <div className="space-y-6">
      <WeekPicker monday={weekStart} />

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Hedef Belirle · {formatRange(weekStart)}
        </h2>

        <form
          onSubmit={handleSave}
          noValidate
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <p className={labelClass}>Hedef Türü</p>
              <div
                role="radiogroup"
                aria-label="Hedef türü"
                className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "ders"}
                  onClick={() => setMode("ders")}
                  className={`h-11 rounded-xl text-sm font-semibold transition-colors touch-manipulation ${
                    mode === "ders"
                      ? "bg-white text-indigo-700 shadow"
                      : "text-gray-500"
                  }`}
                >
                  Ders
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "deneme"}
                  onClick={() => setMode("deneme")}
                  className={`h-11 rounded-xl text-sm font-semibold transition-colors touch-manipulation ${
                    mode === "deneme"
                      ? "bg-white text-indigo-700 shadow"
                      : "text-gray-500"
                  }`}
                >
                  Deneme
                </button>
              </div>
            </div>

            {mode === "ders" ? (
            <>
            <div>
              <label htmlFor="target-subject" className={labelClass}>
                Ders
              </label>
              <select
                id="target-subject"
                value={subjectId}
                onChange={(e) => changeSubject(e.target.value)}
                className={inputClass}
              >
                <option value="">Ders seçin</option>
                {subjectGroups.map((g) => (
                  <option key={g.subjectId} value={g.subjectId}>
                    {g.subjectName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="target-count" className={labelClass}>
                Hedef Soru Sayısı
              </label>
              <input
                id="target-count"
                type="number"
                min={1}
                max={10000}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className={inputClass}
                placeholder="Örn. 100"
                disabled={subjectId === ""}
              />
            </div>

            {activeGroup ? (
              <div>
                <p className={labelClass}>
                  Bitirilecek Konular ({selectedTopics.size}/
                  {activeGroup.topics.length})
                </p>
                {activeGroup.topics.length > 0 ? (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/60 p-2.5">
                    {activeGroup.topics.map((topic) => {
                      const checked = selectedTopics.has(topic.topicId);
                      return (
                        <label
                          key={topic.topicId}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${
                            checked
                              ? "bg-indigo-50 ring-1 ring-indigo-200"
                              : "bg-white ring-1 ring-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTopic(topic.topicId)}
                            className="h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-medium text-gray-700">
                            {topic.topicName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
                    Bu ders için müfredat konusu bulunamadı.
                  </p>
                )}
                <p className="mt-1.5 text-[11px] font-medium text-gray-500">
                  Konu seçimi isteğe bağlıdır; soru hedefi tek başına da
                  kaydedilebilir.
                </p>
              </div>
            ) : null}
            </>
            ) : (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                  Deneme Hedefleri
                </p>

                {denemeItems.length === 0 ? (
                  <p className="mt-2.5 rounded-lg bg-white px-3 py-2.5 text-xs font-medium text-gray-500">
                    Henüz deneme hedefi eklemedin. “+ Deneme Ekle” ile başla.
                  </p>
                ) : (
                  <ul className="mt-2.5 space-y-2.5">
                    {denemeItems.map((row) => {
                      const isBrans = row.denemeKey.startsWith("brans:");
                      const used = usedDenemeKeys(row.uid);
                      return (
                        <li
                          key={row.uid}
                          className="rounded-xl border border-gray-200 bg-white p-2.5"
                        >
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[8.75rem] flex-1">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Deneme Türü
                              </p>
                              <select
                                aria-label="Deneme türü"
                                value={isBrans ? "brans" : row.denemeKey}
                                onChange={(e) =>
                                  changeDenemeKey(
                                    row.uid,
                                    e.target.value === "brans"
                                      ? `brans:${bransSubjects[0].id}`
                                      : e.target.value,
                                  )
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 touch-manipulation"
                              >
                                {denemeTypeOptions.map((option) => (
                                  <option
                                    key={option.key}
                                    value={option.key}
                                    disabled={
                                      option.key !== "brans" &&
                                      used.has(option.key) &&
                                      row.denemeKey !== option.key
                                    }
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {isBrans ? (
                              <div className="min-w-[8.75rem] flex-1">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                  Ders
                                </p>
                                <select
                                  aria-label="Branş dersi"
                                  value={
                                    row.denemeKey.slice("brans:".length) ||
                                    bransSubjects[0].id
                                  }
                                  onChange={(e) =>
                                    changeDenemeKey(
                                      row.uid,
                                      `brans:${e.target.value}`,
                                    )
                                  }
                                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 touch-manipulation"
                                >
                                  {bransSubjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>
                                      {subject.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            <div className="w-[7.5rem]">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Adet
                              </p>
                              <div className="flex h-11 items-center justify-between rounded-xl border border-gray-200 bg-white px-1">
                                <button
                                  type="button"
                                  aria-label="Adedi azalt"
                                  disabled={
                                    row.targetCount <= MIN_WEEK_TARGET_COUNT
                                  }
                                  onClick={() => changeDenemeCount(row.uid, -1)}
                                  className="h-9 w-9 rounded-lg text-lg font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-30 touch-manipulation"
                                >
                                  −
                                </button>
                                <span className="text-sm font-bold text-gray-900">
                                  {row.targetCount}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Adedi artır"
                                  disabled={
                                    row.targetCount >= MAX_WEEK_TARGET_COUNT
                                  }
                                  onClick={() => changeDenemeCount(row.uid, 1)}
                                  className="h-9 w-9 rounded-lg text-lg font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-30 touch-manipulation"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              aria-label="Deneme hedefini sil"
                              onClick={() => removeDenemeRow(row.uid)}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-base text-red-600 transition active:scale-95 touch-manipulation"
                            >
                              🗑
                            </button>
                          </div>

                          <p className="mt-1.5 text-[11px] font-semibold text-gray-500">
                            {row.targetCount} adet{" "}
                            {getDenemeLabel(row.denemeKey) ?? "Geçersiz deneme"}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={addDenemeRow}
                  className="mt-3 h-11 w-full rounded-xl border-2 border-dashed border-indigo-300 text-sm font-bold text-indigo-600 transition hover:bg-indigo-50 touch-manipulation"
                >
                  + Deneme Ekle
                </button>

                <p className="mt-2 text-[11px] font-medium text-gray-500">
                  Kaydet ile bu haftanın deneme hedefleri güncellenir; listeden
                  çıkardıkların silinir.
                </p>
              </div>
            )}

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                mode === "ders"
                  ? saving || subjectId === ""
                  : denemeSaving
              }
              className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
            >
              {mode === "ders"
                ? saving
                  ? "Kaydediliyor…"
                  : "Hedefi Kaydet"
                : denemeSaving
                  ? "Kaydediliyor…"
                  : "Deneme Hedeflerini Kaydet"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Haftalık Çalışma Çizelgesi
        </h2>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {scheduleUrl ? (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                ✓ Bu haftanın çizelgesi yüklü
              </p>
              {isImageUrl(scheduleUrl) ? (
                <img
                  src={scheduleUrl}
                  alt="Haftalık çalışma çizelgesi"
                  className="mt-2.5 max-h-56 w-full rounded-lg border border-green-200 bg-white object-contain"
                />
              ) : null}
                <a
                  href={scheduleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-green-700 ring-1 ring-green-200 transition hover:bg-green-100 touch-manipulation"
                >
                  {isPdfUrl(scheduleUrl)
                    ? "📄 Çizelgeyi Görüntüle"
                    : "📎 Dosyayı Görüntüle"}
                </a>
            </div>
          ) : (
            <p className="mb-4 rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs font-medium text-gray-500">
              Bu hafta için henüz çizelge yüklenmedi. Öğrencine görsel (PNG,
              JPG) veya PDF olarak haftalık çalışma çizelgeni yükle.
            </p>
          )}

          <UploadDropzone
            endpoint="scheduleUploader"
            className="ut-allowed-content:text-gray-500"
            onClientUploadComplete={(res) => {
              void handleScheduleUpload(res?.[0]?.url);
            }}
            onUploadError={(err) => {
              toast.error(err.message);
            }}
            disabled={uploadingSchedule}
          />

          {uploadingSchedule ? (
            <p className="mt-3 text-center text-xs font-semibold text-indigo-600">
              Çizelge kaydediliyor...
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Bu Haftanın Hedefleri
        </h2>

        {loadingList ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
            Yükleniyor…
          </div>
        ) : targets.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
            Bu hafta için henüz hedef girilmedi.
          </div>
        ) : (
          <div className="space-y-2">
            {targets.map((t) => {
              const pct =
                t.targetQuestionCount > 0
                  ? Math.min(
                      Math.round((t.solvedCount / t.targetQuestionCount) * 100),
                      100,
                    )
                  : 0;
              const reached = t.solvedCount >= t.targetQuestionCount;
              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">
                        {t.subjectName}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-gray-500">
                        Hedef {t.targetQuestionCount} soru · Çözülen{" "}
                        {t.solvedCount}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="flex h-11 shrink-0 items-center rounded-lg border border-red-200 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition active:scale-95 touch-manipulation"
                    >
                      Sil
                    </button>
                  </div>

                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-[width] ${
                        reached ? "bg-green-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {t.targetTopics.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.targetTopics.map((topic) => (
                        <span
                          key={topic.topicId}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            topic.solved
                              ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                              : "bg-gray-50 text-gray-600 ring-1 ring-gray-200"
                          }`}
                        >
                          {topic.solved ? "✓ " : ""}
                          {topic.topicName}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
