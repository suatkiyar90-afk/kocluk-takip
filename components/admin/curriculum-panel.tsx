"use client";

import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminAddTopic,
  adminListCurriculumTopics,
  adminMergeAndDeleteTopic,
  adminUpdateTopic,
  type AdminCurriculumTopicList,
  type AdminCurriculumTopicRow,
  type MergeTopicSummary,
} from "@/app/actions/curriculum-actions";
import {
  ALL_SUBJECTS,
  examTypes,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50";
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500";
const secondaryButton =
  "h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation";
const dialogContentClass =
  "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl focus:outline-none";

function usageTotal(topic: AdminCurriculumTopicRow): number {
  return topic.entryCount + topic.progressCount + topic.weeklyTargetCount;
}

function topicStats(topic: AdminCurriculumTopicRow): string {
  const parts = [`${topic.questionCount} soru`, `${topic.entryCount} giriş`];
  if (topic.progressCount > 0) {
    parts.push(`${topic.progressCount} ilerleme`);
  }
  if (topic.weeklyTargetCount > 0) {
    parts.push(`${topic.weeklyTargetCount} haftalık hedef`);
  }
  return parts.join(" · ");
}

function usageText(topic: AdminCurriculumTopicRow): string {
  return (
    `${topic.entryCount} soru girişi kaydı, ${topic.progressCount} konu ilerleme kaydı ` +
    `ve ${topic.weeklyTargetCount} haftalık hedef`
  );
}

function mergeSummaryText(summary: MergeTopicSummary): string {
  const parts: string[] = [];
  if (summary.mergedDailyEntries > 0) {
    parts.push(`${summary.mergedDailyEntries} soru kaydı birleştirildi`);
  }
  if (summary.movedDailyEntries > 0) {
    parts.push(`${summary.movedDailyEntries} soru kaydı taşındı`);
  }
  if (summary.mergedProgressRecords > 0) {
    parts.push(`${summary.mergedProgressRecords} ilerleme kaydı temizlendi`);
  }
  if (summary.movedProgressRecords > 0) {
    parts.push(`${summary.movedProgressRecords} ilerleme kaydı taşındı`);
  }
  if (summary.updatedWeeklyTargets > 0) {
    parts.push(`${summary.updatedWeeklyTargets} haftalık hedef güncellendi`);
  }
  if (parts.length === 0) {
    return "Konu silindi.";
  }
  return `Konu silindi. ${parts.join(", ")}.`;
}

interface CurriculumPanelProps {
  initialList: AdminCurriculumTopicList;
}

export function CurriculumPanel({ initialList }: CurriculumPanelProps) {
  const [examType, setExamType] = useState<ExamType>(initialList.examType);
  const [subjectId, setSubjectId] = useState(initialList.subjectId);
  const [list, setList] = useState<AdminCurriculumTopicList>(initialList);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCurriculumTopicRow | null>(null);
  const [deleting, setDeleting] = useState<AdminCurriculumTopicRow | null>(null);

  useEffect(() => {
    setExamType(initialList.examType);
    setSubjectId(initialList.subjectId);
    setList(initialList);
  }, [initialList]);

  const load = useCallback(
    async (nextExamType: ExamType, nextSubjectId: string) => {
      setLoading(true);
      try {
        const result = await adminListCurriculumTopics({
          examType: nextExamType,
          subjectId: nextSubjectId,
        });
        if (result.success === true) {
          setList(result.data);
        } else {
          toast.error(result.message);
        }
      } catch {
        toast.error("Konu listesi yüklenemedi.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const subjects = ALL_SUBJECTS[examType];

  function handleExamTypeChange(next: ExamType) {
    const firstSubjectId = ALL_SUBJECTS[next][0]?.id ?? "";
    setExamType(next);
    setSubjectId(firstSubjectId);
    if (firstSubjectId) {
      void load(next, firstSubjectId);
    }
  }

  function handleSubjectChange(next: string) {
    setSubjectId(next);
    if (next) {
      void load(examType, next);
    }
  }

  function refresh() {
    void load(examType, subjectId);
  }

  const nextSortOrder =
    list.topics.reduce((max, topic) => Math.max(max, topic.sortOrder), 0) + 10;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Sınav türü ve ders
        </h2>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {examTypes.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleExamTypeChange(value)}
              aria-pressed={examType === value}
              className={`h-11 rounded-xl border text-sm font-bold transition touch-manipulation ${
                examType === value
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="curriculum-subject" className={labelClass}>
            Ders
          </label>
          <select
            id="curriculum-subject"
            value={subjectId}
            onChange={(event) => handleSubjectChange(event.target.value)}
            disabled={loading}
            className={inputClass}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              {list.subjectName}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {list.topics.length} konu · {examType}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={loading}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Yeni Konu Ekle
          </button>
        </div>

        {loading ? (
          <div className="mt-4 space-y-2" role="status" aria-label="Konular yükleniyor">
            {[0, 1, 2].map((value) => (
              <div
                key={value}
                aria-hidden="true"
                className="h-16 animate-pulse rounded-xl bg-gray-200"
              />
            ))}
          </div>
        ) : list.topics.length === 0 ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
            Bu derste henüz konu yok. &quot;Yeni Konu Ekle&quot; ile başlayın.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {list.topics.map((topic) => (
              <li
                key={topic.id}
                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-500">
                        {topic.sortOrder}. sıra
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                        {topic.topicName}
                      </p>
                      {topic.isActive ? null : (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                          Pasif
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {topicStats(topic)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(topic)}
                      disabled={loading}
                      aria-label={`${topic.topicName} konusunu düzenle`}
                      title="Konuyu Düzenle"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-indigo-600 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(topic)}
                      disabled={loading}
                      aria-label={`${topic.topicName} konusunu sil`}
                      title="Konuyu Sil / Birleştir"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {addOpen ? (
        <AddTopicDialog
          examType={examType}
          subjectId={subjectId}
          subjectName={list.subjectName}
          defaultSortOrder={nextSortOrder}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
            refresh();
          }}
        />
      ) : null}

      {editing ? (
        <EditTopicDialog
          topic={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteTopicDialog
          topic={deleting}
          others={list.topics.filter((item) => item.id !== deleting.id)}
          subjectName={list.subjectName}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AddTopicDialog({
  examType,
  subjectId,
  subjectName,
  defaultSortOrder,
  onClose,
  onDone,
}: {
  examType: ExamType;
  subjectId: string;
  subjectName: string;
  defaultSortOrder: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [topicName, setTopicName] = useState("");
  const [sortOrder, setSortOrder] = useState(String(defaultSortOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    topicName.trim().length >= 2 && sortOrder.trim().length > 0 && !saving;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await adminAddTopic({
        examType,
        subjectId,
        topicName: topicName.trim(),
        sortOrder: Number(sortOrder),
      });
      if (result.success === true) {
        toast.success(`"${result.data.topicName}" konusu eklendi.`);
        onDone();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className={dialogContentClass}>
          <Dialog.Title className="text-base font-bold text-gray-900">
            Yeni Konu Ekle
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-500">
            {examType} · {subjectName}
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <div>
              <label htmlFor="new-topic-name" className={labelClass}>
                Konu Adı
              </label>
              <input
                id="new-topic-name"
                type="text"
                value={topicName}
                onChange={(event) => setTopicName(event.target.value)}
                placeholder="Örn. Üslü Sayılar"
                autoComplete="off"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="new-topic-order" className={labelClass}>
                Sıra Numarası
              </label>
              <input
                id="new-topic-order"
                type="number"
                inputMode="numeric"
                min={0}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Küçük sıra numarası listede üstte gösterilir.
              </p>
            </div>

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className={secondaryButton}
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
              >
                {saving ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Kaydediliyor…
                  </>
                ) : (
                  "Konuyu Ekle"
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditTopicDialog({
  topic,
  onClose,
  onDone,
}: {
  topic: AdminCurriculumTopicRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [topicName, setTopicName] = useState(topic.topicName);
  const [sortOrder, setSortOrder] = useState(String(topic.sortOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    topicName.trim().length >= 2 && sortOrder.trim().length > 0 && !saving;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await adminUpdateTopic({
        topicId: topic.id,
        topicName: topicName.trim(),
        sortOrder: Number(sortOrder),
      });
      if (result.success === true) {
        toast.success("Konu güncellendi.");
        onDone();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className={dialogContentClass}>
          <Dialog.Title className="text-base font-bold text-gray-900">
            Konuyu Düzenle
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-500">
            Konu adı ve sıra numarası güncellenir; konuya bağlı soru kayıtları
            korunur.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <div>
              <label htmlFor="edit-topic-name" className={labelClass}>
                Konu Adı
              </label>
              <input
                id="edit-topic-name"
                type="text"
                value={topicName}
                onChange={(event) => setTopicName(event.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="edit-topic-order" className={labelClass}>
                Sıra Numarası
              </label>
              <input
                id="edit-topic-order"
                type="number"
                inputMode="numeric"
                min={0}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className={inputClass}
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className={secondaryButton}
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
              >
                {saving ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Kaydediliyor…
                  </>
                ) : (
                  "Kaydet"
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteTopicDialog({
  topic,
  others,
  subjectName,
  onClose,
  onDone,
}: {
  topic: AdminCurriculumTopicRow;
  others: AdminCurriculumTopicRow[];
  subjectName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const total = usageTotal(topic);
  const [targetTopicId, setTargetTopicId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !saving && (total === 0 || targetTopicId !== "");

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      const result = await adminMergeAndDeleteTopic({
        sourceTopicId: topic.id,
        targetTopicId: total === 0 ? null : Number(targetTopicId),
      });
      if (result.success === true) {
        toast.success(mergeSummaryText(result.data));
        onDone();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className={dialogContentClass}>
          <Dialog.Title className="text-base font-bold text-gray-900">
            {total === 0 ? "Konuyu Sil" : "Konuyu Birleştirerek Sil"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-gray-600">
            <span className="font-semibold text-gray-900">
              {topic.topicName}
            </span>{" "}
            konusu {subjectName} dersinden silinecek.
          </Dialog.Description>

          <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-600">
            {usageText(topic)}
          </div>

          <div className="mt-4 space-y-3">
            {total === 0 ? (
              <p className="text-sm leading-relaxed text-gray-600">
                Bu konuya bağlı soru kaydı bulunmuyor. Silme işlemi geri
                alınamaz.
              </p>
            ) : others.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
                Bu konuya bağlı kayıtlar var ancak aktarılabilecek başka bir
                konu yok. Önce hedef konuyu ekleyin.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-gray-600">
                  Bağlı kayıtlar veri kaybı olmadan seçtiğiniz hedef konuya
                  aktarılır: aynı öğrenci ve tarihteki soru girişleri toplanır,
                  konu ilerleme kayıtları ve haftalık hedefler hedefe taşınır.
                </p>
                <div>
                  <label htmlFor="merge-target" className={labelClass}>
                    Hedef Konu
                  </label>
                  <select
                    id="merge-target"
                    value={targetTopicId}
                    onChange={(event) => setTargetTopicId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Hedef konu seçin…</option>
                    {others.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.topicName} (sıra {item.sortOrder})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={secondaryButton}
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave || (total > 0 && others.length === 0)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
            >
              {saving ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Siliniyor…
                </>
              ) : total === 0 ? (
                "Kalıcı Olarak Sil"
              ) : (
                "Birleştir ve Sil"
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
