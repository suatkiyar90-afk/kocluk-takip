"use client";

import { useEffect, useState } from "react";
import {
  getUserActivityDetail,
  type UserActivityDetail,
  type UserActivityListRow,
} from "@/app/actions/admin-actions";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimeAgo } from "@/lib/time-ago";

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: UserActivityDetail };

function roleBadgeClass(role: string): string {
  if (role === "admin") {
    return "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600";
  }
  if (role === "teacher") {
    return "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600";
  }
  return "rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600";
}

const ROLE_LABELS: Record<string, string> = {
  student: "Öğrenci",
  teacher: "Öğretmen",
  admin: "Yönetici",
};

function formatFullDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("tr-TR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function UserRow({
  user,
  onSelect,
}: {
  user: UserActivityListRow;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user.id)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50 active:scale-[0.99] touch-manipulation"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-gray-900">
            {user.name}
          </span>
          <span className={roleBadgeClass(user.role)}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-xs text-gray-500">
        {user.lastSeenAt ? formatTimeAgo(user.lastSeenAt) : "Hiç görülmemiş"}
      </span>
    </button>
  );
}

function StudentDetailBody({ detail }: { detail: UserActivityDetail }) {
  const student = detail.student;
  if (!student) return null;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
          Özet Durum
        </h3>
        <p
          className={`mt-1.5 text-sm font-semibold ${
            student.inactivitySummary.startsWith("Aktif")
              ? "text-green-700"
              : student.inactivitySummary.startsWith("Hiç")
                ? "text-gray-500"
                : "text-amber-700"
          }`}
        >
          {student.inactivitySummary}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Son veri girişi:{" "}
          {student.lastEntryDate ? formatDay(student.lastEntryDate) : "—"}
        </p>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
          Günlük Takip — Son 7 Gün
        </h3>
        <ul className="mt-2 space-y-1.5">
          {student.last7Days
            .slice()
            .reverse()
            .map((day) => (
              <li
                key={day.date}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  day.entered
                    ? "bg-indigo-50 text-indigo-800"
                    : "bg-gray-50 text-gray-500"
                }`}
              >
                <span className="font-semibold">{formatDay(day.date)}</span>
                {day.entered ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700 shadow-sm">
                    {day.totalSolved} soru
                  </span>
                ) : (
                  <span className="text-xs font-medium text-gray-400">Boş</span>
                )}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function TeacherDetailBody({ detail }: { detail: UserActivityDetail }) {
  const teacher = detail.teacher;
  if (!teacher) return null;

  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Son İşlemler
      </h3>
      {teacher.recentActivities.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Henüz kayıtlı işlem yok.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {teacher.recentActivities.map((activity) => (
            <li
              key={activity.id}
              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <p className="text-sm text-gray-800">
                {activity.studentName ? (
                  <span className="font-semibold">{activity.studentName} — </span>
                ) : null}
                {activity.actionLabel}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatTimeAgo(activity.createdAt)} ·{" "}
                {formatFullDate(activity.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UserDetail({ userId }: { userId: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    getUserActivityDetail(userId)
      .then((result) => {
        if (cancelled) return;
        if (result.success === true) {
          setState({ status: "ready", detail: result.data.detail });
        } else {
          setState({ status: "error", message: result.message });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "Bilinmeyen bir hata oluştu." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-3 pt-2" aria-busy="true">
        <div className="h-5 w-40 animate-pulse rounded-md bg-gray-200" />
        <div className="h-20 animate-pulse rounded-xl bg-gray-200" />
        <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
        {state.message}
      </p>
    );
  }

  const { detail } = state;

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-indigo-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
          Son Görülme
        </p>
        <p className="mt-0.5 text-sm font-bold text-indigo-900">
          {detail.user.lastSeenAt
            ? formatTimeAgo(detail.user.lastSeenAt)
            : "Hiç görülmemiş"}
        </p>
        <p className="mt-0.5 text-xs text-indigo-700">
          {formatFullDate(detail.user.lastSeenAt)}
        </p>
      </div>

      {detail.student ? <StudentDetailBody detail={detail} /> : null}
      {detail.teacher ? <TeacherDetailBody detail={detail} /> : null}
    </div>
  );
}

export function ActivityView({ users }: { users: UserActivityListRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const students = users.filter((user) => user.role === "student");
  const teachers = users.filter((user) => user.role === "teacher");
  const selected = selectedId
    ? users.find((user) => user.id === selectedId) ?? null
    : null;

  return (
    <div>
      <Tabs defaultValue="students">
        <TabsList className="w-full">
          <TabsTrigger value="students">
            Öğrenciler
            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-600 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700">
              {students.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="teachers">
            Öğretmenler
            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-600 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700">
              {teachers.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <div className="space-y-2">
            {students.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                Kayıtlı öğrenci yok.
              </p>
            ) : (
              students.map((user) => (
                <UserRow key={user.id} user={user} onSelect={setSelectedId} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="teachers">
          <div className="space-y-2">
            {teachers.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                Kayıtlı öğretmen yok.
              </p>
            ) : (
              teachers.map((user) => (
                <UserRow key={user.id} user={user} onSelect={setSelectedId} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent aria-describedby={undefined}>
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {ROLE_LABELS[selected.role] ?? selected.role}
                </SheetDescription>
              </SheetHeader>
              <UserDetail userId={selected.id} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
