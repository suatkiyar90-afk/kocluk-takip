import type { Metadata } from "next";
import { auth } from "@/auth";
import { PrintToolbar } from "@/components/reports/print-toolbar";
import { StudentRangeReport } from "@/components/reports/student-range-report";
import {
  loadPrintReport,
  resolvePrintTitle,
  type PrintReportErrorCode,
} from "@/lib/report-print";

export const dynamic = "force-dynamic";

interface PrintPageSearchParams
  extends Record<string, string | string[] | undefined> {
  student?: string;
  from?: string;
  to?: string;
  detail?: string;
  notes?: string;
  auto?: string;
}

const ERROR_MESSAGES: Record<PrintReportErrorCode, string> = {
  ACCESS: "Bu rapora erişim yetkiniz yok.",
  RANGE: "Geçersiz tarih aralığı.",
  PARAMS: "Geçersiz tarih aralığı.",
  DATA: "Rapor oluşturulurken bir hata oluştu.",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PrintPageSearchParams>;
}): Promise<Metadata> {
  const raw = (await searchParams) ?? {};
  return { title: await resolvePrintTitle(raw) };
}

export default async function RaporYazdirPage({
  searchParams,
}: {
  searchParams: Promise<PrintPageSearchParams>;
}) {
  const raw = (await searchParams) ?? {};
  const session = await auth();
  const auto =
    (typeof raw.auto === "string" ? raw.auto : "").trim() === "1";
  const loaded = await loadPrintReport(raw);

  if (loaded.ok === false) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <PrintToolbar autoStart={false} />
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-extrabold text-gray-900">Rapor</h1>
            <p className="mt-2 text-sm font-medium text-gray-700">
              {ERROR_MESSAGES[loaded.error]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const report = loaded.report;

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PrintToolbar autoStart={auto} />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <StudentRangeReport
          initialStudentId=""
          initialFrom=""
          initialTo=""
          initialDetail={false}
          initialNotes={false}
          adminName={session?.user?.name ?? ""}
          schoolName={process.env.SCHOOL_NAME ?? "Koçluk Takip Sistemi"}
          fixedStudentId={report.student.id}
          printMode
          initialReport={report}
        />
      </div>
    </div>
  );
}
