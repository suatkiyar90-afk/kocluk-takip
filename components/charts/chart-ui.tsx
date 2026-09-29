import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";

export function ChartEmpty({ hint }: { hint: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 text-center">
      <BarChart3 className="h-6 w-6 text-gray-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-gray-500">Henüz veri yok</p>
      <p className="max-w-xs text-xs leading-relaxed text-gray-400">{hint}</p>
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      role="status"
      aria-label="Grafik yükleniyor"
      className="w-full animate-pulse rounded-xl bg-gray-100"
      style={{ height }}
    />
  );
}

export function ChartCard({
  title,
  subtitle,
  ariaLabel,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
      ) : null}
      <div
        role="img"
        aria-label={ariaLabel}
        className="mt-3 h-[240px] w-full overflow-hidden"
      >
        {children}
      </div>
      {footer}
    </section>
  );
}
