"use client";

import { useState } from "react";
import type { DailyReportTopic } from "@/app/actions/quiz-actions";

interface TopicGroup {
  key: string;
  examType: "TYT" | "AYT";
  subjectName: string;
  topics: DailyReportTopic[];
  solved: number;
  net: number;
}

const ACCORDION_THRESHOLD = 12;

function formatNet(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function groupTopics(topics: DailyReportTopic[]): TopicGroup[] {
  const map = new Map<string, TopicGroup>();
  for (const topic of topics) {
    const key = `${topic.examType}:${topic.subjectId}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        examType: topic.examType,
        subjectName: topic.subjectName,
        topics: [],
        solved: 0,
        net: 0,
      };
      map.set(key, group);
    }
    group.topics.push(topic);
    group.solved += topic.solved;
    group.net += topic.net;
  }
  return [...map.values()].map((group) => ({
    ...group,
    net: Math.round(group.net * 100) / 100,
  }));
}

function GroupLabel({ group }: { group: TopicGroup }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
        {group.examType}
      </span>
      <span className="truncate text-sm font-bold text-gray-900">
        {group.subjectName}
      </span>
    </span>
  );
}

export function TopicAnalysis({ topics }: { topics: DailyReportTopic[] }) {
  const groups = groupTopics(topics);
  const useAccordion = topics.length > ACCORDION_THRESHOLD;
  const [closedKeys, setClosedKeys] = useState<Set<string>>(
    () => new Set(useAccordion ? groups.map((g) => g.key) : []),
  );

  function toggle(key: string) {
    setClosedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500">
        Bu hafta için henüz konu bazlı soru kaydı yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isOpen = !useAccordion || !closedKeys.has(group.key);
        return (
          <div
            key={group.key}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            {useAccordion ? (
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-gray-50 touch-manipulation"
              >
                <GroupLabel group={group} />
                <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-gray-500">
                  <span>{group.solved} soru</span>
                  <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <GroupLabel group={group} />
                <span className="shrink-0 text-xs font-semibold text-gray-500">
                  {group.solved} soru · Net {formatNet(group.net)}
                </span>
              </div>
            )}

            {isOpen && (
              <div className="space-y-2 px-4 pb-4 pt-3">
                {group.topics.map((topic) => (
                  <div
                    key={topic.topicId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {topic.topicName}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                        <span className="font-bold text-green-700">
                          D {topic.correct}
                        </span>
                        {" · "}
                        <span className="font-bold text-red-600">
                          Y {topic.wrong}
                        </span>
                        {" · "}
                        <span className="font-bold text-stone-500">
                          B {topic.blank}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {topic.solved} Soru
                      </p>
                      <p className="text-[11px] font-semibold text-indigo-700">
                        Net {formatNet(topic.net)}
                      </p>
                    </div>
                  </div>
                ))}
                {useAccordion && (
                  <p className="text-right text-[11px] font-semibold text-gray-500">
                    Toplam: {group.solved} soru · Net {formatNet(group.net)}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
