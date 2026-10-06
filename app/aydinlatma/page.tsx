import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { getLegalDocument } from "@/lib/legal";

interface AydinlatmaPageProps {
  searchParams: Promise<{ rol?: string; geri?: string }>;
}

const TABS = [
  { param: "ogrenci", label: "Öğrenci" },
  { param: "ogretmen", label: "Öğretmen" },
] as const;

export default async function AydinlatmaPage({
  searchParams,
}: AydinlatmaPageProps) {
  const params = await searchParams;
  const activeParam = params.rol === "ogretmen" ? "ogretmen" : "ogrenci";
  const doc =
    activeParam === "ogretmen"
      ? getLegalDocument("kvkk_teacher")
      : getLegalDocument("kvkk_student");
  const showBack = params.geri === "kvkk";

  function hrefFor(param: string): string {
    return param === activeParam
      ? `/aydinlatma?rol=${param}`
      : `/aydinlatma?rol=${param}${showBack ? "&geri=kvkk" : ""}`;
  }

  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
        {showBack ? (
          <Link
            href="/kvkk"
            className="inline-block min-h-11 text-sm font-semibold text-indigo-600 underline underline-offset-2"
          >
            ← Onay ekranına dön
          </Link>
        ) : null}

        <h1 className="mt-2 text-xl font-extrabold leading-snug tracking-tight text-gray-900">
          {doc.title}
        </h1>

        <nav
          aria-label="Aydınlatma metni seçimi"
          className="mt-4 flex gap-2"
        >
          {TABS.map((tab) => {
            const active = tab.param === activeParam;
            return (
              <Link
                key={tab.param}
                href={hrefFor(tab.param)}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "inline-flex h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"
                    : "inline-flex h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <LegalDocument doc={doc} />

        <p className="mt-8 text-xs text-gray-500">Sürüm: {doc.version}</p>
      </div>
    </main>
  );
}
