export default function ActivitiesLoading() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl animate-pulse space-y-6">
        <div className="h-7 w-56 rounded-lg bg-gray-200" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded-2xl bg-gray-200" />
          <div className="h-24 rounded-2xl bg-gray-200" />
        </div>
        <div className="h-11 rounded-xl bg-gray-200" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 rounded-2xl bg-gray-200" />
          <div className="h-64 rounded-2xl bg-gray-200" />
        </div>
      </div>
    </main>
  );
}
