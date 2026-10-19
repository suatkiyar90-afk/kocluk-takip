import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { curriculumTopics } from "./schema";

export const RECENT_YEAR_COUNT = 5;

export type OsymExamType = "TYT" | "AYT" | "YDT";

export interface OsymTopicSeed {
  name: string;
  aliases: string[];
  counts: number[];
}

export interface OsymSubjectSeed {
  subjectId?: string;
  subjectIds?: string[];
  subjectName: string;
  years: number[];
  topics: OsymTopicSeed[];
}

const SUBJECT_ID_ALIASES: Record<string, string> = {
  "tyt-geometri": "geometri",
  "ayt-geometri": "geometri-ayt",
};

export function resolveSubjectId(subjectId: string): string {
  return SUBJECT_ID_ALIASES[subjectId] ?? subjectId;
}

export function seedSubjectIds(subject: OsymSubjectSeed): string[] {
  const raw = subject.subjectIds ?? (subject.subjectId ? [subject.subjectId] : []);
  return Array.from(new Set(raw.map(resolveSubjectId)));
}

function seedLabel(subject: OsymSubjectSeed): string {
  return subject.subjectId ?? (subject.subjectIds ?? []).join("+");
}

export function normalizeTopicKey(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[^0-9a-zçğıöşü]+/g, "");
}

export interface OsymExistingTopicRow {
  id: number;
  subjectId: string;
  subjectName: string;
  topicName: string;
  sortOrder: number;
}

export interface OsymUpdateAction {
  id: number;
  topicName: string;
  matchedBy: "name" | "alias";
  seedName: string;
  seedSubjectId: string;
  yearlyQuestionCounts: Record<string, number>;
  avgRecentQuestions: number;
}

export interface OsymInsertAction {
  subjectId: string;
  subjectName: string;
  topicName: string;
  sortOrder: number;
  yearlyQuestionCounts: Record<string, number>;
  avgRecentQuestions: number;
}

export interface OsymSkipAction {
  seedName: string;
  seedSubjectId: string;
  reason: string;
}

export interface OsymPlan {
  updates: OsymUpdateAction[];
  inserts: OsymInsertAction[];
  skips: OsymSkipAction[];
  unmatchedExisting: {
    id: number;
    subjectId: string;
    topicName: string;
  }[];
}

function buildCounts(
  years: number[],
  counts: number[],
): Record<string, number> {
  const result: Record<string, number> = {};
  years.forEach((year, index) => {
    result[String(year)] = counts[index];
  });
  return result;
}

function recentAverage(counts: number[]): number {
  const recent = counts.slice(0, RECENT_YEAR_COUNT);
  const sum = recent.reduce((total, value) => total + value, 0);
  return Math.round((sum / RECENT_YEAR_COUNT) * 100) / 100;
}

export function planOsymSync(
  existing: OsymExistingTopicRow[],
  data: OsymSubjectSeed[],
): OsymPlan {
  const plan: OsymPlan = {
    updates: [],
    inserts: [],
    skips: [],
    unmatchedExisting: [],
  };

  const existingByKey = new Map<string, OsymExistingTopicRow[]>();
  for (const row of existing) {
    const key = `${row.subjectId}::${normalizeTopicKey(row.topicName)}`;
    const bucket = existingByKey.get(key);
    if (bucket) bucket.push(row);
    else existingByKey.set(key, [row]);
  }

  const usedIds = new Set<number>();
  const nextSortOrder = new Map<string, number>();
  for (const row of existing) {
    const current = nextSortOrder.get(row.subjectId) ?? 0;
    if (row.sortOrder > current) nextSortOrder.set(row.subjectId, row.sortOrder);
  }

  for (const subject of data) {
    const targetSubjectIds = seedSubjectIds(subject);
    const subjectRows = existing.filter((row) =>
      targetSubjectIds.includes(row.subjectId),
    );
    if (subjectRows.length === 0) {
      plan.skips.push({
        seedName: subject.subjectName,
        seedSubjectId: seedLabel(subject),
        reason: `Ders veritabaninda yok: ${targetSubjectIds.join(", ")}`,
      });
      continue;
    }

    const subjectNameBySubject = new Map<string, string>();
    for (const row of subjectRows) {
      if (!subjectNameBySubject.has(row.subjectId)) {
        subjectNameBySubject.set(row.subjectId, row.subjectName);
      }
    }

    for (const topic of subject.topics) {
      if (topic.counts.length !== subject.years.length) {
        plan.skips.push({
          seedName: topic.name,
          seedSubjectId: seedLabel(subject),
          reason: `Yil sayisi uyusmuyor (${topic.counts.length} sayim / ${subject.years.length} yil)`,
        });
        continue;
      }

      const keys = [topic.name, ...topic.aliases];
      const yearlyQuestionCounts = buildCounts(subject.years, topic.counts);
      const avgRecentQuestions = recentAverage(topic.counts);

      for (const targetSubjectId of targetSubjectIds) {
        let matched: OsymExistingTopicRow | undefined;
        let matchedBy: "name" | "alias" = "name";
        for (let index = 0; index < keys.length; index += 1) {
          const candidates =
            existingByKey.get(
              `${targetSubjectId}::${normalizeTopicKey(keys[index])}`,
            ) ?? [];
          const candidate = candidates.find((row) => !usedIds.has(row.id));
          if (candidate) {
            matched = candidate;
            matchedBy = index === 0 ? "name" : "alias";
            break;
          }
        }

        if (matched) {
          usedIds.add(matched.id);
          plan.updates.push({
            id: matched.id,
            topicName: matched.topicName,
            matchedBy,
            seedName: topic.name,
            seedSubjectId: seedLabel(subject),
            yearlyQuestionCounts,
            avgRecentQuestions,
          });
          continue;
        }

        const base = nextSortOrder.get(targetSubjectId) ?? 0;
        const sortOrder = base + 10;
        nextSortOrder.set(targetSubjectId, sortOrder);
        plan.inserts.push({
          subjectId: targetSubjectId,
          subjectName:
            subjectNameBySubject.get(targetSubjectId) ?? subject.subjectName,
          topicName: topic.name,
          sortOrder,
          yearlyQuestionCounts,
          avgRecentQuestions,
        });
      }
    }
  }

  plan.unmatchedExisting = existing
    .filter((row) => !usedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      subjectId: row.subjectId,
      topicName: row.topicName,
    }))
    .sort((a, b) =>
      a.subjectId === b.subjectId
        ? a.topicName.localeCompare(b.topicName, "tr")
        : a.subjectId.localeCompare(b.subjectId),
    );

  return plan;
}

export function formatPlan(plan: OsymPlan): string {
  const lines: string[] = [];
  lines.push(`Guncellenecek mevcut konu (${plan.updates.length}):`);
  for (const update of plan.updates) {
    const via =
      update.matchedBy === "alias" ? ` (alias: "${update.seedName}")` : "";
    lines.push(
      `  #${update.id}  ${update.seedSubjectId}  "${update.topicName}"${via}  ort=${update.avgRecentQuestions}`,
    );
  }
  lines.push("");
  lines.push(`Eklenecek yeni konu (${plan.inserts.length}):`);
  for (const insert of plan.inserts) {
    lines.push(
      `  ${insert.subjectId}  ${insert.sortOrder}. "${insert.topicName}"  ort=${insert.avgRecentQuestions}`,
    );
  }
  if (plan.skips.length > 0) {
    lines.push("");
    lines.push(`Atlanan (${plan.skips.length}):`);
    for (const skip of plan.skips) {
      lines.push(`  ${skip.seedSubjectId} / "${skip.seedName}" -> ${skip.reason}`);
    }
  }
  if (plan.unmatchedExisting.length > 0) {
    lines.push("");
    lines.push(
      `OSYM verisi eslesmeyen mevcut konular (silinmez, dokunulmaz) (${plan.unmatchedExisting.length}):`,
    );
    for (const row of plan.unmatchedExisting) {
      lines.push(`  #${row.id}  ${row.subjectId}  "${row.topicName}"`);
    }
  }
  return lines.join("\n");
}

export async function loadExistingTopics(
  examType: OsymExamType,
): Promise<OsymExistingTopicRow[]> {
  return db
    .select({
      id: curriculumTopics.id,
      subjectId: curriculumTopics.subjectId,
      subjectName: curriculumTopics.subjectName,
      topicName: curriculumTopics.topicName,
      sortOrder: curriculumTopics.sortOrder,
    })
    .from(curriculumTopics)
    .where(eq(curriculumTopics.examType, examType));
}

export async function applyOsymPlan(
  plan: OsymPlan,
  examType: OsymExamType,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const update of plan.updates) {
      await tx.execute(sql`
        update curriculum_topics
           set yearly_question_counts = ${JSON.stringify(update.yearlyQuestionCounts)}::jsonb,
               avg_recent_questions = ${update.avgRecentQuestions}
         where id = ${update.id}
      `);
    }

    for (const insert of plan.inserts) {
      const insertValues = {
        examType,
        subjectId: insert.subjectId,
        subjectName: insert.subjectName,
        topicName: insert.topicName,
        sortOrder: insert.sortOrder,
        isActive: true,
        yearlyQuestionCounts: insert.yearlyQuestionCounts,
        avgRecentQuestions: insert.avgRecentQuestions,
      };
      await tx
        .insert(curriculumTopics)
        .values(insertValues)
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

export async function runOsymSync(options: {
  examType: OsymExamType;
  data: OsymSubjectSeed[];
  hint: string;
}): Promise<void> {
  const apply = process.argv.includes("--apply");

  console.log(
    `Mod: ${apply ? "APPLY (transaction)" : "DRY-RUN (degisiklik yok)"}`,
  );

  const existing = await loadExistingTopics(options.examType);
  const plan = planOsymSync(existing, options.data);

  console.log("");
  console.log(formatPlan(plan));

  if (!apply) {
    console.log("");
    console.log(
      `DRY-RUN bitti: degisiklik YAPILMADI. Uygulamak icin: ${options.hint} -- --apply`,
    );
    return;
  }

  await applyOsymPlan(plan, options.examType);
  console.log("");
  console.log(
    `Uygulandi: ${plan.updates.length} guncelleme, ${plan.inserts.length} ekleme, ${plan.skips.length} atlama, 0 silme.`,
  );
}
