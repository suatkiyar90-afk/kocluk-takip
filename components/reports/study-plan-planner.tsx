"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReactToPrint } from "react-to-print";
import { ChevronDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { SchoolLogo } from "@/components/brand/school-logo";
import type { CurriculumSnapshot } from "@/app/actions/curriculum-actions";
import {
  generateAutoStudyPlan,
  getStudentWorkloadRecommendation,
  getWeeklyStudyPlan,
  saveWeeklyStudyPlan,
  type GeneratedStudyPlan,
  type WorkloadRecommendation,
} from "@/app/actions/study-plan-actions";
import type { StudyPlanSlot, StudyPlanTaskType } from "@/db/schema";
import type { SmartTargetRecommendation } from "@/app/actions/weekly-target-actions";
import {
  DAY_LABELS,
  DAY_LONG_LABELS,
  TASK_META,
  formatMinutes,
  formatWeekRange,
  parseMinutes,
} from "@/lib/study-plan-meta";
import {
  FOCUS_UI,
  INTENSITY_PROFILES,
  INTENSITY_UI,
  PLAN_LOAD_STATUS_UI,
  computePlanLoad,
  intensityRank,
  pickQuestionCount,
  profileTimeRange,
  type FocusMode,
  type IntensityTier,
} from "@/lib/study-plan-intensity";
import {
  ALLOWED_SUBJECTS_BY_FIELD,
  STUDY_FIELD_LABELS,
  studyFields,
  type StudyField,
} from "@/components/quiz-entry/weekly-quiz-schema";

const SCENARIO_TASK: Record<string, StudyPlanTaskType> = {
  next_guarantee: "konu",
  unfinished: "soru",
  low_accuracy: "soru",
  spaced_repetition: "tekrar",
};

const inputClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass =
  "mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400";

interface StudyPlanPlannerProps {
  studentId: string;
  studentName: string;
  weekStart: string;
  snapshot: CurriculumSnapshot | null;
  studyField: StudyField;
  studyFieldSelected?: boolean;
  studyFieldSaving?: boolean;
  onStudyFieldChange?: (field: StudyField) => void | Promise<void>;
  recommendations: SmartTargetRecommendation[];
  recommendationsLoading: boolean;
  onSaved?: () => void;
}

function createSlotId(dayIndex: number): string {
  return `slot-${dayIndex}-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000_000,
  ).toString(36)}`;
}

export function StudyPlanPlanner({
  studentId,
  studentName,
  weekStart,
  snapshot,
  studyField,
  studyFieldSelected = true,
  studyFieldSaving = false,
  onStudyFieldChange,
  recommendations,
  recommendationsLoading,
  onSaved,
}: StudyPlanPlannerProps) {
  const [slots, setSlots] = useState<StudyPlanSlot[]>([]);
  const [teacherNote, setTeacherNote] = useState("");
  const [activeDay, setActiveDay] = useState(0);
  const [suggestionDay, setSuggestionDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentApproved, setStudentApproved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  /** Kaydedilmiş bir program var mı? Varsa takip modu özeti gösterilir. */
  const [planSaved, setPlanSaved] = useState(false);
  /** Düzenleyici açık mı? null = plan henüz yükleniyor. */
  const [editorOpen, setEditorOpen] = useState<boolean | null>(null);
  const [trackDay, setTrackDay] = useState(0);
  const [copyTargetDay, setCopyTargetDay] = useState(1);
  const [weekdayStart, setWeekdayStart] = useState(
    () => profileTimeRange("medium").weekdayStart,
  );
  const [weekdayEnd, setWeekdayEnd] = useState(
    () => profileTimeRange("medium").weekdayEnd,
  );
  const [weekendStart, setWeekendStart] = useState(
    () => profileTimeRange("medium").weekendStart,
  );
  const [weekendEnd, setWeekendEnd] = useState(
    () => profileTimeRange("medium").weekendEnd,
  );
  const [intensity, setIntensity] = useState<IntensityTier>("medium");
  const [focusMode, setFocusMode] = useState<FocusMode>("balanced");
  const [mockExamDayIndex, setMockExamDayIndex] = useState<number | null>(null);
  const [customTimes, setCustomTimes] = useState(false);
  const [recommendation, setRecommendation] =
    useState<WorkloadRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [includeDailyRoutine, setIncludeDailyRoutine] = useState(true);
  const [lastGenerated, setLastGenerated] = useState<GeneratedStudyPlan | null>(
    null,
  );
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Haftalik_Calisma_Plani_${weekStart}`,
    pageStyle: "@page { size: A4 landscape; margin: 8mm; }",
  });

  const loadPlan = useCallback(async () => {
    setLoading(true);
    const result = await getWeeklyStudyPlan(studentId, weekStart);
    const hasSavedPlan =
      result.success === true &&
      result.data !== null &&
      result.data.slots.length > 0;
    if (result.success === true && result.data !== null) {
      setSlots(result.data.slots);
      setTeacherNote(result.data.teacherNote);
      setStudentApproved(result.data.isApproved);
    } else {
      setSlots([]);
      setTeacherNote("");
      setStudentApproved(false);
    }
    // Kaydedilmiş program varsa planlayıcı kapalı (takip modu), yoksa açık gelir.
    setPlanSaved(hasSavedPlan);
    setEditorOpen(!hasSavedPlan);
    setTrackDay(0);
    setLoading(false);
  }, [studentId, weekStart]);

  useEffect(() => {
    setActiveDay(0);
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    let cancelled = false;
    setRecommendation(null);
    setRecommendationLoading(true);
    void (async () => {
      const result = await getStudentWorkloadRecommendation(studentId);
      if (cancelled) return;
      setRecommendation(result.success === true ? result.data : null);
      setRecommendationLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  function selectIntensity(tier: IntensityTier) {
    setIntensity(tier);
    if (!customTimes) {
      const range = profileTimeRange(tier);
      setWeekdayStart(range.weekdayStart);
      setWeekdayEnd(range.weekdayEnd);
      setWeekendStart(range.weekendStart);
      setWeekendEnd(range.weekendEnd);
    }
  }

  function updateTime(
    setter: (value: string) => void,
    value: string,
  ) {
    setter(value);
    setCustomTimes(true);
  }

  const subjectGroups = useMemo(
    () => (snapshot ? [...snapshot.tyt, ...snapshot.ayt, ...snapshot.ydt] : []),
    [snapshot],
  );
  const allowedSubjectIds = ALLOWED_SUBJECTS_BY_FIELD[studyField];
  const allowedGroups = useMemo(
    () =>
      subjectGroups.filter((group) =>
        allowedSubjectIds.includes(group.subjectId),
      ),
    [subjectGroups, allowedSubjectIds],
  );

  const daySlots = useMemo(
    () =>
      slots
        .filter((slot) => slot.dayIndex === activeDay)
        .sort(
          (a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime),
        ),
    [slots, activeDay],
  );

  const totalQuestions = slots.reduce(
    (sum, slot) => sum + slot.questionCount,
    0,
  );
  const load = computePlanLoad(slots);
  const completedCount = slots.filter((slot) => slot.isCompleted).length;
  const completionPercent =
    slots.length > 0 ? Math.round((completedCount / slots.length) * 100) : 0;
  const dailyStats = useMemo(
    () =>
      DAY_LONG_LABELS.map((label, index) => {
        const list = slots.filter((slot) => slot.dayIndex === index);
        return {
          dayIndex: index,
          label,
          total: list.length,
          done: list.filter((slot) => slot.isCompleted).length,
          questions: list.reduce((sum, slot) => sum + slot.questionCount, 0),
          slots: [...list].sort(
            (a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime),
          ),
        };
      }),
    [slots],
  );
  const trackedDay = dailyStats[trackDay] ?? dailyStats[0];
  const printIntensity =
    lastGenerated?.intensity ??
    (load.status === "low" ||
    load.status === "medium" ||
    load.status === "high"
      ? load.status
      : intensity);
  const overloadWarning =
    recommendation !== null &&
    intensityRank(intensity) - intensityRank(recommendation.recommendedIntensity) >=
      2;

  function nextStartTime(dayIndex: number): string {
    const dayList = slots.filter((slot) => slot.dayIndex === dayIndex);
    if (dayList.length === 0) {
      return dayIndex >= 5 ? "10:00" : "18:00";
    }
    const lastEnd = dayList.reduce(
      (latest, slot) =>
        parseMinutes(slot.endTime) > parseMinutes(latest)
          ? slot.endTime
          : latest,
      "00:00",
    );
    return formatMinutes(parseMinutes(lastEnd) + 15);
  }

  function addSlot(seed?: Partial<StudyPlanSlot>) {
    const startTime = seed?.startTime ?? nextStartTime(activeDay);
    const endTime =
      seed?.endTime ?? formatMinutes(parseMinutes(startTime) + 60);
    const defaultGroup = allowedGroups[0];
    setSlots((current) => [
      ...current,
      {
        id: createSlotId(activeDay),
        dayIndex: seed?.dayIndex ?? activeDay,
        startTime,
        endTime,
        taskType: seed?.taskType ?? "soru",
        examType: seed?.examType ?? defaultGroup?.examType ?? "TYT",
        subjectId: seed?.subjectId ?? defaultGroup?.subjectId ?? "turkce",
        subjectName:
          seed?.subjectName ?? defaultGroup?.subjectName ?? "Türkçe",
        topicId: seed?.topicId ?? null,
        topicName: seed?.topicName ?? null,
        questionCount: seed?.questionCount ?? pickQuestionCount(intensity, "soru"),
        note: seed?.note ?? "",
        recommendationReason: seed?.recommendationReason,
      },
    ]);
  }

  function updateSlot(id: string, patch: Partial<StudyPlanSlot>) {
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    );
  }

  function removeSlot(id: string) {
    setSlots((current) => current.filter((slot) => slot.id !== id));
  }

  function moveSlot(id: string, dayIndex: number) {
    updateSlot(id, { dayIndex });
  }

  function copySlot(slot: StudyPlanSlot) {
    setSlots((current) => [
      ...current,
      {
        ...slot,
        id: createSlotId(copyTargetDay),
        dayIndex: copyTargetDay,
        isCompleted: false,
        completedAt: null,
      },
    ]);
    toast.success(`${DAY_LONG_LABELS[copyTargetDay]} gününe kopyalandı.`);
  }

  function changeSubject(id: string, subjectId: string) {
    const group = subjectGroups.find((item) => item.subjectId === subjectId);
    if (!group) return;
    updateSlot(id, {
      subjectId: group.subjectId,
      subjectName: group.subjectName,
      examType: group.examType,
      topicId: null,
      topicName: null,
    });
  }

  function changeTopic(id: string, raw: string) {
    if (raw === "") {
      updateSlot(id, { topicId: null, topicName: null });
      return;
    }
    const topicId = Number(raw);
    const slot = slots.find((item) => item.id === id);
    const group = subjectGroups.find(
      (item) => item.subjectId === slot?.subjectId,
    );
    const topic = group?.topics.find((item) => item.topicId === topicId);
    updateSlot(id, {
      topicId,
      topicName: topic?.topicName ?? null,
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateAutoStudyPlan({
        studentId,
        weekStart,
        weekdayStart,
        weekdayEnd,
        weekendStart,
        weekendEnd,
        includeDailyRoutine,
        intensity,
        focusMode,
        mockExamDayIndex,
      });
      if (result.success === true) {
        setSlots(result.data.slots);
        setLastGenerated(result.data);
        // Yeni taslak kaydedilmediği için takip özeti gizlenir, düzenleyici açılır.
        setPlanSaved(false);
        setEditorOpen(true);
        toast.success(
          `${result.data.slots.length} etüt ve ${result.data.summary.totalQuestions} soruluk taslak oluşturuldu.`,
        );
        for (const warning of result.data.warnings) {
          toast.warning(warning);
        }
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Plan oluşturulurken bilinmeyen bir hata oluştu.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveWeeklyStudyPlan({
        studentId,
        weekStart,
        teacherNote,
        slots,
      });
      if (result.success === true) {
        toast.success(
          `Program yayınlandı. ${result.data.subjectCount} ders, ${result.data.totalQuestions} soru hedefi uygulandı.`,
        );
        setStudentApproved(false);
        setSlots((current) =>
          current.map((slot) => ({
            ...slot,
            isCompleted: false,
            completedAt: null,
          })),
        );
        // Yayınlandıktan sonra düzenleyici kapanır, temiz takip görünümü açılır.
        setPlanSaved(true);
        setEditorOpen(false);
        setTrackDay(0);
        onSaved?.();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Program kaydedilirken bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  function toggleEditor() {
    setEditorOpen((prev) => (prev === null ? prev : !prev));
  }

  function addSuggestion(rec: SmartTargetRecommendation) {
    const targetDay = suggestionDay ?? activeDay;
    const startTime = nextStartTime(targetDay);
    const group = subjectGroups.find(
      (item) => item.subjectId === rec.subjectId,
    );
    addSlot({
      dayIndex: targetDay,
      startTime,
      endTime: formatMinutes(parseMinutes(startTime) + 60),
      taskType: SCENARIO_TASK[rec.scenario] ?? "soru",
      examType: rec.examType,
      subjectId: rec.subjectId,
      subjectName: group?.subjectName ?? rec.subjectName,
      topicId: rec.topicId,
      topicName: rec.topicName,
      questionCount: rec.suggestedQuestions,
      note: "",
      recommendationReason: rec.reason,
    });
    toast.success(
      `"${rec.topicName}" ${DAY_LONG_LABELS[targetDay]} gününe ${startTime} etüdü olarak eklendi.`,
    );
  }

  return (
    <section>
      <style>
        {"@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}
      </style>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
          Haftalık Çalışma Planlayıcısı · {formatWeekRange(weekStart)}
        </h2>
        {planSaved ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {slots.length > 0 ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                ✅ {completedCount} / {slots.length} Etüt (%{completionPercent})
              </span>
            ) : null}
            {slots.length > 0 ? (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  studentApproved
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-sky-50 text-sky-700"
                }`}
              >
                {studentApproved
                  ? "✓ Öğrenci onayladı"
                  : "⏳ Öğrenci onayı bekleniyor"}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {planSaved ? (
        <div className="mb-3 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">
                📊 Haftalık Program İlerleme Takibi
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-gray-600">
                {formatWeekRange(weekStart)} · {slots.length} Etüt
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-2.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-50 touch-manipulation"
              >
                🖨️ PDF Çizelge
              </button>
              <button
                type="button"
                onClick={toggleEditor}
                aria-expanded={editorOpen === true}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-indigo-600 px-2.5 text-[11px] font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 touch-manipulation"
              >
                {editorOpen
                  ? "▲ Planlayıcıyı Gizle"
                  : "✏️ Programı Düzenle / Planlayıcıyı Aç ▾"}
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Genel Uyum
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  studentApproved
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                }`}
              >
                {studentApproved
                  ? "✅ Programı İnceledi / Onayladı"
                  : "⏳ Onay Bekleniyor"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-black text-gray-900">
                {completedCount} / {slots.length} Etüt{" "}
                <span className="text-indigo-600">(%{completionPercent})</span>
              </p>
              <p className="text-[11px] font-semibold text-gray-500">
                Toplam Hedef:{" "}
                <span className="font-black text-gray-900">
                  {totalQuestions} Soru
                </span>
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-[width] ${
                  completionPercent >= 100
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-indigo-500 to-violet-500"
                }`}
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {dailyStats.map((stat) => {
                const active = trackDay === stat.dayIndex;
                const allDone = stat.total > 0 && stat.done === stat.total;
                return (
                  <button
                    key={stat.dayIndex}
                    type="button"
                    onClick={() => setTrackDay(stat.dayIndex)}
                    aria-pressed={active}
                    aria-label={`${stat.label} ${stat.done}/${stat.total} etüt`}
                    className={`flex flex-col items-center justify-center rounded-lg border px-0.5 py-1.5 transition touch-manipulation ${
                      active
                        ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200"
                        : allDone
                          ? "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase text-gray-500">
                      {DAY_LABELS[stat.dayIndex]}
                    </span>
                    <span className="text-[11px] font-black text-gray-900">
                      {stat.done}/{stat.total}
                    </span>
                    <span className="h-3 text-[9px] leading-none">
                      {allDone ? "✅" : stat.done > 0 ? "⏳" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50/60 p-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <p className="text-[11px] font-bold text-gray-700">
                  {trackedDay.label} · salt okunur
                </p>
                <span className="text-[10px] font-semibold text-gray-500">
                  {trackedDay.done}/{trackedDay.total} tamamlandı ·{" "}
                  {trackedDay.questions} soru
                </span>
              </div>
              {trackedDay.slots.length === 0 ? (
                <p className="mt-1.5 rounded-lg bg-white px-2 py-2 text-[11px] font-medium text-gray-400 ring-1 ring-gray-200">
                  Bu gün için etüt planlanmamış.
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {trackedDay.slots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 ring-1 ring-gray-200"
                    >
                      <span className="w-[5.25rem] shrink-0 text-[10px] font-bold text-gray-600">
                        {slot.startTime}–{slot.endTime}
                      </span>
                      <span className="shrink-0 text-[10px]">
                        {TASK_META[slot.taskType].icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-800">
                        {slot.subjectName}
                        {slot.topicName ? ` · ${slot.topicName}` : ""}
                      </span>
                      {slot.questionCount > 0 ? (
                        <span className="shrink-0 text-[10px] font-bold text-gray-500">
                          {slot.questionCount} soru
                        </span>
                      ) : null}
                      <span
                        className={`shrink-0 text-[11px] font-bold ${
                          slot.isCompleted
                            ? "text-emerald-600"
                            : "text-gray-300"
                        }`}
                      >
                        {slot.isCompleted ? "✓" : "•"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen === null ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
          Plan yükleniyor…
        </div>
      ) : editorOpen ? (
        <>
          <div className="mb-3 rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">
            Canlı Yük Göstergesi
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PLAN_LOAD_STATUS_UI[load.status].className}`}
          >
            {PLAN_LOAD_STATUS_UI[load.status].label}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-bold text-gray-900">
          Toplam: {load.blockCount} Etüt ·{" "}
          {load.hours.toLocaleString("tr-TR", {
            maximumFractionDigits: 1,
          })}{" "}
          Saat · {load.totalQuestions} Soru
        </p>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-[width] ${
              load.status === "below"
                ? "bg-slate-400"
                : load.status === "low"
                  ? "bg-gradient-to-r from-sky-500 to-cyan-500"
                  : load.status === "medium"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : "bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500"
            }`}
            style={{
              width: `${Math.min(
                100,
                Math.round(
                  (load.totalQuestions /
                    INTENSITY_PROFILES[intensity].targetQuestions) *
                    100,
                ),
              )}%`,
            }}
          />
        </div>
        <p className="mt-1 text-[10px] font-medium text-gray-400">
          {INTENSITY_PROFILES[intensity].emoji}{" "}
          {INTENSITY_PROFILES[intensity].label} hedefi:{" "}
          {INTENSITY_PROFILES[intensity].minQuestions}
          {Number.isFinite(INTENSITY_PROFILES[intensity].maxQuestions)
            ? `-${INTENSITY_PROFILES[intensity].maxQuestions}`
            : "+"}{" "}
          soru
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width]"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-emerald-700">
            Öğrenci uyumu: {completedCount} / {slots.length} (%{completionPercent})
          </span>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
              🎓 Öğrenci Alanı
            </p>
            <span className="text-[10px] font-semibold text-indigo-500">
              {studyFieldSaving
                ? "Kaydediliyor…"
                : `${STUDY_FIELD_LABELS[studyField]} alanına göre hazırlanıyor`}
            </span>
          </div>
          <div
            role="radiogroup"
            aria-label="Öğrenci alanı"
            className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
          >
            {studyFields.map((field) => {
              const active = studyField === field;
              return (
                <button
                  key={field}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={studyFieldSaving}
                  onClick={() => {
                    if (active) return;
                    void onStudyFieldChange?.(field);
                  }}
                  className={`h-9 rounded-lg border text-[11px] font-bold transition active:scale-[0.98] disabled:opacity-60 touch-manipulation ${
                    active
                      ? "border-indigo-500 bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                      : "border-indigo-100 bg-white/70 text-gray-600 hover:bg-white"
                  }`}
                >
                  {STUDY_FIELD_LABELS[field]} ({field})
                </button>
              );
            })}
          </div>
          {studyFieldSelected === false ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-700">
              Alan seçilmedi. Öneriler şimdilik Sayısal alanına göre
              hazırlanıyor; alanı seçtiğinde havuz ve şablon anında güncellenir.
            </p>
          ) : null}
          <p className="mt-2 text-[10px] font-medium leading-snug text-indigo-500">
            💡 Bu seçim öneri havuzunu, manuel etüt ders listesini ve otomatik
            şablon motorunu anında etkiler.
          </p>
        </div>

        <p className="mt-2.5 text-[11px] font-semibold text-gray-500">
          {recommendationLoading ? (
            "Öğrencinin son 3 hafta ortalaması hesaplanıyor…"
          ) : recommendation ? (
            <>
              Öğrencinin son 3 hafta ortalaması:{" "}
              <span className="font-bold text-gray-900">
                {recommendation.avgWeeklyQuestions} soru/hafta
              </span>{" "}
              • Önerilen:{" "}
              <span className="font-bold text-indigo-700">
                {INTENSITY_PROFILES[recommendation.recommendedIntensity].label}
              </span>
            </>
          ) : (
            "Öğrencinin son 3 haftasına ait soru kaydı bulunamadı."
          )}
        </p>

        {overloadWarning && recommendation ? (
          <p className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-semibold leading-snug text-indigo-800">
            ⚠️ Seçilen yoğunluk, öğrencinin son 3 haftalık ortalamasının çok
            üzerinde. Öğrenci şu anda haftada ortalama{" "}
            {recommendation.avgWeeklyQuestions} soru çözüyor;{" "}
            {INTENSITY_PROFILES[intensity].label} seviyeyi seçmeden önce
            kapasitesini gözden geçir.
          </p>
        ) : null}

        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {(Object.keys(INTENSITY_UI) as IntensityTier[]).map((tier) => {
            const meta = INTENSITY_UI[tier];
            const active = intensity === tier;
            const recommended =
              recommendation?.recommendedIntensity === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => selectIntensity(tier)}
                aria-pressed={active}
                className={`relative rounded-xl border p-2.5 text-left transition touch-manipulation ${
                  active ? meta.active : meta.idle
                }`}
              >
                {recommended ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Önerilen
                  </span>
                ) : null}
                <p className="text-xs font-black text-gray-900">
                  {meta.title}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-gray-500">
                  {meta.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.6fr_1fr]">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Odak
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FOCUS_UI) as FocusMode[]).map((mode) => {
                const meta = FOCUS_UI[mode];
                const active = focusMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFocusMode(mode)}
                    title={meta.description}
                    aria-pressed={active}
                    className={`h-9 rounded-lg border px-2.5 text-[11px] font-bold transition touch-manipulation ${
                      active
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label
              htmlFor="mock-exam-day"
              className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400"
            >
              Deneme Günü
            </label>
            <select
              id="mock-exam-day"
              value={mockExamDayIndex === null ? "" : mockExamDayIndex}
              onChange={(e) =>
                setMockExamDayIndex(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="h-9 w-full rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-800"
            >
              <option value="">Yok</option>
              {DAY_LONG_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            aria-expanded={settingsOpen}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gray-100 px-3 text-xs font-bold text-gray-700 transition hover:bg-gray-200 touch-manipulation"
          >
            ⚙️ Saat Ayarları
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => setPoolOpen((prev) => !prev)}
            aria-expanded={poolOpen}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-50 px-3 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 touch-manipulation"
          >
            💡 Akıllı Öneri Havuzu
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold">
              {recommendations.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || loading}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span>✨</span>
            )}
            Otomatik Şablon Oluştur
          </button>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            disabled={slots.length === 0}
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 touch-manipulation"
          >
            <Printer className="h-3.5 w-3.5" /> 🖨️ Programı PDF Al / Yazdır
          </button>
        </div>

        {settingsOpen ? (
          <div className="grid gap-3 border-b border-gray-100 bg-gray-50/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className={labelClass}>Hafta içi başlangıç</span>
              <input
                type="time"
                value={weekdayStart}
                onChange={(e) => updateTime(setWeekdayStart, e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <span className={labelClass}>Hafta içi bitiş</span>
              <input
                type="time"
                value={weekdayEnd}
                onChange={(e) => updateTime(setWeekdayEnd, e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <span className={labelClass}>Hafta sonu başlangıç</span>
              <input
                type="time"
                value={weekendStart}
                onChange={(e) => updateTime(setWeekendStart, e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <span className={labelClass}>Hafta sonu bitiş</span>
              <input
                type="time"
                value={weekendEnd}
                onChange={(e) => updateTime(setWeekendEnd, e.target.value)}
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 sm:col-span-2 lg:col-span-4 touch-manipulation">
              <input
                type="checkbox"
                checked={includeDailyRoutine}
                onChange={(e) => setIncludeDailyRoutine(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Her günün ilk etüdüne Paragraf + Problem rutini ekle
            </label>
          </div>
        ) : null}

        {poolOpen ? (
          <div className="border-b border-gray-100 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50/60 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                🎯 {STUDY_FIELD_LABELS[studyField]} ({studyField}) alanına göre
                öneriler
              </p>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                Etüt günü
                <select
                  aria-label="Öneriyi ekleyeceğin gün"
                  value={suggestionDay ?? activeDay}
                  onChange={(e) => setSuggestionDay(Number(e.target.value))}
                  className="h-7 rounded-lg border border-indigo-200 bg-white px-1.5 text-[11px] font-bold text-indigo-700"
                >
                  {DAY_LONG_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {recommendationsLoading ? (
              <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-500">
                Öneriler hazırlanıyor…
              </p>
            ) : recommendations.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-500">
                Uygun öneri bulunamadı. Konu durumları ve deneme sonuçları
                güncellendikçe öneriler oluşur.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {recommendations.map((rec) => (
                  <div
                    key={`${rec.subjectId}-${rec.topicId}`}
                    className="rounded-xl border border-gray-200 bg-white p-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          rec.fieldPriority
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
                        }`}
                      >
                        {rec.fieldPriority
                          ? `🎯 ${rec.fieldCode} Alan Önceliği`
                          : `🔻 Alan Dışı (${rec.fieldCode})`}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        {rec.examType} · {rec.subjectName}
                      </span>
                      <span className="ml-auto rounded-lg bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
                        {Math.round(rec.priorityScore)} puan
                      </span>
                    </div>
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-gray-900">
                          {rec.topicName}
                        </p>
                        <p className="text-[11px] font-medium leading-snug text-gray-500">
                          {rec.reason}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addSuggestion(rec)}
                        className="h-9 shrink-0 rounded-lg bg-indigo-600 px-3 text-[11px] font-bold text-white transition active:scale-[0.98] touch-manipulation"
                      >
                        + {DAY_LABELS[suggestionDay ?? activeDay]} ·{" "}
                        {rec.suggestedQuestions} soru
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-2 py-2">
          {DAY_LABELS.map((label, index) => {
            const count = slots.filter((slot) => slot.dayIndex === index).length;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveDay(index)}
                className={`flex h-10 min-w-[3.75rem] flex-1 flex-col items-center justify-center rounded-lg px-2 text-[11px] font-bold transition touch-manipulation ${
                  activeDay === index
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
                <span
                  className={`text-[9px] font-semibold ${
                    activeDay === index ? "text-indigo-100" : "text-gray-400"
                  }`}
                >
                  {count} etüt
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5 p-3">
          {loading ? (
            <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm font-medium text-gray-500">
              Plan yükleniyor…
            </p>
          ) : daySlots.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm font-medium text-gray-500">
              {DAY_LONG_LABELS[activeDay]} için etüt yok. “Otomatik Şablon
              Oluştur” veya “+ Yeni Etüt Saati Ekle” ile başla.
            </p>
          ) : (
            daySlots.map((slot) => {
              const meta = TASK_META[slot.taskType];
              const group = subjectGroups.find(
                (item) => item.subjectId === slot.subjectId,
              );
              return (
                <div
                  key={slot.id}
                  className={`rounded-xl border p-2.5 shadow-sm ${
                    slot.isCompleted
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    {slot.isCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        ✅ Tamamlandı
                      </span>
                    ) : null}
                    <input
                      type="time"
                      aria-label="Başlangıç saati"
                      value={slot.startTime}
                      onChange={(e) =>
                        updateSlot(slot.id, { startTime: e.target.value })
                      }
                      className="h-8 w-[6.5rem] rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-800"
                    />
                    <span className="text-xs font-bold text-gray-400">—</span>
                    <input
                      type="time"
                      aria-label="Bitiş saati"
                      value={slot.endTime}
                      onChange={(e) =>
                        updateSlot(slot.id, { endTime: e.target.value })
                      }
                      className="h-8 w-[6.5rem] rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-800"
                    />
                    <select
                      aria-label="Görev türü"
                      value={slot.taskType}
                      onChange={(e) =>
                        updateSlot(slot.id, {
                          taskType: e.target.value as StudyPlanTaskType,
                        })
                      }
                      className="h-8 rounded-lg border border-gray-200 px-1.5 text-[11px] font-semibold text-gray-700"
                    >
                      {(Object.keys(TASK_META) as StudyPlanTaskType[]).map(
                        (type) => (
                          <option key={type} value={type}>
                            {TASK_META[type].icon} {TASK_META[type].label}
                          </option>
                        ),
                      )}
                    </select>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                      {slot.examType}
                    </span>
                    <button
                      type="button"
                      aria-label="Etüdü sil"
                      onClick={() => removeSlot(slot.id)}
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-xs text-red-600 transition active:scale-95 touch-manipulation"
                    >
                      🗑
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_1.4fr_5.5rem]">
                    <select
                      aria-label="Ders"
                      value={slot.subjectId}
                      onChange={(e) => changeSubject(slot.id, e.target.value)}
                      className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-800"
                    >
                      {group === undefined ? (
                        <option value={slot.subjectId}>
                          {slot.subjectName}
                        </option>
                      ) : null}
                      {allowedGroups.map((item) => (
                        <option key={item.subjectId} value={item.subjectId}>
                          {item.subjectName}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Konu"
                      value={slot.topicId ?? ""}
                      onChange={(e) => changeTopic(slot.id, e.target.value)}
                      className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-800"
                    >
                      <option value="">Konu seçilmedi</option>
                      {(group?.topics ?? []).map((topic) => (
                        <option key={topic.topicId} value={topic.topicId}>
                          {topic.topicName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      aria-label="Soru sayısı"
                      value={slot.questionCount}
                      onChange={(e) =>
                        updateSlot(slot.id, {
                          questionCount: Number(e.target.value) || 0,
                        })
                      }
                      className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-800"
                      placeholder="Soru"
                    />
                  </div>

                  <input
                    type="text"
                    value={slot.note}
                    onChange={(e) =>
                      updateSlot(slot.id, { note: e.target.value })
                    }
                    placeholder="Not (isteğe bağlı)"
                    className="mt-2 h-9 w-full rounded-lg border border-gray-200 px-2 text-xs text-gray-700"
                  />

                  {slot.recommendationReason ? (
                    <p className="mt-1.5 rounded-lg bg-indigo-50/70 px-2 py-1.5 text-[10px] font-medium leading-snug text-indigo-700">
                      {slot.recommendationReason}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      Gün
                    </span>
                    <select
                      aria-label="Günü taşı"
                      value={slot.dayIndex}
                      onChange={(e) =>
                        moveSlot(slot.id, Number(e.target.value))
                      }
                      className="h-8 rounded-lg border border-gray-200 px-1.5 text-[11px] font-semibold text-gray-700"
                    >
                      {DAY_LONG_LABELS.map((label, index) => (
                        <option key={label} value={index}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => copySlot(slot)}
                      className="h-8 rounded-lg bg-gray-100 px-2 text-[11px] font-bold text-gray-700 transition hover:bg-gray-200 touch-manipulation"
                    >
                      📋 {DAY_LABELS[copyTargetDay]} gününe kopyala
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => addSlot()}
              className="h-10 flex-1 rounded-xl border-2 border-dashed border-indigo-300 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 touch-manipulation"
            >
              + Yeni Etüt Saati Ekle
            </button>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
              Kopyalama hedefi
              <select
                aria-label="Kopyalama hedef günü"
                value={copyTargetDay}
                onChange={(e) => setCopyTargetDay(Number(e.target.value))}
                className="h-9 rounded-lg border border-gray-200 px-1.5 text-[11px] font-semibold text-gray-700"
              >
                {DAY_LONG_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 p-3">
          <div>
            <label
              htmlFor="study-plan-note"
              className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400"
            >
              Öğretmen Notu
            </label>
            <textarea
              id="study-plan-note"
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Öğrenciye hafta boyunca hatırlatmak istediklerin…"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {lastGenerated ? (
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-gray-500">
              <span className="rounded-full bg-white px-2 py-1 ring-1 ring-gray-200">
                {STUDY_FIELD_LABELS[lastGenerated.studyField]} alanı
              </span>
              {lastGenerated.summary.bySubject.slice(0, 6).map((item) => (
                <span
                  key={item.subjectId}
                  className="rounded-full bg-white px-2 py-1 ring-1 ring-gray-200"
                >
                  {item.subjectName}: {item.questions} soru
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || slots.length === 0}
            className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
          >
            {saving
              ? "Yayınlanıyor…"
              : "🚀 Programı Yayınla ve Hedeflere Uygula"}
          </button>
          <p className="text-[11px] font-medium leading-snug text-gray-500">
            Yayınlandığında ders bazında soru toplamları haftalık hedeflere
            yazılır ve öğrenciye bildirim gönderilir.
          </p>
        </div>
      </div>
        </>
      ) : null}

      {printOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-2 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">Program Önizleme</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePrint()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-gray-800 shadow touch-manipulation"
              >
                <Printer className="h-4 w-4" /> Yazdır / PDF
              </button>
              <button
                type="button"
                onClick={() => setPrintOpen(false)}
                className="h-10 rounded-xl bg-white/20 px-3 text-xs font-bold text-white touch-manipulation"
              >
                Kapat
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto rounded-xl bg-white">
            <div
              ref={printRef}
              className="min-w-[1000px] bg-white p-6 text-gray-900"
            >
              <div className="flex items-center gap-4 border-b-2 border-indigo-700 pb-3">
                <SchoolLogo className="h-16 w-16 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
                    Demirci AİHL · Akademik Takip Sistemi
                  </p>
                  <h1 className="text-xl font-black text-gray-900">
                    Haftalık Ders Çalışma Programı
                  </h1>
                  <p className="text-xs font-semibold text-gray-600">
                    {studentName} · {STUDY_FIELD_LABELS[studyField]} ·{" "}
                    {formatWeekRange(weekStart)}
                  </p>
                </div>
                <div className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                    Yoğunluk
                  </p>
                  <p className="text-sm font-black text-indigo-800">
                    {INTENSITY_PROFILES[printIntensity].emoji}{" "}
                    {INTENSITY_PROFILES[printIntensity].label}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-indigo-600">
                    {slots.length} Etüt · {totalQuestions} Soru
                  </p>
                </div>
              </div>

              <table className="mt-4 w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-indigo-700 text-white">
                    <th className="border border-indigo-700 px-2 py-1.5 text-left font-bold">
                      Gün
                    </th>
                    <th className="border border-indigo-700 px-2 py-1.5 text-left font-bold">
                      Saat
                    </th>
                    <th className="border border-indigo-700 px-2 py-1.5 text-left font-bold">
                      Ders
                    </th>
                    <th className="border border-indigo-700 px-2 py-1.5 text-left font-bold">
                      Konu
                    </th>
                    <th className="border border-indigo-700 px-2 py-1.5 text-left font-bold">
                      Görev Türü
                    </th>
                    <th className="border border-indigo-700 px-2 py-1.5 text-center font-bold">
                      Soru
                    </th>
                    <th className="border border-indigo-700 px-2 py-1.5 text-left font-bold">
                      Öğretmen Notu
                    </th>
                    <th className="border border-indigo-700 px-2 py-1.5 text-center font-bold">
                      Tik
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DAY_LONG_LABELS.map((dayLabel, dayIndex) => {
                    const items = slots
                      .filter((slot) => slot.dayIndex === dayIndex)
                      .sort(
                        (a, b) =>
                          parseMinutes(a.startTime) -
                          parseMinutes(b.startTime),
                      );
                    if (items.length === 0) {
                      return (
                        <tr key={`${dayLabel}-empty`}>
                          <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-bold text-gray-700">
                            {dayLabel}
                          </td>
                          <td
                            colSpan={7}
                            className="border border-gray-300 px-2 py-1.5 text-center font-medium text-gray-400"
                          >
                            Etüt yok
                          </td>
                        </tr>
                      );
                    }
                    return items.map((slot, index) => {
                      const meta = TASK_META[slot.taskType];
                      return (
                        <tr
                          key={slot.id}
                          className="break-inside-avoid align-top"
                        >
                          {index === 0 ? (
                            <td
                              rowSpan={items.length}
                              className="border border-gray-300 bg-gray-50 px-2 py-1.5 align-top font-black text-gray-800"
                            >
                              {dayLabel}
                            </td>
                          ) : null}
                          <td className="whitespace-nowrap border border-gray-300 px-2 py-1.5 font-bold text-gray-700">
                            {slot.startTime}–{slot.endTime}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 font-bold text-gray-900">
                            {slot.subjectName}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-gray-700">
                            {slot.topicName ?? "—"}
                          </td>
                          <td className="whitespace-nowrap border border-gray-300 px-2 py-1.5 text-gray-700">
                            {meta.icon} {meta.label}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center font-bold text-gray-800">
                            {slot.questionCount > 0
                              ? slot.questionCount
                              : "—"}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-[9px] leading-snug text-gray-600">
                            {slot.note || "—"}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            <span className="inline-block h-4 w-4 rounded-[3px] border border-gray-500 bg-white align-middle" />
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>

              {teacherNote.trim() ? (
                <div className="mt-3 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-bold text-gray-800">
                    Öğretmen Notu
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[10px] font-medium leading-snug text-gray-600">
                    {teacherNote}
                  </p>
                </div>
              ) : null}

              <p className="mt-3 text-[9px] font-medium text-gray-400">
                Her etüdü tamamladığında sağdaki kutuyu işaretle. Soru
                sayılarını günlük Veri Girişi ekranından ayrıca kaydet.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
