import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMyPolicyStatus } from "@/app/actions/policy-actions";
import { documentForRole } from "@/lib/legal";
import { KvkkConsentScreen } from "@/components/legal/kvkk-consent-screen";

const HOME_BY_ROLE: Record<string, string> = {
  admin: "/admin",
  teacher: "/dashboard",
  student: "/quiz-entry",
};

export default async function KvkkPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const home = HOME_BY_ROLE[session.user.role ?? ""] ?? "/login";
  const status = await getMyPolicyStatus();
  if (status.status !== "required") {
    redirect(home);
  }

  const doc = documentForRole(session.user.role);
  if (!doc) {
    redirect(home);
  }

  return <KvkkConsentScreen doc={doc} homeHref={home} />;
}
