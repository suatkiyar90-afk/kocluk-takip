"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { toast } from "sonner";
import {
  getRecentTopicsForSubject,
  saveDay,
  type RecentTopicRow,
} from "@/app/actions/quiz-actions";
import {
  examTypes,
  netScore,
  type ExamType,
} from "@/components/quiz-entry/weekly-quiz-schema";
import type {
  DayAttemptRow,
  DayEntryRow,
  SubjectOptions,
  TopicOption,
} from "@/components/quiz-entry/daily-entry-types";
import {
  MAX_DAY_ENTRIES,
  addOrMergeEntry,
  draftKey,
  entryNet,
  groupEntriesBySubject,
  listTotals,
  mergeDraftWithServer,
  parseDraft,
  removeEntry,
  restoreEntry,
  serializeDraft,
  validateEntryList,
  type DraftAttempt,
  type ListEntry,
} from "@/lib/daily-entry-list";
import {
  bransSubjects,
  denemeTypeOptions,
  getDenemeLabel,
  MAX_DAY_ATTEMPTS,
  resolveTytBlank,
  validateDenemeCounts,
} from "@/lib/deneme";

function formatNet(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function mapRows(rows: DayEntryRow[]): ListEntry[] {
  return rows.map((row) => ({
    topicId: row.topicId,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    examType: row.examType,
    topicName: row.topicName,
    correct: row.correct,
    wrong: row.wrong,
    blank: row.blank,
  }));
}

function mapAttemptRows(rows: DayAttemptRow[]): DraftAttempt[] {
  return rows.map((row) => ({
    denemeKey: row.denemeKey,
    correct: row.correct,
    wrong: row.wrong,
    blank: row.blank,
  }));
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(300, Math.max(0, Math.floor(value)));
}

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500";
const countInputClass =
  "h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-1 text-center text-base font-bold text-gray-900 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

interface DailyEntryFormProps {
  studentId: string;
  date: string;
  subjects: SubjectOptions;
  initialEntries: DayEntryRow[];
  initialAttempts: DayAttemptRow[];
  initialSummary: string;
  windowOpen: boolean;
  onSaved: () => void;
}

export function DailyEntryForm({
  studentId,
  date,
  subjects,
  initialEntries,
  initialAttempts,
  initialSummary,
  windowOpen,
  onSaved,
}: DailyEntryFormProps) {
  const [examType, setExamType] = useState<ExamType>("TYT");
  const [entryMode, setEntryMode] = useState<"konular" | "deneme">("konular");
  const [denemeBaseType, setDenemeBaseType] = useState<
    "tyt" | "ayt" | "brans"
  >("tyt");
  const [denemeSubjectId, setDenemeSubjectId] = useState<string>("turkce");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [topicQuery, setTopicQuery] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [blank, setBlank] = useState(0);
  const [recentTopics, setRecentTopics] = useState<RecentTopicRow[]>([]);
  const [list, setList] = useState<ListEntry[]>(() => mapRows(initialEntries));
  const [attempts, setAttempts] = useState<DraftAttempt[]>(() =>
    mapAttemptRows(initialAttempts),
  );
  const [summary, setSummary] = useState(initialSummary);
  const [editing, setEditing] = useState<{
    entry: ListEntry;
    index: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");

  const initialListRef = useRef<ListEntry[]>(mapRows(initialEntries));
  const initialAttemptsRef = useRef<DraftAttempt[]>(
    mapAttemptRows(initialAttempts),
  );
  const initialSummaryRef = useRef(initialSummary);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboRef = useRef<HTMLDivElement | null>(null);
  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const countRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  const subjectList = subjects[examType] ?? [];
  const currentSubject =
    subjectList.find((subject) => subject.subjectId === subjectId) ?? null;
  const topicList: TopicOption[] = currentSubject?.topics ?? [];
  const filteredTopics = useMemo(() => {
    const query = topicQuery.trim().toLocaleLowerCase("tr-TR");
    if (query === "") return topicList;
    return topicList.filter((topic) =>
      topic.name.toLocaleLowerCase("tr-TR").includes(query),
    );
  }, [topicList, topicQuery]);

  const denemeKey =
    denemeBaseType === "brans"
      ? `brans:${denemeSubjectId}`
      : denemeBaseType;
  const denemeBlankValue =
    denemeBaseType === "tyt" ? resolveTytBlank(correct, wrong) : blank;
  const liveDenemeError =
    entryMode === "deneme"
      ? validateDenemeCounts(denemeKey, {
          correct,
          wrong,
          blank: denemeBlankValue,
        })
      : null;

  const total =
    entryMode === "deneme" && denemeBaseType === "tyt"
      ? correct + wrong + denemeBlankValue
      : correct + wrong + blank;
  const net = netScore(correct, wrong);
  const totals = listTotals(list);
  const groups = groupEntriesBySubject(list);
  const serverHadEntries = initialEntries.length > 0;
  const serverHadAttempts = initialAttempts.length > 0;

  const dirty =
    JSON.stringify(list) !== JSON.stringify(initialListRef.current) ||
    JSON.stringify(attempts) !== JSON.stringify(initialAttemptsRef.current) ||
    summary !== initialSummaryRef.current;
  const storageKey = draftKey(studentId, date);

  const canAdd =
    windowOpen &&
    entryMode === "deneme"
      ? attempts.length < MAX_DAY_ATTEMPTS && total > 0 && liveDenemeError === null
      : windowOpen && topicId !== "" && total > 0 &&
        (editing !== null || list.length < MAX_DAY_ENTRIES);
  const canSaveDay =
    windowOpen &&
    !saving &&
    (list.length > 0 ||
      serverHadEntries ||
      attempts.length > 0 ||
      serverHadAttempts);
  const showSaveBar =
    windowOpen &&
    (list.length > 0 ||
      serverHadEntries ||
      attempts.length > 0 ||
      serverHadAttempts ||
      editing !== null);

  useEffect(() => {
    initialListRef.current = mapRows(initialEntries);
    initialAttemptsRef.current = mapAttemptRows(initialAttempts);
    initialSummaryRef.current = initialSummary;
  }, [initialEntries, initialAttempts, initialSummary]);

  useEffect(() => {
    if (dirty) {
      try {
        const raw = serializeDraft({
          v: 1,
          date,
          entries: list,
          attempts,
          summary,
          savedAt: new Date().toISOString(),
        });
        if (raw !== null) {
          window.localStorage.setItem(storageKey, raw);
        }
      } catch {
        // localStorage kapalı olabilir
      }
    } else {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // yok say
      }
    }
  }, [dirty, list, attempts, summary, date, storageKey]);

  const prevOpenRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevOpenRef.current;
    prevOpenRef.current = windowOpen;
    if (windowOpen && prev !== true) {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw !== null) {
          window.localStorage.removeItem(storageKey);
          const draft = parseDraft(raw);
          if (draft !== null && draft.date === date) {
            const { entries, conflicts } = mergeDraftWithServer(
              draft,
              initialListRef.current,
            );
            const serverIds = new Set(
              initialListRef.current.map((entry) => entry.topicId),
            );
            const hasDraftOnly = draft.entries.some(
              (entry) => !serverIds.has(entry.topicId),
            );
            const summaryChanged = draft.summary !== initialSummaryRef.current;
            const hasDraftAttempts =
              draft.attempts !== undefined &&
              JSON.stringify(draft.attempts) !==
                JSON.stringify(initialAttemptsRef.current);
            if (conflicts > 0) {
              toast.info(
                "Taslak geri yüklendi; çakışan satırlar sunucudaki güncel değerlerle güncellendi.",
              );
            } else if (hasDraftOnly || summaryChanged || hasDraftAttempts) {
              toast.info("Kaydedilmemiş taslak geri yüklendi.");
            }
            if (hasDraftOnly || conflicts > 0) {
              setList(entries);
            }
            if (hasDraftAttempts && draft.attempts !== undefined) {
              setAttempts(draft.attempts);
            }
            if (summaryChanged) {
              setSummary(draft.summary);
            }
          }
        }
      } catch {
        // taslak yok veya okunamadı
      }
    } else if (!windowOpen && prev === true) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // yok say
      }
    }
  }, [windowOpen, storageKey, date]);

  useEffect(() => {
    if (!windowOpen || !dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [windowOpen, dirty]);

  useEffect(() => {
    if (!subjectId || !windowOpen) {
      setRecentTopics([]);
      return;
    }
    let cancelled = false;
    setRecentTopics([]);
    void getRecentTopicsForSubject(subjectId)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setRecentTopics(
            result.data.topics.filter(
              (topic) => topic.examType === examType,
            ),
          );
        }
      })
      .catch(() => {
        // sessizce geç
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, windowOpen, examType]);

  useEffect(() => {
    if (!comboOpen) return;
    const handler = (event: MouseEvent) => {
      if (
        comboRef.current &&
        !comboRef.current.contains(event.target as Node)
      ) {
        setComboOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [comboOpen]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  function flashEntry(topic: number) {
    setHighlightId(topic);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      setHighlightId(null);
      setAnnounce("");
    }, 1600);
  }

  function resetTopicAndCounts() {
    setTopicId("");
    setTopicQuery("");
    setCorrect(0);
    setWrong(0);
    setBlank(0);
    setActiveIndex(-1);
    setComboOpen(false);
  }

  function cancelEdit() {
    if (!editing) return;
    const { entry, index } = editing;
    setList((current) => restoreEntry(current, entry, index));
    setEditing(null);
    resetTopicAndCounts();
    setAnnounce("Düzenleme iptal edildi.");
  }

  function changeExamType(next: ExamType) {
    if (editing) cancelEdit();
    setEntryMode("konular");
    setExamType(next);
    setSubjectId("");
    resetTopicAndCounts();
    setRecentTopics([]);
  }

  function changeEntryMode(next: "konular" | "deneme") {
    if (editing) cancelEdit();
    setEntryMode(next);
    resetTopicAndCounts();
    setRecentTopics([]);
  }

  function changeDenemeBaseType(next: "tyt" | "ayt" | "brans") {
    if (editing) cancelEdit();
    setDenemeBaseType(next);
    resetTopicAndCounts();
  }

  function changeSubject(next: string) {
    if (editing) cancelEdit();
    setSubjectId(next);
    resetTopicAndCounts();
  }

  function selectTopic(topic: TopicOption) {
    setTopicId(String(topic.id));
    setTopicQuery(topic.name);
    setComboOpen(false);
    setActiveIndex(-1);
    countRefs[0].current?.focus();
    countRefs[0].current?.select();
  }

  function handleAdd() {
    if (!windowOpen) return;
    if (entryMode === "deneme") {
      handleAddDeneme();
      return;
    }
    if (topicId === "") {
      toast.error("Önce konu seçin.");
      return;
    }
    if (total <= 0) return;
    const topic = topicList.find(
      (item) => String(item.id) === topicId,
    );
    if (!topic || !currentSubject) return;

    const entry: ListEntry = {
      topicId: topic.id,
      subjectId: currentSubject.subjectId,
      subjectName: currentSubject.subjectName,
      examType,
      topicName: topic.name,
      correct,
      wrong,
      blank,
    };

    if (editing !== null) {
      setList((current) => addOrMergeEntry(current, entry).list);
      setEditing(null);
      setAnnounce(`${entry.topicName} listeye güncellendi.`);
    } else {
      const isNew =
        !list.some((item) => item.topicId === entry.topicId);
      if (isNew && list.length >= MAX_DAY_ENTRIES) {
        toast.error(`En fazla ${MAX_DAY_ENTRIES} satır eklenebilir.`);
        return;
      }
      const result = addOrMergeEntry(list, entry);
      setList(result.list);
      if (result.merged) {
        toast.info("Aynı konu birleştirildi.");
        setAnnounce("Aynı konu birleştirildi.");
      } else {
        setAnnounce(`${entry.topicName} listeye eklendi.`);
      }
    }
    flashEntry(entry.topicId);
    resetTopicAndCounts();
    setTimeout(() => topicInputRef.current?.focus(), 0);
  }

  function handleAddDeneme() {
    if (liveDenemeError !== null) {
      toast.error(liveDenemeError);
      return;
    }
    if (attempts.length >= MAX_DAY_ATTEMPTS) {
      toast.error(`En fazla ${MAX_DAY_ATTEMPTS} deneme kaydedilebilir.`);
      return;
    }
    const row: DraftAttempt = {
      denemeKey,
      correct,
      wrong,
      blank: denemeBlankValue,
    };
    setAttempts((current) => [...current, row]);
    setAnnounce(`${getDenemeLabel(denemeKey) ?? "Deneme"} listeye eklendi.`);
    resetTopicAndCounts();
  }

  function removeDenemeRow(index: number) {
    if (!windowOpen) return;
    const target = attempts[index];
    if (!target) return;
    const label = getDenemeLabel(target.denemeKey) ?? "Deneme";
    setAttempts((current) => current.filter((_, i) => i !== index));
    toast(`${label} listeden silindi.`, {
      duration: 5000,
      action: {
        label: "Geri al",
        onClick: () => {
          setAttempts((current) => {
            const next = [...current];
            next.splice(Math.min(index, next.length), 0, target);
            return next;
          });
          setAnnounce(`${label} geri alındı.`);
        },
      },
    });
    setAnnounce(`${label} silindi. Geri alabilirsin.`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAdd();
  }

  function startEdit(entry: ListEntry) {
    if (!windowOpen) return;
    const index = list.findIndex((item) => item.topicId === entry.topicId);
    if (index === -1) return;
    setEditing({ entry, index });
    setList((current) => removeEntry(current, entry.topicId));
    setExamType(entry.examType);
    setSubjectId(entry.subjectId);
    setTopicId(String(entry.topicId));
    setTopicQuery(entry.topicName);
    setCorrect(entry.correct);
    setWrong(entry.wrong);
    setBlank(entry.blank);
    setComboOpen(false);
    setActiveIndex(-1);
    setAnnounce(`${entry.topicName} düzenleniyor.`);
    setTimeout(() => topicInputRef.current?.focus(), 0);
  }

  function removeRow(entry: ListEntry) {
    if (!windowOpen) return;
    const index = list.findIndex((item) => item.topicId === entry.topicId);
    if (index === -1) return;
    setList((current) => removeEntry(current, entry.topicId));
    toast(`${entry.topicName} listeden silindi.`, {
      duration: 5000,
      action: {
        label: "Geri al",
        onClick: () => {
          setList((current) => restoreEntry(current, entry, index));
          setAnnounce(`${entry.topicName} geri alındı.`);
        },
      },
    });
    setAnnounce(`${entry.topicName} silindi. Geri alabilirsin.`);
  }

  async function handleSaveDay() {
    if (saving || !windowOpen) return;
    if (
      list.length === 0 &&
      attempts.length === 0 &&
      (serverHadEntries || serverHadAttempts)
    ) {
      const confirmed = window.confirm(
        "Bugünün tüm girişlerini silmek istiyor musun? Bu işlem geri alınamaz.",
      );
      if (!confirmed) return;
    }
    const validationError = validateEntryList(list);
    if (validationError !== null) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const result = await saveDay({
        entries: list,
        attempts,
        summary,
      });
      if (result.success === true) {
        const serverList = mapRows(result.data.entries);
        const serverAttempts = mapAttemptRows(result.data.attempts);
        initialListRef.current = serverList;
        initialAttemptsRef.current = serverAttempts;
        initialSummaryRef.current = result.data.summary;
        setList(serverList);
        setAttempts(serverAttempts);
        setSummary(result.data.summary);
        setEditing(null);
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // yok say
        }
        setSavedFlash(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSavedFlash(false), 2000);
        toast.success("Gün kaydedildi.");
        setAnnounce("Kaydedildi.");
        onSaved();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Kaydedilirken beklenmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  function handleComboKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setComboOpen(true);
      setActiveIndex((current) =>
        Math.min(current + 1, filteredTopics.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (comboOpen && filteredTopics.length > 0) {
        event.preventDefault();
        const target =
          filteredTopics[activeIndex >= 0 ? activeIndex : 0];
        selectTopic(target);
      }
    } else if (event.key === "Escape") {
      setComboOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleCountKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (index < 2) {
      const next = countRefs[index + 1].current;
      next?.focus();
      next?.select();
    } else {
      handleAdd();
    }
  }

  const activeOptionId =
    comboOpen && activeIndex >= 0 && filteredTopics[activeIndex]
      ? `topic-listbox-option-${filteredTopics[activeIndex].id}`
      : undefined;

  return (
    <div>
      {windowOpen ? (
      <form noValidate onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className={labelClass}>Sınav Türü</p>
          <div
            role="radiogroup"
            aria-label="Sınav türü"
            className="grid grid-cols-4 gap-2 rounded-2xl bg-gray-100 p-1"
          >
            {examTypes.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={entryMode === "konular" && examType === type}
                disabled={!windowOpen}
                onClick={() => changeExamType(type)}
                className={`h-12 rounded-xl text-sm font-semibold transition-colors touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 ${
                  entryMode === "konular" && examType === type
                    ? "bg-white text-indigo-700 shadow"
                    : "text-gray-500"
                }`}
              >
                {type}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={entryMode === "deneme"}
              disabled={!windowOpen}
              onClick={() => changeEntryMode("deneme")}
              className={`h-12 rounded-xl text-sm font-semibold transition-colors touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 ${
                entryMode === "deneme"
                  ? "bg-white text-indigo-700 shadow"
                  : "text-gray-500"
              }`}
            >
              Deneme
            </button>
          </div>

          {entryMode === "konular" ? (
            <>
          <p className={`${labelClass} mt-4`}>Ders</p>
          <div
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="radiogroup"
            aria-label="Ders"
          >
            {subjectList.map((subject) => {
              const active = subject.subjectId === subjectId;
              return (
                <button
                  key={subject.subjectId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!windowOpen}
                  onClick={() => changeSubject(subject.subjectId)}
                  className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 active:bg-gray-100"
                  }`}
                >
                  {subject.subjectName}
                </button>
              );
            })}
          </div>

          <div className="mt-4" ref={comboRef}>
            <label htmlFor="topic-combo-input" className={labelClass}>
              Konu
            </label>
            <div className="relative">
              <input
                id="topic-combo-input"
                ref={topicInputRef}
                type="text"
                role="combobox"
                aria-expanded={comboOpen}
                aria-controls="topic-listbox"
                aria-autocomplete="list"
                aria-activedescendant={activeOptionId}
                autoComplete="off"
                disabled={!windowOpen || subjectId === ""}
                value={topicQuery}
                placeholder={
                  subjectId === ""
                    ? "Önce ders seçin"
                    : "Konu ara…"
                }
                onChange={(event) => {
                  setTopicQuery(event.target.value);
                  setTopicId("");
                  setComboOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => {
                  if (subjectId !== "") setComboOpen(true);
                }}
                onKeyDown={handleComboKeyDown}
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
              {topicId !== "" && windowOpen && (
                <button
                  type="button"
                  aria-label="Konu seçimini temizle"
                  onClick={() => {
                    resetTopicAndCounts();
                    topicInputRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-lg text-gray-400 hover:text-gray-600 touch-manipulation"
                >
                  ×
                </button>
              )}
              {comboOpen &&
                windowOpen &&
                subjectId !== "" &&
                subjectId !== "" && (
                  <ul
                    id="topic-listbox"
                    role="listbox"
                    aria-label="Konu listesi"
                    className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    {filteredTopics.length === 0 ? (
                      <li
                        role="option"
                        aria-selected={false}
                        aria-disabled="true"
                        className="px-3 py-2.5 text-sm text-gray-500"
                      >
                        Eşleşen konu yok.
                      </li>
                    ) : (
                      filteredTopics.map((topic, index) => {
                        const active = index === activeIndex;
                        const selected =
                          String(topic.id) === topicId;
                        return (
                          <li key={topic.id}>
                            <button
                              type="button"
                              role="option"
                              id={`topic-listbox-option-${topic.id}`}
                              aria-selected={selected}
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => selectTopic(topic)}
                              className={`flex min-h-[44px] w-full items-center px-3 text-left text-sm transition ${
                                active
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "text-gray-700"
                              } ${selected ? "font-semibold" : ""}`}
                            >
                              {topic.name}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
            </div>
          </div>

          {recentTopics.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Son kullandığım konular
              </p>
              <div className="flex flex-wrap gap-2">
                {recentTopics.map((topic) => (
                  <button
                    key={topic.topicId}
                    type="button"
                    disabled={!windowOpen}
                    onClick={() => {
                      setTopicId(String(topic.topicId));
                      setTopicQuery(topic.topicName);
                      setComboOpen(false);
                      setActiveIndex(-1);
                      countRefs[0].current?.focus();
                    }}
                    className={`h-11 rounded-full border px-3.5 text-xs font-semibold transition touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 ${
                      String(topic.topicId) === topicId
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-600 active:bg-gray-100"
                    }`}
                  >
                    {topic.topicName}
                  </button>
                ))}
              </div>
            </div>
          )}
            </>
          ) : (
            <div className="mt-4">
              <p className={labelClass}>Deneme Türü</p>
              <div
                role="radiogroup"
                aria-label="Deneme türü"
                className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1"
              >
                {denemeTypeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={denemeBaseType === option.key}
                    disabled={!windowOpen}
                    onClick={() => changeDenemeBaseType(option.key)}
                    className={`h-11 rounded-xl text-[13px] font-semibold transition-colors touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 ${
                      denemeBaseType === option.key
                        ? "bg-white text-indigo-700 shadow"
                        : "text-gray-500"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {denemeBaseType === "brans" ? (
                <>
                  <p className={`${labelClass} mt-3`}>Ders</p>
                  <select
                    aria-label="Branş dersi"
                    disabled={!windowOpen}
                    value={denemeSubjectId}
                    onChange={(event) => setDenemeSubjectId(event.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    {bransSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-semibold text-indigo-700">
                {denemeBaseType === "tyt"
                  ? "TYT: Boş değeri otomatik — 120 − Doğru − Yanlış."
                  : denemeBaseType === "ayt"
                    ? "AYT: Doğru + Yanlış + Boş en fazla 160."
                    : "Branş: Doğru + Yanlış + Boş en fazla 120."}
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-[repeat(3,minmax(0,1fr))_4.5rem] gap-x-2 gap-y-1.5">
            <span className={labelClass}>Doğru</span>
            <span className={labelClass}>Yanlış</span>
            <span className={labelClass}>Boş</span>
            <span className="mb-1.5 block text-center text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
              Canlı
            </span>

            <input
              ref={countRefs[0]}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={300}
              step={1}
              autoComplete="off"
              aria-label="Doğru"
              disabled={!windowOpen}
              value={correct}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setCorrect(clampCount(event.currentTarget.valueAsNumber))
              }
              onKeyDown={(event) => handleCountKeyDown(event, 0)}
              className={countInputClass}
            />
            <input
              ref={countRefs[1]}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={300}
              step={1}
              autoComplete="off"
              aria-label="Yanlış"
              disabled={!windowOpen}
              value={wrong}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setWrong(clampCount(event.currentTarget.valueAsNumber))
              }
              onKeyDown={(event) => handleCountKeyDown(event, 1)}
              className={countInputClass}
            />
            <input
              ref={countRefs[2]}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={300}
              step={1}
              autoComplete="off"
              aria-label="Boş"
              disabled={
                !windowOpen ||
                (entryMode === "deneme" && denemeBaseType === "tyt")
              }
              value={
                entryMode === "deneme" && denemeBaseType === "tyt"
                  ? denemeBlankValue
                  : blank
              }
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setBlank(clampCount(event.currentTarget.valueAsNumber))
              }
              onKeyDown={(event) => handleCountKeyDown(event, 2)}
              className={countInputClass}
            />
            <div className="flex min-h-[44px] flex-col items-center justify-center rounded-xl bg-indigo-50 px-1 text-center leading-tight">
              <span className="text-[10px] font-semibold text-indigo-500">
                {total} soru
              </span>
              <span className="text-sm font-bold text-indigo-700">
                {formatNet(net)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              {editing !== null && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 active:bg-gray-100 touch-manipulation"
                >
                  İptal
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="h-12 flex-1 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
            >
              {editing !== null ? "Listeye Ekle" : "Kayda Ekle"}
            </button>
          </div>
          {editing !== null && (
            <p className="mt-2 text-right text-[11px] font-semibold text-amber-600">
              “{editing.entry.topicName}” düzenleniyor · değerler formda,
              Listeye Ekle ile güncelle.
            </p>
          )}
        </section>
      </form>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {windowOpen || list.length > 0 || attempts.length > 0 ? (
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
            Bugünkü Liste
          </h2>
          <div className="flex shrink-0 gap-1.5">
            {list.length > 0 && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                {list.length} konu
              </span>
            )}
            {attempts.length > 0 && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                {attempts.length} deneme
              </span>
            )}
          </div>
        </div>

        {list.length === 0 && attempts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm font-medium text-gray-500">
            Henüz giriş eklemedin. Ders ve konu seçip Kayda Ekle&apos;ye
            dokun ya da Deneme sekmesinden deneme gir.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section
                key={group.key}
                className="rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
                  <p className="min-w-0 truncate text-xs font-bold text-gray-700">
                    {group.examType} · {group.subjectName}
                  </p>
                  <p className="shrink-0 text-[11px] font-semibold text-gray-500">
                    {group.questions} soru · Net{" "}
                    <span className="text-indigo-700">
                      {formatNet(group.net)}
                    </span>
                  </p>
                </header>
                <ul className="divide-y divide-gray-50 px-2">
                  {group.entries.map((entry) => (
                    <li
                      key={entry.topicId}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition ${
                        highlightId === entry.topicId
                          ? "bg-emerald-50 ring-2 ring-emerald-400"
                          : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {entry.topicName}
                        </p>
                        <p className="mt-0.5 text-xs">
                          <span className="font-bold text-green-600">
                            {entry.correct} D
                          </span>{" "}
                          ·{" "}
                          <span className="font-bold text-red-600">
                            {entry.wrong} Y
                          </span>{" "}
                          ·{" "}
                          <span className="font-bold text-stone-500">
                            {entry.blank} B
                          </span>
                        </p>
                      </div>
                      <p className="shrink-0 text-xs font-bold text-indigo-700">
                        Net {formatNet(entryNet(entry))}
                      </p>
                      {windowOpen ? (
                        <>
                          <button
                            type="button"
                            aria-label={`${entry.topicName} düzenle`}
                            onClick={() => startEdit(entry)}
                            className="h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 touch-manipulation"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            aria-label={`${entry.topicName} sil`}
                            onClick={() => removeRow(entry)}
                            className="h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-red-500 transition hover:bg-red-50 touch-manipulation"
                          >
                            Sil
                          </button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {attempts.length > 0 ? (
              <section className="rounded-2xl border border-violet-200 bg-white shadow-sm">
                <header className="flex items-center justify-between gap-2 border-b border-violet-100 px-4 py-2.5">
                  <p className="min-w-0 truncate text-xs font-bold text-violet-800">
                    Denemeler
                  </p>
                  <p className="shrink-0 text-[11px] font-semibold text-gray-500">
                    {attempts.length} deneme · Net{" "}
                    <span className="text-indigo-700">
                      {formatNet(
                        Math.round(
                          attempts.reduce(
                            (sum, row) => sum + netScore(row.correct, row.wrong),
                            0,
                          ) * 100,
                        ) / 100,
                      )}
                    </span>
                  </p>
                </header>
                <ul className="divide-y divide-gray-50 px-2">
                  {attempts.map((attempt, index) => {
                    const label = getDenemeLabel(attempt.denemeKey) ?? "Deneme";
                    return (
                      <li
                        key={`${attempt.denemeKey}:${index}`}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {label}
                          </p>
                          <p className="mt-0.5 text-xs">
                            <span className="font-bold text-green-600">
                              {attempt.correct} D
                            </span>{" "}
                            ·{" "}
                            <span className="font-bold text-red-600">
                              {attempt.wrong} Y
                            </span>{" "}
                            ·{" "}
                            <span className="font-bold text-stone-500">
                              {attempt.blank} B
                            </span>
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-bold text-indigo-700">
                          Net {formatNet(netScore(attempt.correct, attempt.wrong))}
                        </p>
                        {windowOpen ? (
                          <button
                            type="button"
                            aria-label={`${label} sil`}
                            onClick={() => removeDenemeRow(index)}
                            className="h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-red-500 transition hover:bg-red-50 touch-manipulation"
                          >
                            Sil
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </section>
      ) : null}

      {windowOpen ? (
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
            Günün Özeti
          </h2>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
            Bugün
          </span>
        </div>
        <p className="mt-1.5 text-xs font-medium text-gray-500">
          O gün çözdüğün soruları, izlediğin videoları ve notlarını buraya
          yaz. “Günü Kaydet” ile listeyle birlikte kaydedilir.
        </p>
        <label htmlFor="daily-summary" className="sr-only">
          Günün özeti
        </label>
        <textarea
          id="daily-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          maxLength={2000}
          rows={5}
          disabled={!windowOpen}
          placeholder={
            windowOpen
              ? "Bugün ne yaptın? İzlediğin videolar, dikkatini çeken konular..."
              : "Giriş kapalıyken özet yazılamaz."
          }
          className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:opacity-60"
        />
        <p className="mt-2 text-right text-[11px] font-medium text-gray-400">
          {summary.length}/2000
        </p>
      </section>
      ) : null}

      {showSaveBar ? (
        <>
          <div aria-hidden="true" className="h-24" />
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 bg-indigo-600 md:bottom-0">
            <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-indigo-100">
                  {totals.topics} konu · {totals.questions} soru
                  {attempts.length > 0
                    ? ` · ${attempts.length} deneme`
                    : ""}
                </p>
                <p className="text-sm font-bold text-white">
                  Net{" "}
                  <span className="text-white">
                    {formatNet(totals.net)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveDay}
                disabled={!canSaveDay}
                className="flex h-12 min-w-[8.5rem] shrink-0 touch-manipulation items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-indigo-700 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-700"
                    />
                    Kaydediliyor…
                  </>
                ) : savedFlash ? (
                  "Kaydedildi ✓"
                ) : (
                  "Günü Kaydet"
                )}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
