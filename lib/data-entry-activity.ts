export function buildEnteredTodaySet(
  topicStudentIds: readonly string[],
  denemeStudentIds: readonly string[],
): Set<string> {
  const entered = new Set<string>();
  for (const id of topicStudentIds) {
    entered.add(id);
  }
  for (const id of denemeStudentIds) {
    entered.add(id);
  }
  return entered;
}

export function hasEnteredData(
  entered: ReadonlySet<string>,
  studentId: string,
): boolean {
  return entered.has(studentId);
}

export function studentsWithoutEnteredData<T extends { id: string }>(
  students: readonly T[],
  entered: ReadonlySet<string>,
): T[] {
  return students.filter((student) => !entered.has(student.id));
}
