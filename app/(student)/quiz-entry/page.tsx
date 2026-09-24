import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { curriculumTopics, dailyQuestionEntries } from "@/db/schema";
import { ALL_SUBJECTS } from "@/components/quiz-entry/weekly-quiz-schema";
import type {
  DayEntryRow,
  SubjectOption,
  SubjectOptions,
} from "@/components/quiz-entry/daily-entry-types";
import { StudentNav } from "@/components/student/student-nav";
import { QuizEntryClient } from "./quiz-entry-client";

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSelectableDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  const real =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
  if (!real) return false;
  return value <= toISODateLocal(new Date());
}

function sanitizeDate(value?: string): string {
  if (value && isSelectableDate(value)) return value;
  return toISODateLocal(new Date());
}

async function loadDayData(
  studentId: string,
  date: string,
): Promise<{ entries: DayEntryRow[]; subjects: SubjectOptions }> {
  const [entryRows, topicRows] = await Promise.all([
    db
      .select({
        id: dailyQuestionEntries.id,
        examType: dailyQuestionEntries.examType,
        subjectName: curriculumTopics.subjectName,
        topicName: curriculumTopics.topicName,
        correct: dailyQuestionEntries.correct,
        wrong: dailyQuestionEntries.wrong,
        blank: dailyQuestionEntries.blank,
      })
      .from(dailyQuestionEntries)
      .innerJoin(
        curriculumTopics,
        eq(curriculumTopics.id, dailyQuestionEntries.topicId),
      )
      .where(
        and(
          eq(dailyQuestionEntries.studentId, studentId),
          eq(dailyQuestionEntries.date, date),
        ),
      )
      .orderBy(
        asc(dailyQuestionEntries.examType),
        asc(curriculumTopics.subjectName),
        asc(curriculumTopics.sortOrder),
      ),
    db
      .select({
        id: curriculumTopics.id,
        examType: curriculumTopics.examType,
        subjectId: curriculumTopics.subjectId,
        subjectName: curriculumTopics.subjectName,
        topicName: curriculumTopics.topicName,
        sortOrder: curriculumTopics.sortOrder,
      })
      .from(curriculumTopics)
      .orderBy(
        asc(curriculumTopics.examType),
        asc(curriculumTopics.subjectId),
        asc(curriculumTopics.sortOrder),
      ),
  ]);

  const subjects: SubjectOptions = { TYT: [], AYT: [] };
  const groupByKey = new Map<string, SubjectOption>();
  for (const topic of topicRows) {
    const key = `${topic.examType}:${topic.subjectId}`;
    let group = groupByKey.get(key);
    if (!group) {
      group = {
        subjectId: topic.subjectId,
        subjectName: topic.subjectName,
        topics: [],
      };
      groupByKey.set(key, group);
      subjects[topic.examType].push(group);
    }
    group.topics.push({ id: topic.id, name: topic.topicName });
  }

  for (const examType of ["TYT", "AYT"] as const) {
    const rank = new Map(
      ALL_SUBJECTS[examType].map((subject, index) => [subject.id, index]),
    );
    subjects[examType].sort(
      (a, b) =>
        (rank.get(a.subjectId) ?? 99) - (rank.get(b.subjectId) ?? 99),
    );
  }

  const entries: DayEntryRow[] = entryRows;
  return { entries, subjects };
}

interface QuizEntryPageProps {
  searchParams?: Promise<{ date?: string }>;
}

export default async function QuizEntryPage({
  searchParams,
}: QuizEntryPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const date = sanitizeDate(resolvedParams?.date);

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let data: Awaited<ReturnType<typeof loadDayData>> | null = null;
  try {
    data = await loadDayData(session.user.id, date);
  } catch {
    data = null;
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <StudentNav />
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Günlük Soru Girişi
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sınav türü, ders ve konuyu seçip o gün çözdüğün soruları kaydet.
          </p>
        </header>

        {data === null ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            Kayıtlar yüklenemedi. Lütfen tekrar deneyin.
          </div>
        ) : (
          <QuizEntryClient
            date={date}
            entries={data.entries}
            subjects={data.subjects}
          />
        )}
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}
