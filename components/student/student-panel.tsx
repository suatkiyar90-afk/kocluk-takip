"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Toaster } from "sonner";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  MessageCircle,
  PencilLine,
  Target,
} from "lucide-react";
import { getStudentBadges, type StudentBadges } from "@/app/actions/student-badge-actions";
import { InstallBanner } from "@/components/student/install-banner";
import { QuizPanel } from "@/components/student/panels/quiz-panel";
import { WeeklyTargetsPanel } from "@/components/student/panels/weekly-targets-panel";
import { ExamsPanel } from "@/components/student/panels/exams-panel";
import { CurriculumPanel } from "@/components/student/panels/curriculum-panel";
import { QAPanel } from "@/components/student/panels/qa-panel";
import { StudentStatisticsTab } from "@/components/student/student-statistics";

const TABS = [
  { id: "quiz", label: "Günlük Giriş", shortLabel: "Giriş", icon: PencilLine },
  { id: "targets", label: "Hedeflerim", shortLabel: "Hedef", icon: Target },
  { id: "exams", label: "Denemeler", shortLabel: "Deneme", icon: ClipboardList },
  { id: "curriculum", label: "Müfredat", shortLabel: "Müfredat", icon: BookOpen },
  { id: "qa", label: "Soru Sor", shortLabel: "Soru", icon: MessageCircle },
  { id: "stats", label: "İstatistikler", shortLabel: "İstat.", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SEEN_FEEDBACK_KEY = "student-badge-seen-feedback";
const SEEN_QA_KEY = "student-badge-seen-qa";

function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

function readSeen(key: string): number {
  try {
    const value = Number(window.localStorage.getItem(key) ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeSeen(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // localStorage yoksa rozet yalnızca oturum boyunca kaybolur
  }
}

interface TabBadgeProps {
  show: boolean;
  srText: string;
}

function TabBadge({ show, srText }: TabBadgeProps) {
  if (!show) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
      />
      <span className="sr-only">{srText}</span>
    </>
  );
}

interface StudentPanelProps {
  studentId: string;
}

export function StudentPanel({ studentId }: StudentPanelProps) {
  const [tab, setTab] = useState<TabId>("quiz");
  const [mounted, setMounted] = useState<Set<TabId>>(
    () => new Set<TabId>(["quiz"]),
  );
  const [badges, setBadges] = useState<StudentBadges | null>(null);
  const [seen, setSeen] = useState({ feedback: 0, qa: 0 });
  const topRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const bottomRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(id: TabId, updateHash = true) {
    setTab(id);
    setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    if (
      updateHash &&
      typeof window !== "undefined" &&
      window.location.hash !== `#${id}`
    ) {
      window.location.hash = id;
    }
  }

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      selectTab(isTabId(raw) ? raw : "quiz", false);
    };
    applyHash();
    setSeen({ feedback: readSeen(SEEN_FEEDBACK_KEY), qa: readSeen(SEEN_QA_KEY) });
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshBadges = useCallback(() => {
    void getStudentBadges().then((result) => {
      if (result.success === true) setBadges(result.data);
    });
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges, tab]);

  useEffect(() => {
    if (!badges) return;
    if (
      tab === "targets" &&
      badges.latestFeedbackId !== null &&
      badges.latestFeedbackId > seen.feedback
    ) {
      writeSeen(SEEN_FEEDBACK_KEY, badges.latestFeedbackId);
      setSeen((prev) => ({
        ...prev,
        feedback: badges.latestFeedbackId ?? prev.feedback,
      }));
    }
    if (
      tab === "qa" &&
      badges.latestAnsweredQaId !== null &&
      badges.latestAnsweredQaId > seen.qa
    ) {
      writeSeen(SEEN_QA_KEY, badges.latestAnsweredQaId);
      setSeen((prev) => ({
        ...prev,
        qa: badges.latestAnsweredQaId ?? prev.qa,
      }));
    }
  }, [tab, badges, seen.feedback, seen.qa]);

  const unreadFeedback =
    badges?.latestFeedbackId !== null &&
    badges?.latestFeedbackId !== undefined &&
    badges.latestFeedbackId > seen.feedback;
  const newAnswer =
    badges?.latestAnsweredQaId !== null &&
    badges?.latestAnsweredQaId !== undefined &&
    badges.latestAnsweredQaId > seen.qa;

  function hasBadge(id: TabId): boolean {
    if (id === "targets") return unreadFeedback;
    if (id === "qa") return newAnswer;
    return false;
  }

  function handleTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    refs: { current: Array<HTMLButtonElement | null> },
  ) {
    let nextIndex = -1;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }
    if (nextIndex < 0) return;
    event.preventDefault();
    selectTab(TABS[nextIndex].id);
    refs.current[nextIndex]?.focus();
  }

  function panelProps(id: TabId) {
    return {
      id: `student-panel-${id}`,
      role: "tabpanel" as const,
      "aria-labelledby": `student-tab-${id}`,
      hidden: tab !== id,
    };
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 pt-8 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="mx-auto w-full max-w-md">
        <InstallBanner />
        <nav
          aria-label="Panel sekmeleri"
          role="tablist"
          className="mb-6 hidden w-full flex-nowrap items-center justify-start space-x-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 pb-2 shadow-sm [scrollbar-width:none] [-ms-overflow-style:none] md:flex [&::-webkit-scrollbar]:hidden print:hidden"
        >
          {TABS.map((item, index) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  topRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`student-tab-${item.id}`}
                aria-selected={active}
                aria-controls={`student-panel-${item.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index, topRefs)}
                className={`relative flex-shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                  active
                    ? "bg-indigo-600 text-white shadow"
                    : "text-gray-500 hover:text-indigo-600"
                }`}
              >
                {item.label}
                <TabBadge
                  show={hasBadge(item.id)}
                  srText="okunmamış yeni içerik var"
                />
              </button>
            );
          })}
        </nav>

        <div {...panelProps("quiz")}>
          {mounted.has("quiz") ? <QuizPanel studentId={studentId} /> : null}
        </div>
        <div {...panelProps("targets")}>
          {mounted.has("targets") ? <WeeklyTargetsPanel /> : null}
        </div>
        <div {...panelProps("exams")}>
          {mounted.has("exams") ? <ExamsPanel /> : null}
        </div>
        <div {...panelProps("curriculum")}>
          {mounted.has("curriculum") ? <CurriculumPanel /> : null}
        </div>
        <div {...panelProps("qa")}>
          {mounted.has("qa") ? <QAPanel /> : null}
        </div>
        <div {...panelProps("stats")}>
          {mounted.has("stats") ? (
            <>
              <header className="mb-4">
                <h1 className="text-xl font-bold text-gray-900">İstatistikler</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Ders bazında çözdüğün soru sayıları: son 1 hafta, son 1 ay ve tüm
                  zamanlar.
                </p>
              </header>
              <StudentStatisticsTab studentId={studentId} active={tab === "stats"} />
            </>
          ) : null}
        </div>
      </div>

      <nav
        aria-label="Panel sekmeleri"
        role="tablist"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur md:hidden print:hidden"
      >
        <ul className="grid grid-cols-6">
          {TABS.map((item, index) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  ref={(el) => {
                    bottomRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`student-panel-${item.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTab(item.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index, bottomRefs)}
                  className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-center transition touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                    active
                      ? "text-indigo-600"
                      : "text-gray-500"
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-5 w-5 ${active ? "stroke-2" : "stroke-1"}`}
                  />
                  <span className="w-full truncate text-[10px] font-bold leading-tight">
                    {item.shortLabel}
                  </span>
                  <TabBadge
                    show={hasBadge(item.id)}
                    srText="okunmamış yeni içerik var"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <Toaster position="top-center" richColors />
    </main>
  );
}
