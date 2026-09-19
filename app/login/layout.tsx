import "../globals.css";

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
      <body>{children}</body>
    </html>
  );
}