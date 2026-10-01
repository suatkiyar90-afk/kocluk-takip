"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  adminAssignTeacher,
  adminCreateUser,
  adminListUsers,
  adminResetUserPassword,
  adminUpdateTeacherUsername,
  type AdminStudent,
  type AdminTeacher,
} from "@/app/actions/admin-actions";

type Tab = "teacher" | "student" | "assign" | "reset";

const TABS: { id: Tab; label: string }[] = [
  { id: "teacher", label: "Öğretmen Ekle" },
  { id: "student", label: "Öğrenci Ekle" },
  { id: "assign", label: "Danışman Öğretmen Atama" },
  { id: "reset", label: "Şifre Sıfırla" },
];

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

function displayUsername(email: string | null): string {
  if (!email) return "—";
  const suffix = "@kocluk.local";
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}

interface AdminPanelProps {
  initialTeachers: AdminTeacher[];
  initialStudents: AdminStudent[];
}

export function AdminPanel({
  initialTeachers,
  initialStudents,
}: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>("teacher");
  const [teachers, setTeachers] =
    useState<AdminTeacher[]>(initialTeachers);
  const [students, setStudents] = useState<AdminStudent[]>(initialStudents);

  async function refreshLists() {
    const result = await adminListUsers();
    if (result.success === true) {
      setTeachers(result.data.teachers);
      setStudents(result.data.students);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Yönetici Paneli</h1>
        <p className="mt-1 text-sm text-gray-500">
          Öğretmen ve öğrenci hesaplarını yönetin, Danışman Öğretmen atamalarını yapın.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/admin/bulk-students"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] touch-manipulation"
          >
            Toplu Öğrenci Ekle
          </Link>
          <Link
            href="/admin/import-exams"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 text-sm font-bold text-indigo-700 transition active:scale-[0.98] touch-manipulation"
          >
            Deneme Sınavı Sonucu Yükle
          </Link>
          <Link
            href="/admin/activities"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold text-emerald-700 transition active:scale-[0.98] touch-manipulation"
          >
            Sistem Aktiviteleri
          </Link>
          <Link
            href="/admin/settings"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition active:scale-[0.98] touch-manipulation"
          >
            Ayarlar
          </Link>
        </div>
      </header>

      <nav className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm sm:grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-2 py-2.5 text-center text-xs font-bold transition touch-manipulation ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-500 hover:text-indigo-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "reset" ? (
        <ResetPasswordList teachers={teachers} students={students} />
      ) : tab === "assign" ? (
        <AssignForm teachers={teachers} students={students} />
      ) : (
        <>
          <CreateUserForm role={tab} onCreated={refreshLists} />
          {tab === "teacher" ? (
            <TeacherUsernameEditor
              teachers={teachers}
              onUpdated={refreshLists}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function CreateUserForm({
  role,
  onCreated,
}: {
  role: "teacher" | "student";
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await adminCreateUser({
        name,
        email,
        password,
        role,
        studentNumber,
      });
      if (result.success === true) {
        toast.success(result.message);
        setName("");
        setEmail("");
        setPassword("");
        setStudentNumber("");
        onCreated();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  const title = role === "teacher" ? "Öğretmen Ekle" : "Öğrenci Ekle";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        {role === "teacher"
          ? "Öğretmenler belirlediğiniz kullanıcı adıyla giriş yapar."
          : "Öğrenciler öğrenci numarasıyla giriş yapar."}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor={`${role}-name`} className={labelClass}>
            Ad Soyad
          </label>
          <input
            id={`${role}-name`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Örn. Ayşe Yılmaz"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor={`${role}-email`} className={labelClass}>
            {role === "teacher" ? "Kullanıcı Adı" : "E-posta"}
          </label>
          <input
            id={`${role}-email`}
            type={role === "teacher" ? "text" : "email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder={
              role === "teacher" ? "örn. ayse.yilmaz" : "ornek@ornek.com"
            }
            autoComplete="off"
            autoCapitalize={role === "teacher" ? "none" : undefined}
            autoCorrect={role === "teacher" ? "off" : undefined}
            spellCheck={role === "teacher" ? false : undefined}
          />
        </div>

        <div>
          <label htmlFor={`${role}-password`} className={labelClass}>
            Şifre
          </label>
          <input
            id={`${role}-password`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="En az 6 karakter"
            autoComplete="new-password"
          />
        </div>

        {role === "student" ? (
          <>
            <div>
              <label htmlFor="student-number" className={labelClass}>
                Öğrenci Numarası
              </label>
              <input
                id="student-number"
                type="text"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className={inputClass}
                placeholder="Örn. 1234 (deneme sınavı eşleştirmesinde kullanılır)"
                autoComplete="off"
              />
            </div>
          </>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !name || !email || !password}
          className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
        >
          {loading ? "Kaydediliyor…" : `${title}`}
        </button>
      </div>
    </form>
  );
}

function TeacherUsernameEditor({
  teachers,
  onUpdated,
}: {
  teachers: AdminTeacher[];
  onUpdated: () => void;
}) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelectTeacher(nextId: string) {
    setTeacherId(nextId);
    const teacher = teachers.find((t) => t.id === nextId);
    const current = teacher ? displayUsername(teacher.email) : "";
    setUsername(current === "—" ? "" : current);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await adminUpdateTeacherUsername({
        userId: teacherId,
        username,
      });
      if (result.success === true) {
        toast.success(result.message);
        onUpdated();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  if (teachers.length === 0) {
    return null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-gray-900">
        Kullanıcı Adını Düzenle
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Öğretmenin kullanıcı adını güncelleyin; şifresi değişmez.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="edit-teacher" className={labelClass}>
            Öğretmen
          </label>
          <select
            id="edit-teacher"
            value={teacherId}
            onChange={(e) => handleSelectTeacher(e.target.value)}
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (Kullanıcı adı: {displayUsername(t.email)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="edit-username" className={labelClass}>
            Yeni Kullanıcı Adı
          </label>
          <input
            id="edit-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
            placeholder="örn. ayse.yilmaz"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !teacherId || !username.trim()}
          className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
        >
          {loading ? "Kaydediliyor…" : "Kullanıcı Adını Güncelle"}
        </button>
      </div>
    </form>
  );
}

function AssignForm({
  teachers,
  students,
}: {
  teachers: AdminTeacher[];
  students: AdminStudent[];
}) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await adminAssignTeacher({ teacherId, studentId });
      if (result.success === true) {
        toast.success(result.message);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  const selectBase =
    "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-gray-900">Danışman Öğretmen Atama</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Kayıtlı bir öğrenciyi kayıtlı bir öğretmene bağlayın.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="assign-teacher" className={labelClass}>
            Öğretmen
          </label>
          {teachers.length > 0 ? (
            <select
              id="assign-teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={selectBase}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Kullanıcı adı: {displayUsername(t.email)})
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
              Önce bir öğretmen ekleyin.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="assign-student" className={labelClass}>
            Öğrenci
          </label>
          {students.length > 0 ? (
            <select
              id="assign-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={selectBase}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Kullanıcı adı: {s.studentNumber ?? "—"})
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
              Önce bir öğrenci ekleyin.
            </p>
          )}
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            loading || !teacherId || !studentId || teachers.length === 0 || students.length === 0
          }
          className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
        >
          {loading ? "Atanıyor…" : "Öğrenciyi At"}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordList({
  teachers,
  students,
}: {
  teachers: AdminTeacher[];
  students: AdminStudent[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{
    name: string;
    password: string;
  } | null>(null);

  const entries = [
    ...teachers.map((t) => ({
      id: t.id,
      name: t.name,
      subtitle: `Kullanıcı adı: ${displayUsername(t.email)}`,
      roleLabel: "Öğretmen",
    })),
    ...students.map((s) => ({
      id: s.id,
      name: s.name,
      subtitle: `Kullanıcı adı: ${s.studentNumber ?? "—"}`,
      roleLabel: "Öğrenci",
    })),
  ];

  async function handleReset(userId: string) {
    setBusyId(userId);
    setError(null);
    setResetResult(null);
    try {
      const result = await adminResetUserPassword({ userId });
      if (result.success === true) {
        setResetResult({
          name: result.data.name,
          password: result.data.password,
        });
        toast.success(result.message);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Bilinmeyen bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      toast.success("Şifre panoya kopyalandı.");
    } catch {
      toast.error("Kopyalanamadı. Şifreyi elle kopyalayın.");
    }
  }

  return (
    <div className="space-y-4">
      {resetResult ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            {resetResult.name} için geçici şifre
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl border border-amber-200 bg-white px-3 py-2 font-mono text-sm font-bold text-gray-900 select-all">
              {resetResult.password}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="h-10 shrink-0 rounded-xl bg-amber-600 px-3.5 text-xs font-bold text-white transition active:scale-[0.98] touch-manipulation"
            >
              Kopyala
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-amber-800">
            Bu şifre yalnızca bir kez gösterilir. Kullanıcı ilk girişte
            şifresini değiştirmeye yönlendirilir.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Şifre Sıfırla</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Seçili kullanıcı için rastgele şifre üretilir ve yalnızca bir kez
          gösterilir.
        </p>

        {entries.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {entries.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {u.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {u.subtitle} · {u.roleLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleReset(u.id)}
                  disabled={busyId !== null}
                  className="h-10 shrink-0 rounded-xl border border-red-200 bg-white px-3.5 text-xs font-bold text-red-600 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  {busyId === u.id ? "Sıfırlanıyor…" : "Şifreyi Sıfırla"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
            Önce kullanıcı ekleyin.
          </p>
        )}
      </div>
    </div>
  );
}
