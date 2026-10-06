import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  curriculumTopics,
  dailyQuestionEntries,
  studentTopicProgress,
} from "./schema";
import { TOPICS, type TopicSeed } from "./seed-curriculum";

type ExamType = "TYT" | "AYT" | "YDT";

export interface ExistingTopicRow {
  id: number;
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  topicName: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TopicRename {
  examType: ExamType;
  subjectId: string;
  from: string;
  to: string;
}

export interface RenameAction {
  id: number;
  examType: ExamType;
  subjectId: string;
  from: string;
  to: string;
}

export interface ReorderAction {
  id: number;
  examType: ExamType;
  subjectId: string;
  topicName: string;
  from: number;
  to: number;
}

export interface TopicFlagAction {
  id: number;
  examType: ExamType;
  subjectId: string;
  topicName: string;
}

export interface CurriculumSyncPlan {
  renames: RenameAction[];
  inserts: TopicSeed[];
  reorders: ReorderAction[];
  deactivations: TopicFlagAction[];
  reactivations: TopicFlagAction[];
}

export const YDT_RENAMES: TopicRename[] = [
  {
    examType: "YDT",
    subjectId: "ydt-ingilizce",
    from: "Kelime Bilgisi (Vocabulary)",
    to: "Kelime Bilgisi",
  },
  {
    examType: "YDT",
    subjectId: "ydt-ingilizce",
    from: "Gramer (Grammar)",
    to: "Dil Bilgisi",
  },
  {
    examType: "YDT",
    subjectId: "ydt-ingilizce",
    from: "Cümle Tamamlama",
    to: "Cümleyi Tamamlama",
  },
  {
    examType: "YDT",
    subjectId: "ydt-ingilizce",
    from: "İngilizce - Türkçe Çeviri",
    to: "Çeviri (İngilizce - Türkçe / Türkçe - İngilizce)",
  },
  {
    examType: "YDT",
    subjectId: "ydt-ingilizce",
    from: "Okuma Parçaları (Reading)",
    to: "Paragraf Anlama",
  },
  {
    examType: "YDT",
    subjectId: "ydt-ingilizce",
    from: "Anlamı Bozan Cümle",
    to: "Akışı Bozan Cümle (Irrelevant Sentence)",
  },
];

function groupKey(examType: string, subjectId: string): string {
  return `${examType}:${subjectId}`;
}

export function planCurriculumSync(
  existing: ExistingTopicRow[],
  desired: TopicSeed[],
  renames: TopicRename[],
): CurriculumSyncPlan {
  const plan: CurriculumSyncPlan = {
    renames: [],
    inserts: [],
    reorders: [],
    deactivations: [],
    reactivations: [],
  };

  const desiredByKey = new Map<string, TopicSeed[]>();
  for (const topic of desired) {
    const key = groupKey(topic.examType, topic.subjectId);
    const bucket = desiredByKey.get(key);
    if (bucket) bucket.push(topic);
    else desiredByKey.set(key, [topic]);
  }

  const matchedIds = new Set<number>();
  const plannedInsertNames = new Set<string>();

  for (const [key, desiredList] of desiredByKey) {
    const existingList = existing.filter(
      (t) => groupKey(t.examType, t.subjectId) === key,
    );
    const usedIds = new Set<number>();

    for (const wanted of desiredList) {
      const insertKey = groupKey(wanted.examType, `${wanted.subjectId}:${wanted.topicName}`);

      const exact = existingList.find(
        (t) => t.topicName === wanted.topicName && !usedIds.has(t.id),
      );
      if (exact) {
        usedIds.add(exact.id);
        matchedIds.add(exact.id);
        recordMatch(plan, exact, wanted);
        continue;
      }

      const rename = renames.find(
        (r) =>
          r.examType === wanted.examType &&
          r.subjectId === wanted.subjectId &&
          r.to === wanted.topicName,
      );
      if (rename) {
        const renamed = existingList.find(
          (t) => t.topicName === rename.from && !usedIds.has(t.id),
        );
        if (renamed) {
          usedIds.add(renamed.id);
          matchedIds.add(renamed.id);
          plan.renames.push({
            id: renamed.id,
            examType: renamed.examType,
            subjectId: renamed.subjectId,
            from: rename.from,
            to: wanted.topicName,
          });
          recordMatch(plan, renamed, wanted);
          continue;
        }
      }

      if (plannedInsertNames.has(insertKey)) continue;
      plannedInsertNames.add(insertKey);
      plan.inserts.push(wanted);
    }

    for (const leftover of existingList) {
      if (usedIds.has(leftover.id)) continue;
      if (leftover.isActive) {
        plan.deactivations.push({
          id: leftover.id,
          examType: leftover.examType,
          subjectId: leftover.subjectId,
          topicName: leftover.topicName,
        });
      }
    }
  }

  for (const topic of existing) {
    const key = groupKey(topic.examType, topic.subjectId);
    if (desiredByKey.has(key)) continue;
    if (matchedIds.has(topic.id)) continue;
    if (topic.isActive) {
      plan.deactivations.push({
        id: topic.id,
        examType: topic.examType,
        subjectId: topic.subjectId,
        topicName: topic.topicName,
      });
    }
  }

  return plan;
}

function recordMatch(
  plan: CurriculumSyncPlan,
  matched: ExistingTopicRow,
  wanted: TopicSeed,
): void {
  if (matched.sortOrder !== wanted.sortOrder) {
    plan.reorders.push({
      id: matched.id,
      examType: matched.examType,
      subjectId: matched.subjectId,
      topicName: matched.topicName,
      from: matched.sortOrder,
      to: wanted.sortOrder,
    });
  }
  if (!matched.isActive) {
    plan.reactivations.push({
      id: matched.id,
      examType: matched.examType,
      subjectId: matched.subjectId,
      topicName: wanted.topicName,
    });
  }
}

function formatPlan(plan: CurriculumSyncPlan): string {
  const lines: string[] = [];
  if (plan.renames.length > 0) {
    lines.push("Yeniden adlandırılacak (id korunur):");
    for (const r of plan.renames) {
      lines.push(
        `  #${r.id}  ${r.examType}/${r.subjectId}  "${r.from}" -> "${r.to}"`,
      );
    }
  }
  if (plan.inserts.length > 0) {
    lines.push(`Eklenecek yeni konu (${plan.inserts.length}):`);
    for (const i of plan.inserts) {
      lines.push(
        `  ${i.examType}/${i.subjectId}  ${i.sortOrder}. "${i.topicName}"  (${i.subjectName})`,
      );
    }
  }
  if (plan.reorders.length > 0) {
    lines.push(`Sırası değişecek (${plan.reorders.length}):`);
    for (const r of plan.reorders) {
      lines.push(
        `  #${r.id}  ${r.examType}/${r.subjectId}  "${r.topicName}"  ${r.from} -> ${r.to}`,
      );
    }
  }
  if (plan.deactivations.length > 0) {
    lines.push(
      `Pasife alınacak (silinmez, is_active=false) (${plan.deactivations.length}):`,
    );
    for (const d of plan.deactivations) {
      lines.push(`  #${d.id}  ${d.examType}/${d.subjectId}  "${d.topicName}"`);
    }
  }
  if (plan.reactivations.length > 0) {
    lines.push(`Yeniden aktifleşecek (${plan.reactivations.length}):`);
    for (const r of plan.reactivations) {
      lines.push(`  #${r.id}  ${r.examType}/${r.subjectId}  "${r.topicName}"`);
    }
  }
  return lines.join("\n");
}

async function affectedCounts(
  topicIds: number[],
): Promise<{
  daily: Map<number, number>;
  progress: Map<number, number>;
}> {
  const daily = new Map<number, number>();
  const progress = new Map<number, number>();
  if (topicIds.length === 0) return { daily, progress };

  const dailyRows = await db
    .select({
      topicId: dailyQuestionEntries.topicId,
      count: sql<number>`count(*)::int`,
    })
    .from(dailyQuestionEntries)
    .where(inArray(dailyQuestionEntries.topicId, topicIds))
    .groupBy(dailyQuestionEntries.topicId);

  const progressRows = await db
    .select({
      topicId: studentTopicProgress.topicId,
      count: sql<number>`count(*)::int`,
    })
    .from(studentTopicProgress)
    .where(inArray(studentTopicProgress.topicId, topicIds))
    .groupBy(studentTopicProgress.topicId);

  for (const row of dailyRows) daily.set(row.topicId, row.count);
  for (const row of progressRows) progress.set(row.topicId, row.count);
  return { daily, progress };
}

async function applyPlan(plan: CurriculumSyncPlan): Promise<void> {
  await db.transaction(async (tx) => {
    const renamesById = new Map(plan.renames.map((r) => [r.id, r]));
    const reordersById = new Map(plan.reorders.map((r) => [r.id, r]));
    const reactivateIds = new Set(plan.reactivations.map((r) => r.id));

    const touchedIds = new Set<number>([
      ...renamesById.keys(),
      ...reordersById.keys(),
      ...reactivateIds,
    ]);
    for (const id of touchedIds) {
      const rename = renamesById.get(id);
      const reorder = reordersById.get(id);
      const values: {
        topicName?: string;
        sortOrder?: number;
        isActive?: boolean;
      } = {};
      if (rename) values.topicName = rename.to;
      if (reorder) values.sortOrder = reorder.to;
      if (reactivateIds.has(id)) values.isActive = true;
      if (Object.keys(values).length === 0) continue;
      await tx.update(curriculumTopics).set(values).where(eq(curriculumTopics.id, id));
    }

    if (plan.deactivations.length > 0) {
      const deactivateIds = plan.deactivations.map((d) => d.id);
      await tx.execute(
        sql`update curriculum_topics set is_active = false where id in (${sql.join(
          deactivateIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    if (plan.inserts.length > 0) {
      await tx
        .insert(curriculumTopics)
        .values(
          plan.inserts.map((t) => ({
            examType: t.examType,
            subjectId: t.subjectId,
            subjectName: t.subjectName,
            topicName: t.topicName,
            sortOrder: t.sortOrder,
            isActive: true,
          })),
        )
        .onConflictDoNothing({
          target: [
            curriculumTopics.examType,
            curriculumTopics.subjectId,
            curriculumTopics.topicName,
          ],
        });
    }
  });
}

function databaseTarget(): string {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const dbName = parsed.pathname.replace(/^\//, "") || "?";
    return `host=${host} db=${dbName}`;
  } catch {
    return "host=?(DATABASE_URL çözümlenemedi)";
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  console.log(`Veritabanı: ${databaseTarget()}`);
  console.log(`Mod: ${apply ? "APPLY (transaction)" : "DRY-RUN (değişiklik yok)"}`);

  const existing = await db.select().from(curriculumTopics);
  const plan = planCurriculumSync(existing, TOPICS, YDT_RENAMES);

  if (
    plan.renames.length === 0 &&
    plan.inserts.length === 0 &&
    plan.reorders.length === 0 &&
    plan.deactivations.length === 0 &&
    plan.reactivations.length === 0
  ) {
    console.log("Plan boş: müfredat zaten senkron (toplam " + existing.length + " konu).");
    return;
  }

  console.log("");
  console.log(formatPlan(plan));

  const affectedIds = [
    ...plan.renames.map((r) => r.id),
    ...plan.deactivations.map((d) => d.id),
  ];
  const counts = await affectedCounts([...new Set(affectedIds)]);
  if (counts.daily.size > 0 || counts.progress.size > 0) {
    console.log("");
    console.log("Etkilenen kayıtlar (silinmez, yalnızca gösterim/akış değişir):");
    const labelById = new Map<string, string>();
    for (const r of plan.renames) labelById.set(String(r.id), `"${r.from}" -> "${r.to}"`);
    for (const d of plan.deactivations) labelById.set(String(d.id), `"${d.topicName}" (pasif)`);
    const ids = [...counts.daily.keys(), ...counts.progress.keys()].filter(
      (id, i, arr) => arr.indexOf(id) === i,
    );
    for (const id of ids) {
      console.log(
        `  #${id} ${labelById.get(String(id)) ?? ""}  günlük giriş: ${counts.daily.get(id) ?? 0}  ilerleme: ${counts.progress.get(id) ?? 0}`,
      );
    }
  }

  if (!apply) {
    console.log("");
    console.log(
      "DRY-RUN bitti: değişiklik YAPILMADI. Uygulamak için: npm run db:sync-curriculum -- --apply",
    );
    return;
  }

  await applyPlan(plan);
  console.log("");
  console.log(
    `Uygulandı: ${plan.renames.length} yeniden adlandırma, ${plan.inserts.length} ekleme, ${plan.reorders.length} sıra, ${plan.deactivations.length} pasifleştirme, ${plan.reactivations.length} aktifleştirme.`,
  );
}

if (process.argv[1]?.includes("sync-curriculum") ?? false) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Müfredat senkron hatası:", err);
      process.exit(1);
    });
}
