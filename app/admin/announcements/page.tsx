"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, Loader2 } from "lucide-react";
import { AnnouncementDialog } from "@/components/announcements/announcement-dialog";
import {
  archiveAnnouncement,
  createAnnouncement,
  getAudienceCounts,
  listAnnouncements,
  listAudienceUsers,
  type AnnouncementListRow,
  type AudienceUserRow,
} from "@/app/actions/announcement-actions";
import {
  ANNOUNCEMENT_KINDS,
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_TITLE,
  type AnnouncementItem,
  type AnnouncementKind,
} from "@/lib/announcements";

const KIND_LABELS: Record<AnnouncementKind, string> = {
  info: "Bilgi",
  update: "Güncelleme",
  important: "Önemli",
};

const KIND_BADGES: Record<AnnouncementKind, string> = {
  info: "border-blue-100 bg-blue-50 text-blue-700",
  update: "border-emerald-100 bg-emerald-50 text-emerald-700",
  important: "border-red-100 bg-red-50 text-red-700",
};

function statusOf(row: AnnouncementListRow): {
  label: string;
  badge: string;
} {
  if (row.archivedAt !== null) {
    return { label: "Arşivli", badge: "bg-gray-100 text-gray-600" };
  }
  if (
    row.expiresAt !== null &&
    Date.parse(row.expiresAt) <= Date.now()
  ) {
    return { label: "Süresi doldu", badge: "bg-amber-50 text-amber-700" };
  }
  return { label: "Aktif", badge: "bg-green-50 text-green-700" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminAnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<AnnouncementKind>("info");
  const [audienceStudent, setAudienceStudent] = useState(true);
  const [audienceTeacher, setAudienceTeacher] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [targetMode, setTargetMode] = useState<"everyone" | "specific">(
    "everyone",
  );
  const [audienceUsers, setAudienceUsers] = useState<AudienceUserRow[] | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [userSearch, setUserSearch] = useState("");

  const [rows, setRows] = useState<AnnouncementListRow[] | null>(null);
  const [counts, setCounts] = useState<{
    students: number;
    teachers: number;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const refresh = useCallback(async () => {
    const [listResult, countsResult] = await Promise.all([
      listAnnouncements(),
      getAudienceCounts(),
    ]);
    if (listResult.success) {
      setRows(listResult.data.announcements);
    } else {
      toast.error(listResult.message);
    }
    if (countsResult.success) {
      setCounts(countsResult.data);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await listAudienceUsers();
      if (cancelled) return;
      if (result.success) {
        setAudienceUsers(result.data.users);
      } else {
        toast.error(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const targetStudents = audienceStudent ? (counts?.students ?? 0) : 0;
  const targetTeachers = audienceTeacher ? (counts?.teachers ?? 0) : 0;

  const searchQuery = userSearch.trim().toLocaleLowerCase("tr");
  const filteredUsers = (audienceUsers ?? []).filter((user) => {
    if (!searchQuery) return true;
    return (
      user.name.toLocaleLowerCase("tr").includes(searchQuery) ||
      (user.studentNumber ?? "").toLowerCase().includes(searchQuery)
    );
  });

  const selectedUsers = (audienceUsers ?? []).filter((user) =>
    selectedIds.has(user.id),
  );
  const selectedStudentCount = selectedUsers.filter(
    (user) => user.role === "student",
  ).length;
  const selectedTeacherCount = selectedUsers.filter(
    (user) => user.role === "teacher",
  ).length;

  const hasTarget =
    targetMode === "everyone"
      ? audienceStudent || audienceTeacher
      : selectedIds.size > 0;

  const canPublish =
    title.trim().length > 0 &&
    title.trim().length <= MAX_ANNOUNCEMENT_TITLE &&
    body.trim().length > 0 &&
    body.trim().length <= MAX_ANNOUNCEMENT_BODY &&
    hasTarget;

  function resetForm() {
    setTitle("");
    setBody("");
    setKind("info");
    setAudienceStudent(true);
    setAudienceTeacher(false);
    setExpiresAt("");
    setTargetMode("everyone");
    setSelectedIds(new Set());
    setUserSearch("");
  }

  function toggleUser(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectFilteredUsers() {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const user of filteredUsers) {
        next.add(user.id);
      }
      return next;
    });
  }

  function clearSelectedUsers() {
    setSelectedIds(new Set());
  }

  function buildAudienceSummary(): string {
    if (targetMode === "everyone") {
      return `${targetStudents} öğrenciye ve ${targetTeachers} öğretmene gösterilecek.`;
    }
    const parts: string[] = [];
    if (selectedStudentCount > 0) parts.push(`${selectedStudentCount} öğrenciye`);
    if (selectedTeacherCount > 0) parts.push(`${selectedTeacherCount} öğretmene`);
    const summary =
      parts.length > 0 ? `${parts.join(" ve ")} gösterilecek.` : "Seçilen kullanıcılara gösterilecek.";
    return summary;
  }

  async function handlePublish() {
    if (publishing) return;
    if (!canPublish) {
      toast.error(
        targetMode === "everyone"
          ? "Başlık, mesaj ve en az bir hedef rol gerekli."
          : "Başlık, mesaj ve en az bir hedef kullanıcı gerekli.",
      );
      return;
    }
    const confirmed = window.confirm(
      `${buildAudienceSummary()} Yayından sonra düzenlenemez, sadece arşivlenebilir.`,
    );
    if (!confirmed) return;

    setPublishing(true);
    try {
      const result = await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        kind,
        audienceStudent:
          targetMode === "everyone" ? audienceStudent : selectedStudentCount > 0,
        audienceTeacher:
          targetMode === "everyone" ? audienceTeacher : selectedTeacherCount > 0,
        targetUserIds: targetMode === "specific" ? [...selectedIds] : [],
        expiresAt: expiresAt
          ? new Date(expiresAt).toISOString()
          : null,
      });
      if (result.success) {
        toast.success(result.message);
        resetForm();
        await refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Duyuru yayınlanırken beklenmeyen bir hata oluştu.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive(row: AnnouncementListRow) {
    if (archivingId !== null) return;
    const confirmed = window.confirm(
      `"${row.title}" duyurusu arşivlensin mi? Arşivlenen duyurular gösterilmez.`,
    );
    if (!confirmed) return;

    setArchivingId(row.id);
    try {
      const result = await archiveAnnouncement(row.id);
      if (result.success) {
        toast.success(result.message);
        await refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Duyuru arşivlenirken beklenmeyen bir hata oluştu.");
    } finally {
      setArchivingId(null);
    }
  }

  const previewItem: AnnouncementItem = {
    id: "preview",
    title: title.trim() || "Duyuru başlığı",
    body: body.trim() || "Duyuru metni burada önizlenir.",
    kind,
    audienceStudent,
    audienceTeacher,
    createdAt: new Date().toISOString(),
    expiresAt: null,
  };

  return (
    <main className="min-h-dvh bg-gray-50 px-4 py-6 pb-16">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Duyurular</h1>
          <p className="mt-1 text-sm text-gray-500">
            Öğrenci ve öğretmenlere açılışta gösterilecek tek seferlik duyurular
            yayınla.
          </p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Yeni duyuru
          </h2>

          <div className="mt-3 space-y-4">
            <div>
              <label
                htmlFor="announcement-title"
                className="text-xs font-bold uppercase tracking-wide text-gray-500"
              >
                Başlık
              </label>
              <input
                id="announcement-title"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value.slice(0, MAX_ANNOUNCEMENT_TITLE))
                }
                maxLength={MAX_ANNOUNCEMENT_TITLE}
                placeholder="Yarın deneme sınavı"
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
              <p className="mt-1 text-right text-[11px] font-medium text-gray-400">
                {title.length}/{MAX_ANNOUNCEMENT_TITLE}
              </p>
            </div>

            <div>
              <label
                htmlFor="announcement-body"
                className="text-xs font-bold uppercase tracking-wide text-gray-500"
              >
                Mesaj
              </label>
              <textarea
                id="announcement-body"
                value={body}
                onChange={(event) =>
                  setBody(event.target.value.slice(0, MAX_ANNOUNCEMENT_BODY))
                }
                maxLength={MAX_ANNOUNCEMENT_BODY}
                rows={5}
                placeholder="Duyuru metni…"
                className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white p-3.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
              <p className="mt-1 text-right text-[11px] font-medium text-gray-400">
                {body.length}/{MAX_ANNOUNCEMENT_BODY}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Tür
              </span>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {ANNOUNCEMENT_KINDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setKind(value)}
                    aria-pressed={kind === value}
                    className={`h-11 touch-manipulation rounded-xl border text-xs font-bold transition ${
                      kind === value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {KIND_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Hedef
              </span>
              <div className="mt-1.5 space-y-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <input
                    type="radio"
                    name="announcement-target-mode"
                    checked={targetMode === "everyone"}
                    onChange={() => setTargetMode("everyone")}
                    className="h-5 w-5 shrink-0 accent-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Herkes
                    {counts
                      ? ` (${counts.students + counts.teachers} kullanıcı)`
                      : ""}
                  </span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <input
                    type="radio"
                    name="announcement-target-mode"
                    checked={targetMode === "specific"}
                    onChange={() => setTargetMode("specific")}
                    className="h-5 w-5 shrink-0 accent-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Belirli kullanıcılar
                    {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                  </span>
                </label>

                {targetMode === "everyone" ? (
                  <div className="space-y-2 pl-1">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={audienceStudent}
                        onChange={(event) =>
                          setAudienceStudent(event.target.checked)
                        }
                        className="h-5 w-5 shrink-0 accent-indigo-600"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        Öğrenciler
                        {counts ? ` (${counts.students})` : ""}
                      </span>
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={audienceTeacher}
                        onChange={(event) =>
                          setAudienceTeacher(event.target.checked)
                        }
                        className="h-5 w-5 shrink-0 accent-indigo-600"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        Öğretmenler
                        {counts ? ` (${counts.teachers})` : ""}
                      </span>
                    </label>
                    {!audienceStudent && !audienceTeacher ? (
                      <p className="text-xs font-semibold text-red-600">
                        En az bir hedef rol seçin.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2 pl-1">
                    <label htmlFor="announcement-user-search" className="sr-only">
                      Kullanıcı ara
                    </label>
                    <input
                      id="announcement-user-search"
                      type="search"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="İsim veya numara ile ara…"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-500">
                        {selectedIds.size} kullanıcı seçildi
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectFilteredUsers}
                          disabled={filteredUsers.length === 0}
                          className="h-11 touch-manipulation rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 active:bg-indigo-100 disabled:opacity-50"
                        >
                          Listeyi seç
                        </button>
                        <button
                          type="button"
                          onClick={clearSelectedUsers}
                          disabled={selectedIds.size === 0}
                          className="h-11 touch-manipulation rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
                        >
                          Temizle
                        </button>
                      </div>
                    </div>
                    {audienceUsers === null ? (
                      <div
                        role="status"
                        aria-label="Kullanıcılar yükleniyor"
                        className="space-y-2"
                      >
                        {[0, 1, 2].map((value) => (
                          <div
                            key={value}
                            aria-hidden="true"
                            className="h-11 animate-pulse rounded-xl bg-gray-200"
                          />
                        ))}
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <p className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-xs font-medium text-gray-500">
                        Eşleşen kullanıcı yok.
                      </p>
                    ) : (
                      <ul
                        aria-label="Kullanıcı listesi"
                        className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5"
                      >
                        {filteredUsers.map((user) => (
                          <li key={user.id}>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(user.id)}
                                onChange={() => toggleUser(user.id)}
                                className="h-5 w-5 shrink-0 accent-indigo-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-gray-800">
                                  {user.name || "İsimsiz kullanıcı"}
                                  {user.studentNumber
                                    ? ` (${user.studentNumber})`
                                    : ""}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  user.role === "teacher"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-indigo-50 text-indigo-700"
                                }`}
                              >
                                {user.role === "teacher" ? "Öğretmen" : "Öğrenci"}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedIds.size > 0 ? (
                      <p className="text-xs font-semibold text-red-600">
                        {selectedStudentCount} öğrenci, {selectedTeacherCount}{" "}
                        öğretmene gösterilecek.
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-red-600">
                        En az bir hedef kullanıcı seçin.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="announcement-expires"
                className="text-xs font-bold uppercase tracking-wide text-gray-500"
              >
                Bitiş tarihi (isteğe bağlı)
              </label>
              <input
                id="announcement-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish || publishing}
              className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                  Yayınlanıyor…
                </>
              ) : (
                "Yayınla"
              )}
            </button>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Önizleme
            </h2>
            <button
              type="button"
              onClick={() => setPreviewKey((value) => value + 1)}
              className="h-11 touch-manipulation rounded-lg px-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50"
            >
              Önizlemeyi göster
            </button>
          </div>
          <p className="mb-2 text-xs text-gray-500">
            Kullanıcıların göreceği pencerenin aynısıdır.
          </p>
          <AnnouncementDialog
            key={previewKey}
            initialAnnouncements={[previewItem]}
            preview
          />
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Duyuru listesi
          </h2>
          {rows === null ? (
            <div className="mt-2 space-y-2" role="status" aria-label="Yükleniyor">
              {[0, 1, 2].map((value) => (
                <div
                  key={value}
                  aria-hidden="true"
                  className="h-16 animate-pulse rounded-xl bg-gray-200"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500">
              Henüz duyuru yok.
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {rows.map((row) => {
                const status = statusOf(row);
                const ratio =
                  row.audienceCount > 0
                    ? Math.min(1, row.dismissCount / row.audienceCount)
                    : 0;
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${KIND_BADGES[row.kind]}`}
                        >
                          {KIND_LABELS[row.kind]}
                        </span>
                        <p
                          className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900"
                          title={row.title}
                        >
                          {row.title}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.badge}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-gray-500">
                      <span>
                        Hedef:{" "}
                        {row.targeted
                          ? `${row.audienceCount} kullanıcı`
                          : ([
                              row.audienceStudent ? "Öğrenciler" : null,
                              row.audienceTeacher ? "Öğretmenler" : null,
                            ]
                                .filter(Boolean)
                                .join(", ") || "—")}
                      </span>
                      <span>{formatDate(row.createdAt)}</span>
                      {row.expiresAt !== null ? (
                        <span>Bitiş: {formatDate(row.expiresAt)}</span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                          <span>Kapatan</span>
                          <span>
                            {row.dismissCount}/{row.audienceCount}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={row.audienceCount}
                          aria-valuenow={row.dismissCount}
                          aria-label="Kapatma oranı"
                          className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"
                        >
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </div>
                      </div>
                      {row.archivedAt === null ? (
                        <button
                          type="button"
                          onClick={() => handleArchive(row)}
                          disabled={archivingId !== null}
                          className="flex h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
                        >
                          {archivingId === row.id ? (
                            <Loader2
                              aria-hidden="true"
                              className="h-3.5 w-3.5 animate-spin"
                            />
                          ) : (
                            <Archive aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          Arşivle
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
