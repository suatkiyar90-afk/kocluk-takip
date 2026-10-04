import { auth } from "@/auth";
import { StudentRangeReport } from "@/components/reports/student-range-report";

interface ReportsSearchParams {
  student?: string;
  from?: string;
  to?: string;
  detail?: string;
  notes?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<ReportsSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const session = await auth();

  const initialStudentId =
    typeof params.student === "string" ? params.student : "";
  const initialFrom = typeof params.from === "string" ? params.from : "";
  const initialTo = typeof params.to === "string" ? params.to : "";
  const initialDetail = params.detail === "1";
  const initialNotes = params.notes === "1";

  return (
    <StudentRangeReport
      initialStudentId={initialStudentId}
      initialFrom={initialFrom}
      initialTo={initialTo}
      initialDetail={initialDetail}
      initialNotes={initialNotes}
      adminName={session?.user?.name ?? ""}
      schoolName={process.env.SCHOOL_NAME ?? "Koçluk Takip Sistemi"}
    />
  );
}
