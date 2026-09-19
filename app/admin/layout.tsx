import "../globals.css";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata = {
  title: "Yönetici Paneli | Koçluk Takip",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-dvh bg-gray-50">
        <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
            <span className="text-base font-extrabold tracking-tight text-gray-900">
              Koçluk Takip — Yönetici
            </span>
            <LogoutButton />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}