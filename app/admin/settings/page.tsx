import { auth } from "@/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = {
  title: "Ayarlar | Akademik Takip",
};

const ROLE_LABELS: Record<string, string> = {
  student: "Öğrenci",
  teacher: "Öğretmen",
  admin: "Yönetici",
};

export default async function AdminSettingsPage() {
  const session = await auth();
  const name = session?.user?.name || "Kullanıcı";
  const roleLabel = session?.user?.role
    ? (ROLE_LABELS[session.user.role] ?? session.user.role)
    : "";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Ayarlar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Profil bilgilerinizi görüntüleyin ve şifrenizi değiştirin.
          </p>
        </header>

        <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Profilim</h2>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">
                {name}
              </p>
              {roleLabel ? (
                <p className="truncate text-xs text-gray-500">{roleLabel}</p>
              ) : null}
            </div>
          </div>
        </section>

        <ChangePasswordForm />
      </div>
    </main>
  );
}
