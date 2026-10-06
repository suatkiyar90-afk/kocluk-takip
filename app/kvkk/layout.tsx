import "../globals.css";
import { SchoolWatermark } from "@/components/brand/school-logo";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppleWebAppMeta } from "@/components/pwa/apple-web-app-meta";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  ...pwaMetadata,
  title: "Aydınlatma ve Onay | Akademik Takip",
};

export const viewport = pwaViewport;

export default function KvkkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppleWebAppMeta />
          <SwRegister />
          <SchoolWatermark />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
