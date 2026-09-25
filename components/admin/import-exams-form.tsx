"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importMockExams } from "@/app/actions/mock-exam-actions";
import type { ImportedExamRow } from "@/app/actions/mock-exam-actions";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

const COLUMN_INDEX = {
  studentNumber: 2,
  turkceNet: 7,
  tarihNet: 10,
  cografyaNet: 13,
  felsefeNet: 16,
  dinNet: 19,
  matematikNet: 22,
  geometriNet: 25,
  fizikNet: 28,
  kimyaNet: 31,
  biyolojiNet: 34,
  toplamNet: 37,
  tytPuani: 38,
} as const;

type NetField = Exclude<keyof typeof COLUMN_INDEX, "studentNumber">;

const NET_FIELDS: NetField[] = [
  "turkceNet",
  "tarihNet",
  "cografyaNet",
  "felsefeNet",
  "dinNet",
  "matematikNet",
  "geometriNet",
  "fizikNet",
  "kimyaNet",
  "biyolojiNet",
  "toplamNet",
  "tytPuani",
];

function toNet(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
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
  turkceNet?: number;
  tarihNet?: number;
  cografyaNet?: number;
  felsefeNet?: number;
  dinNet?: number;
  matematikNet?: number;
  geometriNet?: number;
  fizikNet?: number;
  kimyaNet?: number;
  biyolojiNet?: number;
  toplamNet?: number;
  tytPuani?: number;
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
      ok: parsedRows.filter((r) => NET_FIELDS.some((f) => r[f] !== undefined)).length,
      noNet: parsedRows.filter((r) => NET_FIELDS.every((f) => r[f] === undefined)).length,
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
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: null,
        });
        if (matrix.length === 0) {
          setError("Belgede veri bulunamadı.");
          return;
        }

        // Edesis/Özdebir dosyalarında ilk 2-3 satır karmaşık bir başlıktır.
        // Öğrenci verisi, 3. sütunda (index 2) öğrenci numarası görünen satırda başlar.
        let startIdx = -1;
        const scanLimit = Math.min(matrix.length, 10);
        for (let i = 0; i < scanLimit; i++) {
          const cell = matrix[i]?.[COLUMN_INDEX.studentNumber];
          if (cell === null || cell === undefined || cell === "") continue;
          if (/^\d+$/.test(String(cell).trim())) {
            startIdx = i;
            break;
          }
        }
        if (startIdx === -1) startIdx = Math.min(3, matrix.length);

        const rows: ParsedRow[] = [];
        for (const cells of matrix.slice(startIdx)) {
          const rawNumber = cells?.[COLUMN_INDEX.studentNumber];
          const studentNumber =
            typeof rawNumber === "number" || typeof rawNumber === "string"
              ? String(rawNumber).trim()
              : "";
          if (!studentNumber) continue;
          rows.push({
            studentNumber,
            turkceNet: toNet(cells[COLUMN_INDEX.turkceNet]),
            tarihNet: toNet(cells[COLUMN_INDEX.tarihNet]),
            cografyaNet: toNet(cells[COLUMN_INDEX.cografyaNet]),
            felsefeNet: toNet(cells[COLUMN_INDEX.felsefeNet]),
            dinNet: toNet(cells[COLUMN_INDEX.dinNet]),
            matematikNet: toNet(cells[COLUMN_INDEX.matematikNet]),
            geometriNet: toNet(cells[COLUMN_INDEX.geometriNet]),
            fizikNet: toNet(cells[COLUMN_INDEX.fizikNet]),
            kimyaNet: toNet(cells[COLUMN_INDEX.kimyaNet]),
            biyolojiNet: toNet(cells[COLUMN_INDEX.biyolojiNet]),
            toplamNet: toNet(cells[COLUMN_INDEX.toplamNet]),
            tytPuani: toNet(cells[COLUMN_INDEX.tytPuani]),
          });
        }

        if (rows.length === 0) {
          setError("Dosyada öğrenci numarası içeren satır bulunamadı.");
          return;
        }
        setParsedRows(rows);
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
          Edesis/Özdebir Excel dosyası seçin. İlk 2-3 satırlık başlık otomatik
          atlanır; 3. sütundaki öğrenci numarası sistemdeki kayıtlarla
          eşleştirilir, tüm branş netleri ve TYT puanı kaydedilir.
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
                    <th className="px-3 py-2 text-right">Toplam</th>
                    <th className="px-3 py-2 text-right">TYT Puanı</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.saved.map((r, idx) => (
                    <tr key={`${r.studentNumber}-${idx}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-900">{r.studentName}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.studentNumber}</td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                        {r.toplamNet.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                        {r.tytPuani.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
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