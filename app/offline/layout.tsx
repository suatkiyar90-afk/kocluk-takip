import "../globals.css";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";

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
    <html lang="tr">
      <body className="min-h-dvh bg-gray-50">
        <AppleWebAppMeta />
        {children}
      </body>
    </html>
  );
}
