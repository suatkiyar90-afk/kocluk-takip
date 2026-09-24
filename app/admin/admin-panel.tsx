"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  adminAssignTeacher,
  adminCreateUser,
  adminListUsers,
  type AdminStudent,
  type AdminTeacher,
} from "@/app/actions/admin-actions";

type Tab = "teacher" | "student" | "assign";

const TABS: { id: Tab; label: string }[] = [
  { id: "teacher", label: "Öğretmen Ekle" },
  { id: "student", label: "Öğrenci Ekle" },
  { id: "assign", label: "Koç Atama" },
];

const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

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
          Öğretmen ve öğrenci hesaplarını yönetin, koç atamalarını yapın.
        </p>
        <Link
          href="/admin/import-exams"
          className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] touch-manipulation"
        >
          Deneme Sınavı Sonucu Yükle
        </Link>
      </header>

      <nav className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
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

      {tab !== "assign" ? (
        <CreateUserForm
          role={tab}
          onCreated={refreshLists}
        />
      ) : (
        <AssignForm teachers={teachers} students={students} />
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
  const [weeklyTarget, setWeeklyTarget] = useState("50");
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
        weeklyTarget,
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
        Yeni hesaplar e-posta ile giriş yapar.
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
            Kullanıcı Adı (e-posta)
          </label>
          <input
            id={`${role}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="ornk@ornek.com"
            autoComplete="off"
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

            <div>
              <label htmlFor="student-target" className={labelClass}>
                Haftalık Hedef (soru sayısı)
              </label>
              <input
                id="student-target"
                type="number"
                min={0}
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(e.target.value)}
                className={inputClass}
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
      <h2 className="text-sm font-semibold text-gray-900">Koç Atama</h2>
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
                  {t.name} ({t.email ?? "e-posta yok"})
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
                  {s.name} ({s.email ?? "e-posta yok"}) — No: {s.studentNumber ?? "-"} — Haftalık: {s.weeklyTarget}
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