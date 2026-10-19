"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminChangeStudentTeacher,
  adminDeleteStudent,
  adminUpdateStudentField,
  adminUpdateStudentGrade,
  type AdminStudent,
  type AdminTeacher,
} from "@/app/actions/admin-actions";
import { GRADE_LABELS, GRADE_LEVELS, type GradeLevel } from "@/lib/grade-config";
import {
  STUDY_FIELD_LABELS,
  studyFields,
  type StudyField,
} from "@/components/quiz-entry/weekly-quiz-schema";

interface StudentManageListProps {
  teachers: AdminTeacher[];
  students: AdminStudent[];
  onChanged: () => void;
}

function teacherOptionsFor(student: AdminStudent, teachers: AdminTeacher[]) {
  const options = teachers.map((t) => ({ id: t.id, name: t.name }));
  if (student.teacherId && !options.some((t) => t.id === student.teacherId)) {
    options.unshift({
      id: student.teacherId,
      name: student.teacherName ?? "Bilinmeyen öğretmen",
    });
  }
  return options;
}

export function StudentManageList({
  teachers,
  students,
  onChanged,
}: StudentManageListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminStudent | null>(null);
  const [gradeFilter, setGradeFilter] = useState<"all" | GradeLevel>("all");

  const visibleStudents =
    gradeFilter === "all"
      ? students
      : students.filter((s) => s.gradeLevel === gradeFilter);

  async function handleTeacherChange(studentId: string, teacherId: string) {
    setBusyId(studentId);
    try {
      const result = await adminChangeStudentTeacher({
        studentId,
        teacherId: teacherId === "" ? null : teacherId,
      });
      if (result.success === true) {
        toast.success(result.message);
        onChanged();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Bilinmeyen bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleFieldChange(studentId: string, value: string) {
    setBusyId(studentId);
    try {
      const result = await adminUpdateStudentField({
        studentId,
        studyField: value === "" ? null : (value as StudyField),
      });
      if (result.success === true) {
        toast.success(result.message);
        onChanged();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Bilinmeyen bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleGradeChange(studentId: string, value: string) {
    setBusyId(studentId);
    try {
      const result = await adminUpdateStudentGrade({
        studentId,
        gradeLevel: Number(value) as GradeLevel,
      });
      if (result.success === true) {
        toast.success(result.message);
        onChanged();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Bilinmeyen bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) {
      return;
    }
    const target = pendingDelete;
    setBusyId(target.id);
    try {
      const result = await adminDeleteStudent({ studentId: target.id });
      if (result.success === true) {
        toast.success(result.message);
        setPendingDelete(null);
        onChanged();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Bilinmeyen bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">
        Öğrenci İşlemleri
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Her öğrenci için danışman öğretmeni değiştirin veya hesabı kalıcı
        olarak silin.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(
          [
            { id: "all" as const, label: "Tümü" },
            ...GRADE_LEVELS.map((level) => ({
              id: level,
              label: GRADE_LABELS[level],
            })),
          ]
        ).map((option) => {
          const count =
            option.id === "all"
              ? students.length
              : students.filter((s) => s.gradeLevel === option.id).length;
          const active = gradeFilter === option.id;
          return (
            <button
              key={String(option.id)}
              type="button"
              onClick={() => setGradeFilter(option.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition touch-manipulation ${
                active
                  ? "border-indigo-600 bg-indigo-600 text-white shadow"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {students.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {visibleStudents.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {s.name}
                    </p>
                    <span
                      className={
                        s.policyAcknowledged
                          ? "whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
                          : "whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"
                      }
                    >
                      {s.policyAcknowledged
                        ? "KVKK onaylı"
                        : "KVKK onaylamadı"}
                    </span>
                    <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                      {s.studyField
                        ? STUDY_FIELD_LABELS[s.studyField]
                        : "Alan seçilmedi"}
                    </span>
                    <span className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                      {GRADE_LABELS[s.gradeLevel]}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    Kullanıcı adı: {s.studentNumber ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(s)}
                  disabled={busyId !== null}
                  aria-label={`${s.name} adlı öğrenciyi sil`}
                  title="Öğrenciyi Sil"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label
                    htmlFor={`manage-grade-${s.id}`}
                    className="mb-1 block text-[11px] font-bold text-gray-500"
                  >
                    Sınıf Grubu
                  </label>
                  <select
                    id={`manage-grade-${s.id}`}
                    value={s.gradeLevel}
                    disabled={busyId !== null}
                    onChange={(e) => handleGradeChange(s.id, e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
                  >
                    {GRADE_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {GRADE_LABELS[level]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Giriş saati grubun ayarından gelir
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={`manage-advisor-${s.id}`}
                    className="mb-1 block text-[11px] font-bold text-gray-500"
                  >
                    Danışman Öğretmen
                  </label>
                  <select
                    id={`manage-advisor-${s.id}`}
                    value={s.teacherId ?? ""}
                    disabled={busyId !== null}
                    onChange={(e) => handleTeacherChange(s.id, e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
                  >
                    <option value="">Atamayı Kaldır</option>
                    {teacherOptionsFor(s, teachers).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {s.teacherId === null ? (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Danışman atanmamış
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor={`manage-field-${s.id}`}
                    className="mb-1 block text-[11px] font-bold text-gray-500"
                  >
                    Alan
                  </label>
                  <select
                    id={`manage-field-${s.id}`}
                    value={s.studyField ?? ""}
                    disabled={busyId !== null}
                    onChange={(e) => handleFieldChange(s.id, e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
                  >
                    <option value="">Seçilmedi</option>
                    {studyFields.map((field) => (
                      <option key={field} value={field}>
                        {STUDY_FIELD_LABELS[field]}
                      </option>
                    ))}
                  </select>
                  {s.studyField === null ? (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Varsayılan: Sayısal
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
          Önce bir öğrenci ekleyin.
        </p>
      )}

      {students.length > 0 && visibleStudents.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-600">
          Bu sınıf grubunda öğrenci yok.
        </p>
      ) : null}

      <Dialog.Root
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) {
            setPendingDelete(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl focus:outline-none">
            <Dialog.Title className="text-base font-bold text-gray-900">
              Öğrenciyi Sil
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-900">
                {pendingDelete?.name}
              </span>{" "}
              adlı öğrenciyi ve tüm soru/deneme verilerini kalıcı olarak silmek
              istediğinize emin misiniz? Bu işlem geri alınamaz.
            </Dialog.Description>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={busyId !== null}
                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busyId !== null}
                className="h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
              >
                {busyId !== null ? "Siliniyor…" : "Kalıcı Olarak Sil"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
