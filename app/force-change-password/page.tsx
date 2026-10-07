import { Toaster } from "sonner";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForceChangePasswordForm } from "./force-change-password-form";

const HOME_BY_ROLE: Record<string, string> = {
  admin: "/admin",
  teacher: "/dashboard",
  student: "/quiz-entry",
};

export const metadata = {
  title: "Şifre Değiştir | Akademik Takip",
};

export default async function ForceChangePasswordPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.mustChangePassword !== true) {
    redirect(HOME_BY_ROLE[session.user.role ?? ""] ?? "/login");
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">Şifrenizi Değiştirin</h1>
        <p className="mt-1 text-sm text-gray-500">
          Güvenliğiniz için ilk girişte şifrenizi belirlemeniz gerekiyor. Yeni
          şifrenizi belirledikten sonra ana sayfanıza yönlendirileceksiniz.
        </p>

        <div className="mt-5">
          <ForceChangePasswordForm />
        </div>
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
