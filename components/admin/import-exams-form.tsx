"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  importMockExams,
  previewMockExamImport,
  type ImportedExamRow,
  type PreviewMockExamSummary,
} from "@/app/actions/mock-exam-actions";
import { todayInIstanbul } from "@/lib/week-utils";
import {
  selectImportSheet,
  suggestExamName,
  validateImportedRows,
  type ParseTytResults,
  type RowValidationIssue,
  type SheetInput,
  type SheetMatrix,
} from "@/lib/exam-import/parse-tyt-results";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

const MAX_ROWS = 5000;

export function ImportExamsForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseTytResults | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [rowIssues, setRowIssues] = useState<RowValidationIssue[]>([]);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(todayInIstanbul());
  const [preview, setPreview] = useState<PreviewMockExamSummary | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    unmatchedNumbers: string[];
    saved: ImportedExamRow[];
  } | null>(null);
  const [loading, setLoading] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetFileState() {
    setParsed(null);
    setSheetName("");
    setRowIssues([]);
    setPreview(null);
    setSummary(null);
    setError(null);
  }

  function handleFile(file: File | undefined) {
    setFileName(file ? file.name : null);
    resetFileState();
    setExamName("");
    if (!file) return;

    setParsing(true);
    file
      .arrayBuffer()
      .then((buf) => {
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sheets: SheetInput[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const matrix = ws
            ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
            : [];
          return { name, matrix: matrix as SheetMatrix };
        }).filter((s) => s.matrix.length > 0);

        if (sheets.length === 0) {
          setError("Belgede veri bulunamadı.");
          return;
        }

        const selected = selectImportSheet(sheets);
        if (!selected) {
          setError(
            'Başlık satırı bulunamadı: "Numara" başlıklı satır içeren bir sayfa yok.',
          );
          return;
        }

        if (selected.result.errors.length > 0) {
          setError(selected.result.errors.join(" "));
          return;
        }
        if (selected.result.rows.length > MAX_ROWS) {
          setError(`Tek dosyada en fazla ${MAX_ROWS} satır olabilir.`);
          return;
        }
        if (selected.result.rows.length === 0) {
          setError("Dosyada öğrenci satırı bulunamadı.");
          return;
        }

        setParsed(selected.result);
        setSheetName(selected.sheet.name);
        setExamName(suggestExamName(file.name));
        setRowIssues(validateImportedRows(selected.result.rows));
      })
      .catch(() => {
        setError("Dosya okunurken bir hata oluştu.");
      })
      .finally(() => {
        setParsing(false);
      });
  }

  function buildPayload() {
    if (!parsed) return null;
    const name = examName.trim();
    if (!name) {
      setError("Deneme adı girin.");
      return null;
    }
    if (rowIssues.length > 0) {
      setError("Dosyadaki doğrulama hatalarını düzeltmeden devam edemezsiniz.");
      return null;
    }
    setError(null);
    return { examName: name, examDate, rows: parsed.rows };
  }

  async function handlePreview() {
    const payload = buildPayload();
    if (!payload) return;

    setLoading("preview");
    setSummary(null);
    try {
      const result = await previewMockExamImport(payload);
      if (result.success === true) {
        setPreview(result.data);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(null);
    }
  }

  async function handleSave() {
    const payload = buildPayload();
    if (!payload) return;

    setLoading("save");
    try {
      const result = await importMockExams(payload);
      if (result.success === true) {
        setSummary(result.data);
        setPreview(null);
        toast.success(result.message);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(null);
    }
  }

  const previewRows = parsed ? parsed.rows.slice(0, 5) : [];
  const canPreview =
    parsed !== null &&
    preview === null &&
    summary === null &&
    rowIssues.length === 0 &&
    loading === null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Deneme Sınavı Sonucu Yükle
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Edesis/Özdebir Excel dosyasını seçin. Sayfa, başlık ve sütunlar otomatik
          tanınır; önce önizleme ile eşleştirme sonucunu görürsünüz, onayladıktan
          sonra kaydedilir.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="exam-file" className={labelClass}>
              Excel / CSV Dosyası
            </label>
            <input
              id="exam-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {fileName ? (
              <p className="mt-1.5 text-xs font-medium text-gray-500">{fileName}</p>
            ) : null}
            {parsing ? (
              <p className="mt-1.5 text-xs font-medium text-indigo-600">
                Dosya okunuyor…
              </p>
            ) : null}
          </div>

          {parsed ? (
            <>
              <div className="rounded-xl bg-indigo-50 p-3 text-xs font-medium text-indigo-800">
                {parsed.format} · Sayfa: {sheetName} · Başlık satırı{" "}
                {parsed.headerRow + 1} · {parsed.rows.length} öğrenci satırı
              </div>

              {parsed.columnDetails.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {parsed.columnDetails.map((d) => (
                    <span
                      key={`${d.field}-${d.columnIndex}`}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600"
                      title={d.header}
                    >
                      {d.letter} · {d.fieldLabel}
                      {d.subject ? ` (${d.subject})` : ""}
                    </span>
                  ))}
                </div>
              ) : null}

              {parsed.warnings.length > 0 ? (
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-700">
                    Uyarılar ({parsed.warnings.length})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                    {parsed.warnings.slice(0, 8).map((w, i) => (
                      <li key={i}>
                        {w.row !== undefined ? `Satır ${w.row}: ` : ""}
                        {w.message}
                      </li>
                    ))}
                    {parsed.warnings.length > 8 ? (
                      <li>+{parsed.warnings.length - 8} uyarı daha…</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {rowIssues.length > 0 ? (
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="text-xs font-bold text-red-700">
                    Doğrulama hatası ({rowIssues.length})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                    {rowIssues.slice(0, 5).map((issue, i) => (
                      <li key={i}>
                        Satır {issue.row} ({issue.studentNumber}): {issue.message}
                      </li>
                    ))}
                    {rowIssues.length > 5 ? (
                      <li>+{rowIssues.length - 5} hata daha…</li>
                    ) : null}
                  </ul>
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    Dosyadaki tüm hatalar düzeltilmeden kaydetme yapılmaz.
                  </p>
                </div>
              ) : null}

              {previewRows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        <th className="px-3 py-2">No</th>
                        <th className="px-3 py-2">Ad Soyad</th>
                        <th className="px-3 py-2 text-right">Türkçe</th>
                        <th className="px-3 py-2 text-right">Mat.</th>
                        <th className="px-3 py-2 text-right">Toplam</th>
                        <th className="px-3 py-2 text-right">TYT P.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, idx) => (
                        <tr key={`${r.studentNumber}-${idx}`} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-xs font-semibold text-gray-900">
                            {r.studentNumber}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {r.studentName || "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-700">
                            {r.turkceNet ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-700">
                            {r.matematikNet ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-indigo-700">
                            {r.toplamNet ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-indigo-700">
                            {r.tytPuani ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > previewRows.length ? (
                    <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                      İlk {previewRows.length} satır gösteriliyor · toplam{" "}
                      {parsed.rows.length} satır
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="exam-name" className={labelClass}>
                    Deneme Adı
                  </label>
                  <input
                    id="exam-name"
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    className={inputClass}
                    placeholder="Örn. TYT-AYT 12. Deneme"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="exam-date" className={labelClass}>
                    Sınav Tarihi
                  </label>
                  <input
                    id="exam-date"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {parsed && !summary ? (
            preview === null ? (
              <button
                type="button"
                onClick={handlePreview}
                disabled={!canPreview || !examName.trim()}
                className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
              >
                {loading === "preview" ? "Önizleniyor…" : "Önizle"}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  disabled={loading !== null}
                  className="h-12 flex-1 rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-700 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  Geri
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading !== null}
                  className="h-12 flex-[2] rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  {loading === "save" ? "Kaydediliyor…" : "Onayla ve Kaydet"}
                </button>
              </div>
            )
          ) : null}
        </div>
      </div>

      {preview ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-indigo-900">
            Önizleme — Kayıt yapılmadı
          </h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Toplam
              </p>
              <p className="mt-1 text-lg font-bold text-gray-900">{preview.total}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">
                Eşleşen
              </p>
              <p className="mt-1 text-lg font-bold text-green-700">
                {preview.matched}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                Eşleşmeyen
              </p>
              <p className="mt-1 text-lg font-bold text-amber-700">
                {preview.unmatched}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Yeni kaydedilecek
              </p>
              <p className="mt-1 text-lg font-bold text-indigo-700">{preview.fresh}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Üzerine yazılacak
              </p>
              <p className="mt-1 text-lg font-bold text-indigo-700">
                {preview.existing}
              </p>
            </div>
          </div>

          {preview.nameMismatches.length > 0 ? (
            <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs font-medium text-amber-700">
              Aynı tarihte farklı adla kayıtlı denemeler var:{" "}
              {preview.nameMismatches.join(", ")}. Kaydedildiğinde bu kayıtların
              üzerine yazılacak.
            </p>
          ) : null}

          {preview.unmatchedNumbers.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-700">
                Eşleşmeyen öğrenci numaraları ({preview.unmatchedNumbers.length}):
              </p>
              <p className="mt-1 break-words text-xs text-gray-600">
                {preview.unmatchedNumbers.join(", ")}
              </p>
              <p className="mt-2 text-xs font-medium text-amber-600">
                İpucu: Eşleşmeyenlerin &quot;Öğrenci Numarası&quot; alanı Öğrenci
                Ekle formundan sistemde kayıtlı olmalı.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">İçe Aktarma Özeti</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Toplam
              </p>
              <p className="mt-1 text-lg font-bold text-gray-900">{summary.total}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">
                Eşleşen
              </p>
              <p className="mt-1 text-lg font-bold text-green-700">
                {summary.matched}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                Eşleşmeyen
              </p>
              <p className="mt-1 text-lg font-bold text-amber-700">
                {summary.unmatched}
              </p>
            </div>
          </div>

          {summary.matched > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">Öğrenci</th>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2 text-right">Toplam</th>
                    <th className="px-3 py-2 text-right">TYT Puanı</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.saved.map((r, idx) => (
                    <tr key={`${r.studentNumber}-${idx}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        {r.studentName}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {r.studentNumber}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                        {r.toplamNet.toLocaleString("tr-TR", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                        {r.tytPuani.toLocaleString("tr-TR", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {summary.unmatchedNumbers.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-600">
                Eşleşmeyen öğrenci numaraları ({summary.unmatchedNumbers.length}):
              </p>
              <p className="mt-1 break-words text-xs text-gray-500">
                {summary.unmatchedNumbers.join(", ")}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setSummary(null);
              setParsed(null);
              setSheetName("");
              setRowIssues([]);
              setFileName(null);
              setExamName("");
              setError(null);
              const input = document.getElementById(
                "exam-file",
              ) as HTMLInputElement | null;
              if (input) input.value = "";
            }}
            className="mt-4 h-12 w-full rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-700 transition active:scale-[0.98] touch-manipulation"
          >
            Yeni Dosya Yükle
          </button>
        </div>
      ) : null}
    </div>
  );
}
