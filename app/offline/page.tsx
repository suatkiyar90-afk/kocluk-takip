import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <WifiOff aria-hidden="true" className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-gray-900">Bağlantı yok</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          İnternet bağlantın kesildi gibi görünüyor. Bağlantını kontrol edip
          tekrar deneyebilirsin.
        </p>
        <form action="/" method="GET">
          <button
            type="submit"
            className="mt-5 h-12 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] touch-manipulation"
          >
            Yeniden Dene
          </button>
        </form>
      </div>
    </main>
  );
}
