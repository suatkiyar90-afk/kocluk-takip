"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  listExamAnalysisPeriodsAdmin,
  previewExamAnalysisPeriod,
  saveExamAnalysisPeriod,
  type ExamAnalysisPeriodSummary,
  type ExamAnalysisPreview,
} from "@/app/actions/exam-analysis-actions";
import { formatAnalysisPeriodDate } from "@/lib/exam-analysis";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Dosya okunamadı."));
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

export function ExamAnalysisManager() {
  const [title, setTitle] = useState("");
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [consolidatedFile, setConsolidatedFile] = useState<File | null>(null);
  const [priorityFile, setPriorityFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExamAnalysisPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<ExamAnalysisPeriodSummary[] | null>(
    null,
  );
  const [periodsError, setPeriodsError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const consolidatedInputRef = useRef<HTMLInputElement>(null);
  const priorityInputRef = useRef<HTMLInputElement>(null);

  const loadPeriods = useCallback(async () => {
    const result = await listExamAnalysisPeriodsAdmin();
    if (result.success === true) {
      setPeriods(result.data);
      setPeriodsError(null);
    } else {
      setPeriodsError(result.message);
    }
  }, []);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  function resetSelection() {
    setEditingPeriodId(null);
    setTitle("");
    setConsolidatedFile(null);
    setPriorityFile(null);
    setPreview(null);
    setError(null);
    if (consolidatedInputRef.current) consolidatedInputRef.current.value = "";
    if (priorityInputRef.current) priorityInputRef.current.value = "";
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startUpdate(period: ExamAnalysisPeriodSummary) {
    setEditingPeriodId(period.id);
    setTitle(period.title);
    setConsolidatedFile(null);
    setPriorityFile(null);
    setPreview(null);
    setError(null);
    if (consolidatedInputRef.current) consolidatedInputRef.current.value = "";
    if (priorityInputRef.current) priorityInputRef.current.value = "";
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleFileChange(
    kind: "consolidated" | "priority",
    file: File | null,
  ) {
    if (kind === "consolidated") setConsolidatedFile(file);
    else setPriorityFile(file);
    setPreview(null);
    setError(null);
  }

  async function buildPayload() {
    if (!consolidatedFile || !priorityFile) {
      throw new Error("Lütfen iki Excel dosyasını da seçin.");
    }
    if (title.trim().length < 3) {
      throw new Error("Dönem adı en az 3 karakter olmalı.");
    }
    const [consolidatedBase64, priorityBase64] = await Promise.all([
      readFileAsBase64(consolidatedFile),
      readFileAsBase64(priorityFile),
    ]);
    return { consolidatedBase64, priorityBase64 };
  }

  async function handlePreview() {
    setBusy("preview");
    setError(null);
    try {
      const payload = await buildPayload();
      const result = await previewExamAnalysisPeriod(payload);
      if (result.success === true) {
        setPreview(result.data);
        if (result.data.unmatched.length > 0) {
          toast.warning(
            `${result.data.unmatched.length} öğrenci kullanıcı hesabıyla eşleşmedi.`,
          );
        } else {
          toast.success("Dosyalar okundu, eşleştirme tamamlandı.");
        }
      } else {
        setPreview(null);
        setError(result.message);
      }
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy("save");
    setError(null);
    try {
      const payload = await buildPayload();
      const result = await saveExamAnalysisPeriod({
        ...payload,
        title: title.trim(),
        ...(editingPeriodId !== null ? { periodId: editingPeriodId } : {}),
      });
      if (result.success === true) {
        toast.success(
          `"${result.data.title}" kaydedildi • ${result.data.matchedStudents} öğrenci`,
        );
        setPreview(null);
        setConsolidatedFile(null);
        setPriorityFile(null);
        setEditingPeriodId(null);
        setTitle("");
        if (consolidatedInputRef.current) consolidatedInputRef.current.value = "";
        if (priorityInputRef.current) priorityInputRef.current.value = "";
        await loadPeriods();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setBusy(null);
    }
  }

  const canSubmit =
    consolidatedFile !== null &&
    priorityFile !== null &&
    title.trim().length >= 3 &&
    busy === null;

  return (
    <div className="space-y-6">
      <div
        ref={formRef}
        className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {editingPeriodId !== null
                ? "Analiz Dönemini Güncelle"
                : "Yeni Analiz Dönemi Yükle"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Birleştirilmiş Karne ve Öncelikli Konu Listesi dosyalarını seçin.
              Önizleme ile eşleştirmeyi kontrol edip dönemi kaydedin.
            </p>
          </div>
          {editingPeriodId !== null ? (
            <button
              type="button"
              onClick={resetSelection}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
            >
              Yeni Dönem
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="analysis-title" className={labelClass}>
              Dönem Adı
            </label>
            <input
              id="analysis-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPreview(null);
              }}
              className={inputClass}
              placeholder="Örn. Ekim Ayı Analizi"
              autoComplete="off"
            />
          </div>

          {periods && periods.length > 0 ? (
            <div>
              <label htmlFor="analysis-existing" className={labelClass}>
                Mevcut Dönemi Güncelle (isteğe bağlı)
              </label>
              <select
                id="analysis-existing"
                value={editingPeriodId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    resetSelection();
                    return;
                  }
                  const period = periods.find(
                    (item) => item.id === Number(value),
                  );
                  if (period) startUpdate(period);
                }}
                className={inputClass}
              >
                <option value="">Yeni dönem oluştur</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="consolidated-file" className={labelClass}>
                Birleştirilmiş Karne (.xlsx)
              </label>
              <input
                ref={consolidatedInputRef}
                id="consolidated-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) =>
                  handleFileChange("consolidated", e.target.files?.[0] ?? null)
                }
                className="block w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Konu Özet + Konu Detay + Sınav Bilgileri sayfaları
              </p>
            </div>
            <div>
              <label htmlFor="priority-file" className={labelClass}>
                Öncelikli Konu Listesi (.xlsx)
              </label>
              <input
                ref={priorityInputRef}
                id="priority-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) =>
                  handleFileChange("priority", e.target.files?.[0] ?? null)
                }
                className="block w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Kayıp Puan + 1./2./3. öncelik sırası
              </p>
            </div>
          </div>

          {error !== null ? (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {preview !== null ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <StatBox
                  label="Eşleşen Öğrenci"
                  value={preview.matchedStudents}
                  tone="indigo"
                />
                <StatBox
                  label="Okunan Konu"
                  value={preview.counts.topicCount}
                  tone="emerald"
                />
                <StatBox
                  label="Alt Kazanım"
                  value={preview.counts.outcomeCount}
                  tone="sky"
                />
                <StatBox
                  label="Öncelikli Konu"
                  value={preview.counts.priorityTopicCount}
                  tone="rose"
                />
              </div>

              <div className="rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
                {preview.counts.studentCount} öğrenci okundu ·{" "}
                {preview.counts.examCount} deneme · {preview.matchedTopics} konu
                müfredatla eşleşti
              </div>

              {preview.warnings.length > 0 ? (
                <div className="rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-950/50">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-200">
                    Uyarılar ({preview.warnings.length})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-200">
                    {preview.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {preview.unmatched.length > 0 ? (
                <div className="rounded-xl bg-red-50 px-3 py-2.5 dark:bg-red-950/50">
                  <p className="text-xs font-bold text-red-700 dark:text-red-200">
                    Eşleşmeyen öğrenciler ({preview.unmatched.length})
                  </p>
                  <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-300">
                    Bu öğrenciler kullanıcı listesinde bulunamadığı için
                    kaydedilmez. Ad veya numara eşleşmesini kontrol edin.
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {preview.unmatched.slice(0, 30).map((student) => (
                      <li
                        key={`${student.name}-${student.studentNumber ?? ""}`}
                        className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 dark:bg-slate-900 dark:text-red-200 dark:ring-red-900"
                      >
                        {student.name}
                        {student.studentNumber
                          ? ` · No: ${student.studentNumber}`
                          : ""}
                      </li>
                    ))}
                    {preview.unmatched.length > 30 ? (
                      <li className="rounded-lg px-2 py-1 text-[11px] font-bold text-red-600 dark:text-red-300">
                        +{preview.unmatched.length - 30} öğrenci daha
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!canSubmit}
              className="h-12 flex-1 rounded-xl border border-indigo-200 bg-white text-base font-bold text-indigo-700 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
            >
              {busy === "preview" ? "Önizleniyor…" : "Önizle"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit || preview === null}
              className="h-12 flex-1 rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
            >
              {busy === "save" ? "Kaydediliyor…" : "Analiz Dönemini Kaydet"}
            </button>
          </div>
          {editingPeriodId !== null ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
              Güncelleme mevcut kayıtları silmez; eşleşen konu ve denemeler
              güncellenir. Yeni dosyada yer almayan eski satırlar korunur.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Yüklü Analiz Dönemleri
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Öğrenci ve öğretmen panellerinde en son yüklenen dönem varsayılan
          olarak açılır.
        </p>

        {periodsError !== null ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {periodsError}
          </p>
        ) : periods === null ? (
          <p className="mt-3 text-sm font-medium text-gray-400">Yükleniyor…</p>
        ) : periods.length === 0 ? (
          <p className="mt-3 rounded-xl bg-gray-50 px-3 py-4 text-center text-sm font-medium text-gray-500">
            Henüz analiz dönemi yüklenmedi.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {periods.map((period) => (
              <li
                key={period.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {period.title}
                    </span>
                    {period.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                        Aktif
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                    {formatAnalysisPeriodDate(period.createdAt)} ·{" "}
                    {period.studentCount} öğrenci · {period.topicCount} konu ·{" "}
                    {period.examCount} deneme
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startUpdate(period)}
                  className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"
                >
                  Güncelle
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "indigo" | "emerald" | "sky" | "rose";
}) {
  const tones: Record<"indigo" | "emerald" | "sky" | "rose", string> = {
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
  };
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-extrabold">{value}</p>
    </div>
  );
}
