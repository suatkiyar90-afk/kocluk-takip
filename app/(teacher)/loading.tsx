export default function TeacherLoading() {
  return (
    <main
      role="status"
      aria-label="Sayfa yükleniyor"
      className="min-h-dvh bg-gray-50 px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10"
    >
      <div className="mx-auto w-full max-w-md space-y-3 md:max-w-3xl xl:max-w-5xl">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
        <div className="h-28 animate-pulse rounded-2xl bg-gray-200" />
        <div className="h-12 animate-pulse rounded-2xl bg-gray-200" />
        <div className="h-11 w-2/3 animate-pulse rounded-full bg-gray-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200" />
      </div>
    </main>
  );
}
