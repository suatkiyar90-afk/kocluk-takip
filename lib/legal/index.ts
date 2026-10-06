import { KVKK_STUDENT } from "./kvkk-student";
import { KVKK_TEACHER } from "./kvkk-teacher";
import type { LegalDocumentModel } from "./types";

export const LEGAL_DOCUMENTS = {
  kvkk_student: KVKK_STUDENT,
  kvkk_teacher: KVKK_TEACHER,
} as const satisfies Record<string, LegalDocumentModel>;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

export function getLegalDocument(key: LegalDocumentKey): LegalDocumentModel {
  return LEGAL_DOCUMENTS[key];
}

export function documentForRole(
  role: string | null | undefined,
): LegalDocumentModel | null {
  if (role === "student") return LEGAL_DOCUMENTS.kvkk_student;
  if (role === "teacher") return LEGAL_DOCUMENTS.kvkk_teacher;
  return null;
}

export type { LegalDocumentModel } from "./types";
