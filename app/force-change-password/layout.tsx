import "../globals.css";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  ...pwaMetadata,
  title: "Şifre Değiştir | Akademik Takip",
};

export const viewport = pwaViewport;

export default function ForceChangePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-dvh bg-gray-50">
        <ThemeProvider>
          <SchoolWatermark />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
