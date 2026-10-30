import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  examAnalysisPeriods,
  studentPeriodTopicAnalyses,
  type ExamAnalysisOutcome,
} from "@/db/schema";
import type { AnalysisSubjectName } from "./exam-analysis";

export interface AnalysisPlanItem {
  analysisId: number;
  matchedTopicId: number;
  topicName: string;
  subjectName: AnalysisSubjectName;
  priorityLevel: number | null;
  priorityOrder: number | null;
  lostPoints: number;
  successPct: number;
  statusLabel: string;
  outcomes: ExamAnalysisOutcome[];
  isPriority: boolean;
}

export interface LatestAnalysisPlan {
  periodId: number;
  periodTitle: string;
  items: AnalysisPlanItem[];
  byTopicId: Map<number, AnalysisPlanItem>;
}

export function qualifiesForAnalysisPriority(input: {
  priorityLevel: number | null;
  statusLabel: string;
}): boolean {
  return (
    input.priorityLevel === 1 ||
    input.priorityLevel === 2 ||
    input.statusLabel === "🔴 Acil Çalış"
  );
}

export async function loadLatestAnalysisPlan(
  studentId: string,
): Promise<LatestAnalysisPlan | null> {
  const periodRows = await db
    .select({
      id: examAnalysisPeriods.id,
      title: examAnalysisPeriods.title,
    })
    .from(examAnalysisPeriods)
    .where(eq(examAnalysisPeriods.isActive, true))
    .orderBy(desc(examAnalysisPeriods.createdAt), desc(examAnalysisPeriods.id))
    .limit(1);

  const period = periodRows[0];
  if (!period) return null;

  const rows = await db
    .select({
      analysisId: studentPeriodTopicAnalyses.id,
      matchedTopicId: studentPeriodTopicAnalyses.matchedTopicId,
      topicName: studentPeriodTopicAnalyses.topicName,
      subjectName: studentPeriodTopicAnalyses.subjectName,
      priorityLevel: studentPeriodTopicAnalyses.priorityLevel,
      priorityOrder: studentPeriodTopicAnalyses.priorityOrder,
      lostPoints: studentPeriodTopicAnalyses.lostPoints,
      successPct: studentPeriodTopicAnalyses.successPct,
      statusLabel: studentPeriodTopicAnalyses.statusLabel,
      outcomes: studentPeriodTopicAnalyses.outcomes,
    })
    .from(studentPeriodTopicAnalyses)
    .where(
      and(
        eq(studentPeriodTopicAnalyses.periodId, period.id),
        eq(studentPeriodTopicAnalyses.studentId, studentId),
      ),
    )
    .orderBy(
      asc(studentPeriodTopicAnalyses.priorityLevel),
      asc(studentPeriodTopicAnalyses.priorityOrder),
      desc(studentPeriodTopicAnalyses.lostPoints),
    );

  const items: AnalysisPlanItem[] = [];
  for (const row of rows) {
    if (row.matchedTopicId === null) continue;
    items.push({
      analysisId: row.analysisId,
      matchedTopicId: row.matchedTopicId,
      topicName: row.topicName,
      subjectName: row.subjectName as AnalysisSubjectName,
      priorityLevel: row.priorityLevel,
      priorityOrder: row.priorityOrder,
      lostPoints: row.lostPoints,
      successPct: row.successPct,
      statusLabel: row.statusLabel,
      outcomes: row.outcomes,
      isPriority: qualifiesForAnalysisPriority({
        priorityLevel: row.priorityLevel,
        statusLabel: row.statusLabel,
      }),
    });
  }

  return {
    periodId: period.id,
    periodTitle: period.title,
    items,
    byTopicId: new Map(items.map((item) => [item.matchedTopicId, item])),
  };
}
