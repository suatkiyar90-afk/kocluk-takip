export function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Yükleniyor"
      className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        Yükleniyor...
      </div>
      <div className="space-y-2.5 pt-1">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={`h-4 animate-pulse rounded bg-gray-200 ${
              i % 3 === 0 ? "w-2/3" : i % 3 === 1 ? "w-5/6" : "w-1/2"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function PanelError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
      {message}
    </div>
  );
}
