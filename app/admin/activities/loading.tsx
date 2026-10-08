export default function ActivitiesLoading() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl animate-pulse space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded-lg bg-gray-200" />
            <div className="h-4 w-72 rounded-md bg-gray-200" />
          </div>
          <div className="h-11 w-28 rounded-xl bg-gray-200" />
        </div>
        <div className="h-11 rounded-xl bg-gray-200" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-200" />
          ))}
        </div>
      </div>
    </main>
  );
}
