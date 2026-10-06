export interface PolicyOverviewRowInput {
  id: string;
  name: string;
  role: string;
  studentNumber: string | null;
  lastSeenAt: string | null;
  assignedTeacher: string | null;
  acknowledgedAt: string | null;
}

export interface PolicyOverviewPerson {
  id: string;
  name: string;
  role: "student" | "teacher";
  studentNumber: string | null;
  lastSeenAt: string | null;
  assignedTeacher: string | null;
  acknowledgedAt: string | null;
}

export interface PolicyOverviewCounts {
  total: number;
  acknowledged: number;
  notAcknowledged: number;
}

export interface PolicyAcknowledgmentVersions {
  studentVersion: string;
  teacherVersion: string;
}

export interface PolicyAcknowledgmentOverview
  extends PolicyAcknowledgmentVersions {
  students: PolicyOverviewCounts;
  teachers: PolicyOverviewCounts;
  notAcknowledged: PolicyOverviewPerson[];
  acknowledged: PolicyOverviewPerson[];
}

function isTrackedRole(role: string): role is "student" | "teacher" {
  return role === "student" || role === "teacher";
}

function summarize(people: PolicyOverviewPerson[]): PolicyOverviewCounts {
  const acknowledged = people.filter((p) => p.acknowledgedAt !== null).length;
  return {
    total: people.length,
    acknowledged,
    notAcknowledged: people.length - acknowledged,
  };
}

const byName = (a: PolicyOverviewPerson, b: PolicyOverviewPerson) =>
  a.name.localeCompare(b.name, "tr");

export function buildPolicyAcknowledgmentOverview(
  rows: readonly PolicyOverviewRowInput[],
  versions: PolicyAcknowledgmentVersions,
): PolicyAcknowledgmentOverview {
  const people: PolicyOverviewPerson[] = [];
  for (const row of rows) {
    if (!isTrackedRole(row.role)) {
      continue;
    }
    people.push({
      id: row.id,
      name: row.name || "İsimsiz kullanıcı",
      role: row.role,
      studentNumber: row.role === "student" ? row.studentNumber : null,
      lastSeenAt: row.lastSeenAt,
      assignedTeacher: row.role === "student" ? row.assignedTeacher : null,
      acknowledgedAt: row.acknowledgedAt,
    });
  }

  const notAcknowledged = people
    .filter(
      (p): p is PolicyOverviewPerson & { acknowledgedAt: null } =>
        p.acknowledgedAt === null,
    )
    .sort(byName);
  const acknowledged = people
    .filter(
      (p): p is PolicyOverviewPerson & { acknowledgedAt: string } =>
        p.acknowledgedAt !== null,
    )
    .sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt));

  return {
    ...versions,
    students: summarize(people.filter((p) => p.role === "student")),
    teachers: summarize(people.filter((p) => p.role === "teacher")),
    notAcknowledged,
    acknowledged,
  };
}
