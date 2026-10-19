"use client";

import { useState } from "react";
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
import { weightedMastery } from "@/lib/osym-frequency";

const STATUS_OPTIONS: { value: TopicStatus; label: string; active: string }[] = [
  {
    value: "baslamadi",
    label: "Başlamadı",
    active: "bg-gray-400 text-white",
  },
  {
    value: "calisiliyor",
    label: "Çalışılıyor",
    active: "bg-amber-500 text-white",
  },
  {
    value: "bitti",
    label: "Bitti",
    active: "bg-green-500 text-white",
  },
];

function TopicStatusPicker({
  topic,
  onStatusChange,
  busy,
}: {
  topic: CurriculumTopicRow;
  onStatusChange: (topic: CurriculumTopicRow, status: TopicStatus) => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <p className="min-w-0 truncate text-sm font-medium text-gray-800">
          {topic.topicName}
        </p>
        <OsymBadge
          avgRecentQuestions={topic.avgRecentQuestions}
          yearlyQuestionCounts={topic.yearlyQuestionCounts}
          className="shrink-0"
        />
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-0.5 rounded-lg bg-gray-100 p-0.5">
        {STATUS_OPTIONS.map((opt) => {
          const selected = topic.status === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => onStatusChange(topic, opt.value)}
              className={`h-7 rounded-md px-2 text-[11px] font-bold transition active:scale-[0.97] disabled:opacity-50 touch-manipulation ${
                selected ? opt.active : "text-gray-500"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubjectGroup({ group }: { group: CurriculumSubjectGroup }) {
  const [topics, setTopics] = useState(group.topics);
  const [busy, setBusy] = useState(false);

  async function handleStatusChange(
    topic: CurriculumTopicRow,
    status: TopicStatus,
  ) {
    if (topic.status === status) return;
    const previous = topic.status;
    setTopics((prev) =>
      prev.map((t) => (t.topicId === topic.topicId ? { ...t, status } : t)),
    );
    setBusy(true);
    try {
      const result = await updateTopicStatus({ topicId: topic.topicId, status });
      if (result.success === false) {
        setTopics((prev) =>
          prev.map((t) =>
            t.topicId === topic.topicId ? { ...t, status: previous } : t,
          ),
        );
        toast.error(result.message);
      }
    } catch {
      setTopics((prev) =>
        prev.map((t) =>
          t.topicId === topic.topicId ? { ...t, status: previous } : t,
        ),
      );
      toast.error("Durum güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  const done = topics.filter((t) => t.status === "bitti").length;
  const mastery = weightedMastery(
    topics.map((t) => ({
      status: t.status,
      avgRecentQuestions: t.avgRecentQuestions,
    })),
  );

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">
          {group.subjectName}
        </p>
        <span className="text-xs font-bold text-indigo-700">
          {done}/{group.totalTopics}
        </span>
      </div>
      {mastery.percent !== null ? (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
            <span>ÖSYM Soru Ağırlığına Göre Hakimiyet</span>
            <span className="font-bold text-indigo-700">%{mastery.percent}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width]"
              style={{ width: `${mastery.percent}%` }}
            />
          </div>
        </div>
      ) : null}
      <div className="mt-2.5 space-y-2">
        {topics.map((t) => (
          <TopicStatusPicker
            key={t.topicId}
            topic={t}
            onStatusChange={handleStatusChange}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}

export function MufredatClient({ snapshot }: { snapshot: CurriculumSnapshot }) {
  return (
    <div className="space-y-6">
      <CurriculumSummaryCard snapshot={snapshot} />
      {snapshot.tyt.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
            TYT
          </h2>
          <div className="space-y-2">
            {snapshot.tyt.map((g) => (
              <SubjectGroup key={g.subjectId} group={g} />
            ))}
          </div>
        </section>
      )}
      {snapshot.ayt.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
            AYT
          </h2>
          <div className="space-y-2">
            {snapshot.ayt.map((g) => (
              <SubjectGroup key={g.subjectId} group={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}