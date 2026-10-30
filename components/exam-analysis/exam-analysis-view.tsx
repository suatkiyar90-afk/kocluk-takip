"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addAnalysisTopicToWeeklyTarget,
  getMyExamAnalysisOverview,
  getStudentExamAnalysisOverview,
  type ExamAnalysisExamView,
  type ExamAnalysisOverview,
  type ExamAnalysisTopicView,
} from "@/app/actions/exam-analysis-actions";
import {
  ANALYSIS_SUBJECTS,
  cleanExamName,
  formatLostPoints,
} from "@/lib/exam-analysis";
import { PanelSkeleton } from "@/components/student/panel-ui";

interface ExamAnalysisViewProps {
  mode: "student" | "teacher";
  studentId?: string;
  weekStart?: string;
  /**
   * "+ Haftalık Hedefe Ekle" butonunun görünürlüğü. Varsayılan olarak kapalıdır;
   * yalnızca danışman öğretmen/yönetici koçluk ekranındaki öğrenci detayında
   * açıkça `true` verilir. Öğrencinin kendi ekranında ve öğrenci ekranı
   * önizlemesinde asla görünmez.
   */
  canAssignTarget?: boolean;
}

type Section = "priority" | "all";

const STATUS_META: Record<
  string,
  { chip: string; bar: string; dot: string }
> = {
  "🔴 Acil Çalış": {
    chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800",
    bar: "bg-rose-500",
    dot: "text-rose-600 dark:text-rose-400",
  },
  "🟡 Tekrar Et": {
    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800",
    bar: "bg-amber-400",
    dot: "text-amber-600 dark:text-amber-400",
  },
  "🟢 İyi": {
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800",
    bar: "bg-emerald-500",
    dot: "text-emerald-600 dark:text-emerald-400",
  },
  "⭐ Mükemmel": {
    chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:ring-indigo-800",
    bar: "bg-indigo-500",
    dot: "text-indigo-600 dark:text-indigo-400",
  },
};

const DEFAULT_STATUS_META = {
  chip: "bg-gray-50 text-gray-700 ring-1 ring-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  bar: "bg-gray-400",
  dot: "text-gray-600 dark:text-gray-300",
};

function statusMeta(label: string) {
  return STATUS_META[label] ?? DEFAULT_STATUS_META;
}

function formatNet(value: number): string {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatExamDate(value: string | null): string {
  if (!value) return "";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return value;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function priorityLabel(topic: ExamAnalysisTopicView): string | null {
  if (topic.priorityLevel === null) return null;
  const order =
    topic.priorityOrder !== null ? ` • #${topic.priorityOrder}` : "";
  return `${topic.priorityLevel}. Öncelik${order}`;
}

function matchesStatusFilter(
  topic: ExamAnalysisTopicView,
  filter: string,
): boolean {
  return filter === "all" || topic.statusLabel === filter;
}

function matchesSubjectFilter(
  topic: ExamAnalysisTopicView,
  filter: string,
): boolean {
  return filter === "all" || topic.subjectName === filter;
}

export function ExamAnalysisView({
  mode,
  studentId,
  weekStart,
  canAssignTarget = false,
}: ExamAnalysisViewProps) {
  const [data, setData] = useState<ExamAnalysisOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("priority");
  const [priorityFilter, setPriorityFilter] = useState<number>(0);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);

  const load = useCallback(
    async (periodId?: number) => {
      setLoading(true);
      setError(null);
      try {
        const result =
          mode === "student"
            ? await getMyExamAnalysisOverview(periodId)
            : await getStudentExamAnalysisOverview(studentId!, periodId);
        if (result.success === true) {
          setData(result.data);
          setExpandedId(null);
        } else {
          setData(null);
          setError(result.message);
        }
      } catch {
        setData(null);
        setError("Analiz verisi yüklenirken bilinmeyen bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    },
    [mode, studentId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const canAssign = canAssignTarget === true;

  async function handleAddToWeeklyTarget(topic: ExamAnalysisTopicView) {
    if (!canAssign || !studentId || !weekStart) return;
    setAddingId(topic.id);
    try {
      const result = await addAnalysisTopicToWeeklyTarget({
        studentId,
        analysisId: topic.id,
        weekStart,
      });
      if (result.success === true) {
        toast.success(
          `"${result.data.topicName}" haftalık hedefe eklendi (${result.data.targetQuestionCount} soru).`,
        );
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Hedefe eklenirken bilinmeyen bir hata oluştu.");
    } finally {
      setAddingId(null);
    }
  }

  if (loading && data === null) {
    return <PanelSkeleton rows={6} />;
  }

  if (error !== null) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (data === null) return null;

  if (data.periods.length === 0 || data.period === null) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-3xl">📊</p>
        <p className="mt-2 text-sm font-bold text-gray-900">
          Henüz aylık analiz yüklenmedi
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Yönetici analiz dönemini yüklediğinde konu, alt kazanım ve kayıp puan
          analizin burada görünecek.
        </p>
      </div>
    );
  }

  const priorityTopics = data.topics.filter(
    (topic) => topic.priorityLevel !== null,
  );
  const visiblePriority = priorityTopics.filter(
    (topic) =>
      priorityFilter === 0 || topic.priorityLevel === priorityFilter,
  );
  const visibleAll = data.topics.filter(
    (topic) =>
      matchesSubjectFilter(topic, subjectFilter) &&
      matchesStatusFilter(topic, statusFilter),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Analiz Dönemi
            </p>
            <select
              aria-label="Analiz dönemi seç"
              value={data.period.id}
              onChange={(e) => void load(Number(e.target.value))}
              className="mt-1 h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 sm:w-auto"
            >
              {data.periods.map((period) => (
                <option key={period.id} value={period.id}>
                  📅 {period.title}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] font-medium text-gray-500 sm:text-right">
            {data.summary.topicCount} konu · {data.summary.outcomeCount} alt
            kazanım
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryCard
            label="Toplam Kayıp Puan"
            value={formatLostPoints(data.summary.totalLostPoints)}
            tone="rose"
            icon="📉"
          />
          <SummaryCard
            label="1. Öncelikli Konu"
            value={String(data.summary.priorityOneCount)}
            tone="indigo"
            icon="🔥"
          />
          <SummaryCard
            label="🔴 Acil Çalış Konu"
            value={String(data.summary.urgentCount)}
            tone="amber"
            icon="⚠️"
          />
        </div>

        {data.exams.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Değerlendirilen Denemeler
            </p>
            <div className="-mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1">
              {data.exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex w-full gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setSection("priority")}
          className={`flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-bold transition sm:text-sm ${
            section === "priority"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🎯 Öncelikli Listem
        </button>
        <button
          type="button"
          onClick={() => setSection("all")}
          className={`flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-bold transition sm:text-sm ${
            section === "all"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📊 Tüm Konular
        </button>
      </div>

      {section === "priority" ? (
        <section className="space-y-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <FilterChip
              active={priorityFilter === 0}
              onClick={() => setPriorityFilter(0)}
              label="Tümü"
            />
            <FilterChip
              active={priorityFilter === 1}
              onClick={() => setPriorityFilter(1)}
              label="🔥 1. Öncelik"
            />
            <FilterChip
              active={priorityFilter === 2}
              onClick={() => setPriorityFilter(2)}
              label="⚡ 2. Öncelik"
            />
            <FilterChip
              active={priorityFilter === 3}
              onClick={() => setPriorityFilter(3)}
              label="📌 3. Öncelik"
            />
          </div>

          {visiblePriority.length === 0 ? (
            <EmptyState text="Bu filtreye uygun öncelikli konu bulunamadı." />
          ) : (
            <div className="space-y-3">
              {visiblePriority.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  expanded={expandedId === topic.id}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === topic.id ? null : topic.id,
                    )
                  }
                  canAssign={canAssign}
                  adding={addingId === topic.id}
                  onAdd={() => void handleAddToWeeklyTarget(topic)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <FilterChip
              active={subjectFilter === "all"}
              onClick={() => setSubjectFilter("all")}
              label="Tümü"
            />
            {ANALYSIS_SUBJECTS.map((subject) => (
              <FilterChip
                key={subject}
                active={subjectFilter === subject}
                onClick={() => setSubjectFilter(subject)}
                label={subject}
              />
            ))}
          </div>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <FilterChip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              label="Tüm Durumlar"
            />
            {Object.keys(STATUS_META).map((label) => (
              <FilterChip
                key={label}
                active={statusFilter === label}
                onClick={() => setStatusFilter(label)}
                label={label}
              />
            ))}
          </div>

          {visibleAll.length === 0 ? (
            <EmptyState text="Bu filtreye uygun konu bulunamadı." />
          ) : (
            <div className="space-y-2">
              {visibleAll.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  expanded={expandedId === topic.id}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === topic.id ? null : topic.id,
                    )
                  }
                  canAssign={canAssign}
                  adding={addingId === topic.id}
                  onAdd={() => void handleAddToWeeklyTarget(topic)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "rose" | "indigo" | "amber";
  icon: string;
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
    indigo:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  } as const;
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tones[tone]}`}>
      <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide opacity-80">
        <span aria-hidden>{icon}</span>
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <p className="mt-0.5 text-xl font-extrabold">{value}</p>
    </div>
  );
}

function ExamCard({ exam }: { exam: ExamAnalysisExamView }) {
  const date = formatExamDate(exam.examDate);
  const name = cleanExamName(exam.examName);
  return (
    <div className="min-w-[170px] max-w-[230px] shrink-0 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5">
      <p className="truncate text-xs font-bold text-gray-900" title={name}>
        {name}
      </p>
      {date ? (
        <p className="mt-0.5 text-[11px] font-medium text-gray-500">{date}</p>
      ) : null}
      <p className="mt-1 text-sm font-extrabold text-indigo-700">
        {formatNet(exam.totalNet)} Net
      </p>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm font-medium text-gray-500 shadow-sm">
      {text}
    </div>
  );
}

function TopicCard({
  topic,
  expanded,
  onToggle,
  canAssign,
  adding,
  onAdd,
}: {
  topic: ExamAnalysisTopicView;
  expanded: boolean;
  onToggle: () => void;
  canAssign: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const meta = statusMeta(topic.statusLabel);
  const badge = priorityLabel(topic);
  const pct = clampPct(topic.successPct);
  const hasOutcomes = topic.outcomes.length > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {badge !== null ? (
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  {badge}
                </span>
              ) : null}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                {topic.subjectName}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
              >
                {topic.statusLabel}
              </span>
            </div>
            <p className="mt-1.5 break-words text-sm font-bold text-gray-900">
              {topic.topicName}
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-rose-50 px-2.5 py-1.5 text-right dark:bg-rose-950/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">
              Kayıp Puan
            </p>
            <p className="text-sm font-extrabold text-rose-700 dark:text-rose-200">
              {formatLostPoints(topic.lostPoints)} KP
            </p>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-5 gap-1.5 text-center">
          <Stat label="Soru" value={topic.totalQuestions} />
          <Stat
            label="Doğru"
            value={topic.correct}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Stat
            label="Yanlış"
            value={topic.wrong}
            tone="text-rose-600 dark:text-rose-400"
          />
          <Stat label="Boş" value={topic.blank} tone="text-gray-500" />
          <Stat
            label="Net"
            value={formatNet(topic.net)}
            tone="text-indigo-700 dark:text-indigo-300"
          />
        </div>

        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
            <span>Başarı</span>
            <span className={meta.dot}>%{pct}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${meta.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {hasOutcomes ? (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-bold text-gray-600 transition hover:bg-gray-50"
              aria-expanded={expanded}
            >
              {expanded ? "▲ Alt kazanımları kapat" : "▼ Alt kazanımlar"}
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px]">
                {topic.outcomes.length}
              </span>
            </button>
          ) : (
            <span className="text-[11px] font-medium text-gray-400">
              Alt kazanım verisi yok
            </span>
          )}

          {canAssign ? (
            topic.matchedTopicId !== null ? (
              <button
                type="button"
                onClick={onAdd}
                disabled={adding}
                className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 text-[11px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
              >
                {adding ? "Ekleniyor…" : "+ Haftalık Hedefe Ekle"}
              </button>
            ) : (
              <span className="ml-auto text-[10px] font-semibold text-gray-400">
                Müfredat eşleşmesi yok
              </span>
            )
          ) : null}
        </div>
      </div>

      {expanded && hasOutcomes ? (
        <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-3 sm:px-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Konu Detay • Alt Kazanımlar
          </p>
          <ul className="space-y-2">
            {topic.outcomes.map((outcome) => {
              const outcomeMeta = statusMeta(outcome.statusLabel);
              return (
                <li
                  key={`${topic.id}-${outcome.kazanimName}`}
                  className="rounded-xl border border-gray-100 bg-white p-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <p className="min-w-0 flex-1 break-words text-xs font-bold text-gray-800">
                      {outcome.kazanimName}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${outcomeMeta.chip}`}
                    >
                      {outcome.statusLabel}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-500">
                    <span>Soru: {outcome.totalQuestions}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      D: {outcome.correct}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      Y: {outcome.wrong}
                    </span>
                    <span>B: {outcome.blank}</span>
                    <span className="text-indigo-700 dark:text-indigo-300">
                      Net: {formatNet(outcome.net)}
                    </span>
                    <span className={outcomeMeta.dot}>
                      %{clampPct(outcome.successPct)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${outcomeMeta.bar}`}
                      style={{ width: `${clampPct(outcome.successPct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-gray-900",
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-gray-50 px-1 py-1.5">
      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className={`truncate text-xs font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}
