"use client";

interface WeeklyFeedbackBandProps {
  comment: string | null;
  weekLabel: string;
  onOpen: () => void;
}

/**
 * Haftalık sekmesindeki büyük dönüt formunun yerini alan tek satırlık bant.
 * Dönüt yazıldıysa özetini gösterir, yazılmadıysa değerlendirme ekranını açar.
 */
export function WeeklyFeedbackBand({
  comment,
  weekLabel,
  onOpen,
}: WeeklyFeedbackBandProps) {
  return (
    <section className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 shadow-sm">
      <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-sky-700">
        💬 Haftalık Dönüt
      </span>
      {comment ? (
        <>
          <p
            className="min-w-0 flex-1 truncate text-xs font-semibold text-sky-950"
            title={comment}
          >
            “{comment}”
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="h-8 shrink-0 rounded-lg border border-sky-300 bg-white px-2.5 text-[11px] font-bold text-sky-700 transition hover:bg-sky-100 active:scale-95 touch-manipulation"
          >
            ✏️ Düzenle / Özeti Gör
          </button>
        </>
      ) : (
        <>
          <p className="min-w-0 flex-1 text-xs font-semibold text-sky-900">
            Geçen haftanın ({weekLabel}) değerlendirmesi henüz girilmedi.
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="h-8 shrink-0 rounded-lg bg-sky-600 px-2.5 text-[11px] font-bold text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-700 active:scale-95 touch-manipulation"
          >
            ✨ Değerlendirme & Dönüt Ekranını Aç
          </button>
        </>
      )}
    </section>
  );
}
