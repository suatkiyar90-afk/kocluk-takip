"use client";

import { StudentRangeReport } from "@/components/reports/student-range-report";

interface TeacherReportsTabProps {
  studentId: string;
  actorName?: string;
  schoolName?: string;
}

export function TeacherReportsTab({
  studentId,
  actorName = "",
  schoolName = "",
}: TeacherReportsTabProps) {
  return (
    <StudentRangeReport
      initialStudentId=""
      initialFrom=""
      initialTo=""
      initialDetail={false}
      initialNotes={false}
      fixedStudentId={studentId}
      generateLabel="Raporu Göster"
      introText="İstediğin tarih aralığı için rapor al."
      adminName={actorName}
      schoolName={schoolName}
    />
  );
}
