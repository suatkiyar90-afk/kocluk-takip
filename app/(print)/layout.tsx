import "../globals.css";

export const metadata = {
  title: "Rapor Yazdırma",
  robots: { index: false, follow: false },
};

const PRINT_STYLE = `
  @page { size: A4 portrait; margin: 12mm; }
  html { color-scheme: light; }
  html, body { background: #ffffff !important; }
  .report-block { break-inside: avoid; page-break-inside: avoid; }
  .report-root { background: #ffffff !important; color: #111827 !important; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  @media print {
    .report-root .text-gray-400,
    .report-root .text-gray-500 { color: #374151 !important; }
    .report-root .text-gray-600 { color: #1f2937 !important; }
    .report-root .text-gray-700 { color: #111827 !important; }
  }
`;

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-dvh bg-white text-gray-900 antialiased">
        <style>{PRINT_STYLE}</style>
        {children}
      </body>
    </html>
  );
}
