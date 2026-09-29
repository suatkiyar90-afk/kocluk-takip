import "../globals.css";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  ...pwaMetadata,
  title: "Bağlantı Yok | Koçluk Takip",
  robots: { index: false },
};

export const viewport = pwaViewport;

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-dvh bg-gray-50">
        <ThemeProvider>
          <AppleWebAppMeta />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
