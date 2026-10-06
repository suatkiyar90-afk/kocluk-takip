export interface TopicActivityRow {
  isActive: boolean;
}

export function onlyActiveTopics<T extends TopicActivityRow>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => row.isActive);
}
