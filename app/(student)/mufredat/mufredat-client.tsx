"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { updateTopicStatus } from "@/app/actions/curriculum-actions";
import type {
  CurriculumSnapshot,
  CurriculumSubjectGroup,
  CurriculumTopicRow,
  TopicStatus,
} from "@/app/actions/curriculum-actions";
import { CurriculumSummaryCard } from "@/components/curriculum/curriculum-progress";
import { OsymBadge } from "@/components/curriculum/osym-badge";
import { OSYM_GUARANTEED_AVG, weightedMastery } from "@/lib/osym-frequency";

const STATUS_OPTIONS: { value: TopicStatus; label: string; active: string }[] = [
  {
    value: "baslamadi",
    label: "Başlamadı",
    active: "bg-gray-500 text-white shadow-sm",
  },
  {
    value: "calisiliyor",
    label: "Çalışılıyor",
    active: "bg-amber-500 text-white shadow-sm",
  },
  {
    value: "bitti",
    label: "Bitti",
    active: "bg-green-500 text-white shadow-sm",
  },
];

type FilterId = "all" | "garanti" | "calisiliyor" | "bitmeyenler" | "bitenler";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "garanti", label: "🔥 Garanti Konular" },
  { id: "calisiliyor", label: "⏳ Çalışılıyor" },
  { id: "bitmeyenler", label: "⭕ Bitmeyenler" },
  { id: "bitenler", label: "✅ Bitenler" },
];

function matchesFilter(topic: CurriculumTopicRow, filter: FilterId): boolean {
  switch (filter) {
    case "all":
      return true;
    case "garanti":
      return topic.avgRecentQuestions >= OSYM_GUARANTEED_AVG;
    case "calisiliyor":
      return topic.status === "calisiliyor";
    case "bitmeyenler":
      return topic.status !== "bitti";
    case "bitenler":
      return topic.status === "bitti";
  }
}

function TopicStatusPicker({
  topic,
  busy,
  onStatusChange,
}: {
  topic: CurriculumTopicRow;
  busy: boolean;
  onStatusChange: (topic: CurriculumTopicRow, status: TopicStatus) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-200/70 p-1 dark:bg-gray-800">
      {STATUS_OPTIONS.map((opt) => {
        const selected = topic.status === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={busy}
            aria-pressed={selected}
            onClick={() => onStatusChange(topic, opt.value)}
            className={`h-9 min-w-0 rounded-md px-1 text-[11px] font-bold transition active:scale-[0.97] disabled:opacity-50 touch-manipulation ${
              selected
                ? opt.active
                : "text-gray-600 hover:bg-white/60 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SubjectCard({
  group,
  statusByTopic,
  filter,
  open,
  busyTopicId,
  onToggle,
  onStatusChange,
}: {
  group: CurriculumSubjectGroup;
  statusByTopic: Record<number, TopicStatus>;
  filter: FilterId;
  open: boolean;
  busyTopicId: number | null;
  onToggle: () => void;
  onStatusChange: (topic: CurriculumTopicRow, status: TopicStatus) => void;
}) {
  const topics = group.topics.map((topic) => ({
    ...topic,
    status: statusByTopic[topic.topicId] ?? topic.status,
  }));
  const visibleTopics = topics.filter((topic) => matchesFilter(topic, filter));
  const done = topics.filter((topic) => topic.status === "bitti").length;
  const mastery = weightedMastery(
    topics.map((topic) => ({
      status: topic.status,
      avgRecentQuestions: topic.avgRecentQuestions,
    })),
  );

  if (filter !== "all" && visibleTopics.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 p-3 text-left touch-manipulation"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="min-w-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {group.subjectName}
            </p>
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
              {done}/{group.totalTopics} konu
            </span>
          </div>
          {mastery.percent !== null ? (
            <div className="mt-2">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] font-medium leading-snug text-gray-500">
                <span>ÖSYM Soru Ağırlığına Göre Hakimiyet</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                  %{mastery.percent}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                  style={{ width: `${mastery.percent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-gray-100 p-2.5 dark:border-gray-800">
          {visibleTopics.length === 0 ? (
            <p className="px-1 py-2 text-xs font-medium text-gray-500">
              Bu filtreye uygun konu yok.
            </p>
          ) : (
            visibleTopics.map((topic) => (
              <div
                key={topic.topicId}
                className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-800/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
                    {topic.topicName}
                  </p>
                  <OsymBadge
                    avgRecentQuestions={topic.avgRecentQuestions}
                    yearlyQuestionCounts={topic.yearlyQuestionCounts}
                  />
                </div>
                <div className="mt-2">
                  <TopicStatusPicker
                    topic={topic}
                    busy={busyTopicId === topic.topicId}
                    onStatusChange={onStatusChange}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function MufredatClient({ snapshot }: { snapshot: CurriculumSnapshot }) {
  const [statusByTopic, setStatusByTopic] = useState<Record<number, TopicStatus>>(
    () => {
      const initial: Record<number, TopicStatus> = {};
      for (const group of [...snapshot.tyt, ...snapshot.ayt, ...snapshot.ydt]) {
        for (const topic of group.topics) {
          initial[topic.topicId] = topic.status;
        }
      }
      return initial;
    },
  );
  const [filter, setFilter] = useState<FilterId>("all");
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(() => new Set());
  const [busyTopicId, setBusyTopicId] = useState<number | null>(null);

  function toggleSubject(subjectId: string) {
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }

  async function handleStatusChange(
    topic: CurriculumTopicRow,
    status: TopicStatus,
  ) {
    const previous = statusByTopic[topic.topicId] ?? topic.status;
    if (previous === status || busyTopicId !== null) return;
    setStatusByTopic((prev) => ({ ...prev, [topic.topicId]: status }));
    setBusyTopicId(topic.topicId);
    try {
      const result = await updateTopicStatus({
        topicId: topic.topicId,
        status,
      });
      if (result.success === false) {
        setStatusByTopic((prev) => ({ ...prev, [topic.topicId]: previous }));
        toast.error(result.message);
      }
    } catch {
      setStatusByTopic((prev) => ({ ...prev, [topic.topicId]: previous }));
      toast.error("Durum güncellenemedi.");
    } finally {
      setBusyTopicId(null);
    }
  }

  const sections: { title: string; groups: CurriculumSubjectGroup[] }[] = [
    { title: "TYT", groups: snapshot.tyt },
    { title: "AYT", groups: snapshot.ayt },
    { title: "YDT", groups: snapshot.ydt },
  ];

  return (
    <div className="space-y-6">
      <CurriculumSummaryCard snapshot={snapshot} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={active}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] touch-manipulation ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {sections.map((section) => {
        const hasVisible = section.groups.some((group) =>
          group.topics.some((topic) =>
            matchesFilter(
              { ...topic, status: statusByTopic[topic.topicId] ?? topic.status },
              filter,
            ),
          ),
        );
        if (section.groups.length === 0 || hasVisible === false) return null;
        return (
          <section key={section.title}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.groups.map((group) => (
                <SubjectCard
                  key={group.subjectId}
                  group={group}
                  statusByTopic={statusByTopic}
                  filter={filter}
                  open={openSubjects.has(group.subjectId)}
                  busyTopicId={busyTopicId}
                  onToggle={() => toggleSubject(group.subjectId)}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
