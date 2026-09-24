"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importMockExams } from "@/app/actions/mock-exam-actions";
import type { ImportedExamRow } from "@/app/actions/mock-exam-actions";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

const NUMBER_KEYS = new Set([
  "okul_no",
  "okulno",
  "ogrenci_no",
  "ogrencino",
  "ogr_no",
  "ogrno",
  "student_no",
  "studentno",
  "student_number",
  "numara",
  "no",
  "sira_no",
  "sira",
  "ogrenci_numarasi",
]);

const TYT_KEYS = new Set(["tyt", "tyt_net", "tytnet", "tyt_n", "tytn"]);
const AYT_KEYS = new Set(["ayt", "ayt_net", "aytnet", "ayt_n", "aytn"]);
const EXAM_NAME_KEYS = new Set(["deneme_adi", "deneme", "sinav_adi", "sinav", "exam_name"]);
const DATE_KEYS = new Set(["tarih", "sinav_tarihi", "deneme_tarihi", "exam_date"]);

function normalizeKey(k: unknown): string {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./()]+/g, "_")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o");
}

function toNet(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}

function findKey(keys: Set<string>, headers: string[]): number {
  return headers.findIndex((h) => keys.has(normalizeKey(h)));
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return toISODateLocal(new Date());
}

interface ParsedRow {
  studentNumber: string;
  tytNet?: number;
  aytNet?: number;
}

export function ImportExamsForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(todayISO());
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    unmatchedNumbers: string[];
    saved: ImportedExamRow[];
  } | null>(null);

  const preview = useMemo(
    () => ({
      ok: parsedRows.filter((r) => r.tytNet !== undefined || r.aytNet !== undefined).length,
      noNet: parsedRows.filter((r) => r.tytNet === undefined && r.aytNet === undefined).length,
    }),
    [parsedRows],
  );

  function handleFile(file: File | undefined) {
    setError(null);
    setSummary(null);
    setParsedRows([]);
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);

    file
      .arrayBuffer()
      .then((buf) => {
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) {
          setError("Belge okunamadı: geçerli bir Excel/CSV dosyası seçin.");
          return;
        }
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
        });
        if (jsonRows.length === 0) {
          setError("Belgede veri bulunamadı.");
          return;
        }

        const headers = Object.keys(jsonRows[0]);
        const numberIdx = findKey(NUMBER_KEYS, headers);
        const tytIdx = findKey(TYT_KEYS, headers);
        const aytIdx = findKey(AYT_KEYS, headers);
        const examNameIdx = findKey(EXAM_NAME_KEYS, headers);
        const dateIdx = findKey(DATE_KEYS, headers);

        if (numberIdx === -1) {
          setError(
            "'Okul No' / 'OgrenciNo' sütunu bulunamadı. Dosyada öğrenci numarası sütunu olmalı.",
          );
          return;
        }
        if (tytIdx === -1 && aytIdx === -1) {
          setError("'TYT' veya 'AYT' net sütunu bulunamadı.");
          return;
        }

        const rows = jsonRows.map((r) => {
          const rawNumber = r[headers[numberIdx]];
          const studentNumber =
            typeof rawNumber === "number" || typeof rawNumber === "string"
              ? String(rawNumber).trim()
              : "";
          return {
            studentNumber,
            tytNet: tytIdx === -1 ? undefined : toNet(r[headers[tytIdx]]),
            aytNet: aytIdx === -1 ? undefined : toNet(r[headers[aytIdx]]),
          };
        });
        const filtered = rows.filter((r) => r.studentNumber !== "");

        if (!examName && examNameIdx !== -1) {
          const firstVal = jsonRows[0][headers[examNameIdx]];
          if (typeof firstVal === "string" && firstVal.trim() !== "") {
            setExamName(firstVal.trim());
          }
        }
        if (dateIdx !== -1) {
          const firstVal = jsonRows[0][headers[dateIdx]];
          if (firstVal instanceof Date) {
            setExamDate(toISODateLocal(firstVal));
          } else if (typeof firstVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(firstVal)) {
            setExamDate(firstVal);
          }
        }

        if (filtered.length === 0) {
          setError("Dosyada öğrenci numarası içeren satır bulunamadı.");
          return;
        }
        setParsedRows(filtered);
      })
      .catch(() => {
        setError("Dosya okunurken bir hata oluştu.");
      });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSummary(null);

    if (!examName.trim()) {
      setError("Deneme adı girin.");
      return;
    }
    if (parsedRows.length === 0) {
      setError("Önce bir Excel/CSV dosyası seçin.");
      return;
    }

    setLoading(true);
    try {
      const result = await importMockExams({
        examName: examName.trim(),
        examDate,
        rows: parsedRows,
      });
      if (result.success === true) {
        setSummary(result.data);
        toast.success(result.message);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Deneme Sınavı Sonucu Yükle</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Excel veya CSV dosyası seçin. Dosyadaki &quot;Okul No&quot; sütunu öğrenci
          numarasıyla eşleştirilir, TYT/AYT netleri kaydedilir.
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
              <p className="mt-1.5 text-xs font-medium text-gray-500">
                {fileName}
              </p>
            ) : null}
          </div>

          {parsedRows.length > 0 ? (
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
          ) : null}

          {parsedRows.length > 0 ? (
            <div className="rounded-xl bg-indigo-50 p-3 text-xs font-medium text-indigo-800">
              {parsedRows.length} satır yüklendi · {preview.ok} satırda net verisi var
              {preview.noNet > 0 ? ` · ${preview.noNet} satırda net verisi yok` : ""}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || parsedRows.length === 0}
            className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
          >
            {loading ? "Kaydediliyor…" : "Sonuçları Kaydet"}
          </button>
        </div>
      </div>

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
              <p className="mt-1 text-lg font-bold text-green-700">{summary.matched}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                Eşleşmeyen
              </p>
              <p className="mt-1 text-lg font-bold text-amber-700">{summary.unmatched}</p>
            </div>
          </div>

          {summary.matched > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">Öğrenci</th>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2 text-right">TYT</th>
                    <th className="px-3 py-2 text-right">AYT</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.saved.map((r, idx) => (
                    <tr key={`${r.studentNumber}-${idx}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-900">{r.studentName}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.studentNumber}</td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                        {r.tytNet.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                        {r.aytNet.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
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
              <p className="mt-2 text-xs font-medium text-amber-600">
                İpucu: Eşleşmeyen öğrencilerin &quot;Öğrenci Numarası&quot; alanı
                Öğrenci Ekle formundan sistemde kayıtlı olmalı.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}