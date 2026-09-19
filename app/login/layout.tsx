import "../globals.css";
import { SchoolWatermark } from "@/components/brand/school-logo";

export const metadata = {
  title: "Giriş Yap | Koçluk Takip",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <SchoolWatermark />
        {children}
      </body>
    </html>
  );
}