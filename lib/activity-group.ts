export interface GroupableActivity {
  id: number;
  actorId: string;
  action: string;
  studentId: string | null;
  createdAt: string;
}

export interface ActivityGroup<T> {
  items: T[];
  count: number;
}

export function groupConsecutiveActivities<T extends GroupableActivity>(
  rows: readonly T[],
  gapMs: number = 10 * 60 * 1000,
): ActivityGroup<T>[] {
  const groups: ActivityGroup<T>[] = [];

  for (const row of rows) {
    const prev = groups[groups.length - 1];
    if (prev) {
      const last = prev.items[prev.items.length - 1];
      const sameKey =
        last.actorId === row.actorId &&
        last.action === row.action &&
        last.studentId === row.studentId;
      const gap = Math.abs(
        Date.parse(row.createdAt) - Date.parse(last.createdAt),
      );
      if (sameKey && gap <= gapMs) {
        prev.items.push(row);
        prev.count = prev.items.length;
        continue;
      }
    }
    groups.push({ items: [row], count: 1 });
  }

  return groups;
}
