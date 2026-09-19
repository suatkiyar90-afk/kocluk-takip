export const SCHOOL_LOGO_URL =
  "https://demirciihl.meb.k12.tr/meb_iys_dosyalar/45/05/182815/resimler/2020_05/04024746_YHL_PROJE_LOGO.jpg?CHK=0723e70a3fb85508f75f64297f8ece1c";

export function SchoolLogo({ className }: { className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={SCHOOL_LOGO_URL} alt="Okul Logosu" className={className} />
  );
}

export function SchoolWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[-1] flex items-center justify-center"
    >
      <SchoolLogo className="w-full max-w-md opacity-5" />
    </div>
  );
}