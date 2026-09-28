import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudentPanel } from "@/components/student/student-panel";

export const metadata = {
  title: "Öğrenci Paneli | Koçluk Takip",
};

export default async function PanelPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "student") redirect("/dashboard");

  return <StudentPanel studentId={session.user.id} />;
}
