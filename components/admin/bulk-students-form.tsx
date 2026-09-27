"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  bulkCreateStudents,
  type BulkCreateData,
} from "@/app/actions/admin-actions";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

const NAME_KEYS = new Set([
  "ad_soyad",
  "adsoyad",
  "ad_soyadi",
  "ad",
  "isim_soyisim",
  "isim_soyad",
  "isim",
  "ogrenci_adi",
  "ogrenci_adsoyad",
  "ogrenci_ad_soyad",
  "soyad_ad",
]);

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

function findKey(keys: Set<string>, headers: string[]): number {
  return headers.findIndex((h) => keys.has(normalizeKey(h)));
}

interface ParsedRow {
  fullName: string;
  studentNumber: string;
}

export function BulkStudentsForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [missingRows, setMissingRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BulkCreateData | null>(null);

  const preview = useMemo(() => parsedRows.slice(0, 20), [parsedRows]);

  function handleFile(file: File | undefined) {
    setError(null);
    setSummary(null);
    setParsedRows([]);
    setMissingRows(0);
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
          setError("Dosya okunamadı: geçerli bir Excel/CSV dosyası seçin.");
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
        const nameIdx = findKey(NAME_KEYS, headers);
        const numberIdx = findKey(NUMBER_KEYS, headers);

        if (nameIdx === -1 || numberIdx === -1) {
          setError(
            "\"Ad Soyad\" ve \"Öğrenci No\" sütunları bulunamadı. Dosyanın ilk satırında bu başlıklar olmalı.",
          );
          return;
        }

        const rows: ParsedRow[] = [];
        let missing = 0;
        for (const r of jsonRows) {
          const fullName =
            typeof r[headers[nameIdx]] === "string"
              ? String(r[headers[nameIdx]]).trim()
              : "";
          const rawNumber = r[headers[numberIdx]];
          const studentNumber =
            typeof rawNumber === "number" || typeof rawNumber === "string"
              ? String(rawNumber).trim()
              : "";
          if (!fullName || !studentNumber) {
            missing += 1;
            continue;
          }
          rows.push({ fullName, studentNumber });
        }

        if (rows.length === 0) {
          setError("Dosyada geçerli (ad + numara) satır bulunamadı.");
          return;
        }

        setParsedRows(rows);
        setMissingRows(missing);
      })
      .catch(() => {
        setError("Dosya okunurken bir hata oluştu.");
      });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSummary(null);

    if (parsedRows.length === 0) {
      setError("Önce bir Excel/CSV dosyası seçin.");
      return;
    }

    setLoading(true);
    try {
      const result = await bulkCreateStudents({ rows: parsedRows });
      if (result.success === true) {
        setSummary(result.data);
        toast.success(result.message);
        setParsedRows([]);
        setFileName(null);
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
        <h2 className="text-sm font-semibold text-gray-900">
          Excel / CSV Dosyası
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Dosyanın ilk satırı başlık olmalı: &quot;Ad Soyad&quot; ve
          &quot;Öğrenci No&quot;. Öğrenciler öğrenci numarası + 123456 ile
          giriş yapar; ilk girişte şifre değiştirmeleri istenir.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="bulk-file" className={labelClass}>
              Öğrenci Listesi Dosyası
            </label>
            <input
              id="bulk-file"
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
            <div className="rounded-xl bg-indigo-50 p-3 text-xs font-medium text-indigo-800">
              {parsedRows.length} satır yüklendi
              {missingRows > 0 ? ` · ${missingRows} satır eksik veri nedeniyle atlandı` : ""}
            </div>
          ) : null}

          {preview.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">Ad Soyad</th>
                    <th className="px-3 py-2">Öğrenci No</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, idx) => (
                    <tr
                      key={`${r.studentNumber}-${idx}`}
                      className="border-t border-gray-100"
                    >
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        {r.fullName}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {r.studentNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > preview.length ? (
                <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-medium text-gray-500">
                  … ve {parsedRows.length - preview.length} satır daha
                </p>
              ) : null}
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
            {loading ? "Ekleniyor…" : "Öğrencileri Ekle"}
          </button>
        </div>
      </div>

      {summary ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Sonuç</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-green-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">
                Eklenen
              </p>
              <p className="mt-1 text-lg font-bold text-green-700">
                {summary.created}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                Atlanan
              </p>
              <p className="mt-1 text-lg font-bold text-amber-700">
                {summary.skipped.length}
              </p>
            </div>
          </div>

          {summary.skipped.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-600">
                Atlanan satırlar:
              </p>
              <ul className="mt-1.5 space-y-1">
                {summary.skipped.map((s, idx) => (
                  <li
                    key={`${s.studentNumber}-${idx}`}
                    className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600"
                  >
                    <span className="font-bold text-gray-900">
                      {s.fullName}
                    </span>{" "}
                    ({s.studentNumber}) — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.created > 0 ? (
            <p className="mt-4 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-medium text-indigo-800">
              Öğrenciler <span className="font-bold">öğrenci numarası + 123456</span>{" "}
              ile giriş yapabilir; ilk girişte yeni şifre belirlemeleri istenir.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
