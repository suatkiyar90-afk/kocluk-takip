"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acknowledgeMyPolicy } from "@/app/actions/policy-actions";
import type { LegalDocumentModel } from "@/lib/legal/types";

interface KvkkConsentScreenProps {
  doc: LegalDocumentModel;
  homeHref: string;
}

export function KvkkConsentScreen({ doc, homeHref }: KvkkConsentScreenProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleParam = doc.key === "kvkk_student" ? "ogrenci" : "ogretmen";
  const fullTextHref = `/aydinlatma?rol=${roleParam}&geri=kvkk`;

  async function handleContinue() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await acknowledgeMyPolicy();
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.push(homeHref);
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-md items-center px-4">
          <span className="truncate text-base font-extrabold tracking-tight">
            Akademik Takip
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-56 pt-5">
        <h1 className="text-lg font-extrabold leading-snug tracking-tight">
          {doc.title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          {doc.summary.intro}
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700 marker:text-gray-400">
          {doc.summary.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>

        {doc.summary.minorNote ? (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {doc.summary.minorNote}
          </p>
        ) : null}

        <p className="mt-4">
          <Link
            href={fullTextHref}
            className="text-sm font-semibold text-indigo-600 underline underline-offset-2"
          >
            Aydınlatma metninin tamamını oku
          </Link>
        </p>

        <p className="mt-5 text-sm leading-relaxed text-gray-600">
          Devam etmek için aşağıdaki onay kutusunu işaretlemen yeterli.
        </p>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Aydınlatma metnini okudum ve anladım</span>
          </label>

          {error ? (
            <p role="alert" className="mt-1 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!checked || submitting}
            className="mt-2 h-12 w-full touch-manipulation rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "Kaydediliyor…" : "Devam Et"}
          </button>
        </div>
      </footer>
    </div>
  );
}
