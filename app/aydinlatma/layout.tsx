import "../globals.css";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";

export const metadata = {
  ...pwaMetadata,
  title: "Aydınlatma Metni | Akademik Takip",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = pwaViewport;

export default function AydinlatmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <SchoolWatermark />
        {children}
      </body>
    </html>
  );
}
