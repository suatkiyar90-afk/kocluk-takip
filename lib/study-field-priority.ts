import type { ExamType, StudyField } from "@/components/quiz-entry/weekly-quiz-schema";
import { OSYM_GUARANTEED_AVG } from "@/lib/osym-frequency";

/**
 * Alan (SAY / EA / SOZ / DIL) bazlı öneri ağırlıklandırması.
 *
 * Akıllı Öneri Havuzu ve "✨ Otomatik Şablon Oluştur" motoru aynı kuralları
 * kullanır. Öğrencinin alanına giren branşlar +25 alan öncelik puanı alır;
 * alan dışı branşlar yalnızca deneme analizinde 1. öncelik / 🔴 Acil Çalış ise
 * tutulur ve düşük ağırlıkla önerilir.
 */
export const FIELD_PRIORITY_BOOST = 25;
export const FIELD_DEPRIORITY_PENALTY = 20;

const FIELD_CORE_SUBJECTS: Record<StudyField, string[]> = {
  SAY: [
    "turkce",
    "matematik",
    "geometri",
    "matematik-ayt",
    "geometri-ayt",
    "tyt-fizik",
    "tyt-kimya",
    "tyt-biyoloji",
    "fizik",
    "kimya",
    "biyoloji",
  ],
  EA: [
    "turkce",
    "matematik",
    "geometri",
    "matematik-ayt",
    "geometri-ayt",
    "edebiyat",
    "tarih1",
    "cografya1",
  ],
  SOZ: [
    "turkce",
    "tyt-tarih",
    "tyt-cografya",
    "tyt-felsefe",
    "tyt-din",
    "edebiyat",
    "tarih1",
    "cografya1",
    "tarih2",
    "cografya2",
    "felsefe",
    "din",
  ],
  DIL: ["turkce", "matematik", "ydt-ingilizce"],
};

/**
 * EA alanında TYT Fen branşları yalnızca "garanti" (son 5 yıl ortalaması
 * eşiğin üstünde) temel konularla sınırlanır.
 */
const EA_LIMITED_TYT_SCIENCE = ["tyt-fizik", "tyt-kimya", "tyt-biyoloji"];

export interface FieldPriorityInput {
  field: StudyField;
  subjectId: string;
  examType: ExamType;
  /** Deneme analizindeki öncelik seviyesi (1 = en acil). */
  priorityLevel?: number | null;
  /** Deneme analizindeki durum etiketi (🔴 Acil Çalış vb.). */
  statusLabel?: string | null;
  /** Konunun ÖSYM son 5 yıl ortalaması. */
  avgRecentQuestions?: number;
}

export interface FieldPriorityResult {
  /** Öneri puanına eklenecek alan ağırlığı (+25 / 0 / -20). */
  boost: number;
  /** Branş, öğrencinin alanının çekirdek branşı mı? */
  isCore: boolean;
  /** false ise konu hiç önerilmez (ör. EA alanında garanti olmayan TYT Fen). */
  allowed: boolean;
  /** Kartta ve gerekçede gösterilecek kısa etiket. */
  label: string;
}

export function isCoreSubjectForField(
  field: StudyField,
  subjectId: string,
): boolean {
  return FIELD_CORE_SUBJECTS[field].includes(subjectId);
}

export function fieldPriorityLabel(field: StudyField): string {
  return `🎯 ${field} Alan Önceliği`;
}

export function isLimitedToGuaranteedTopics(
  field: StudyField,
  subjectId: string,
  examType: ExamType,
): boolean {
  return (
    field === "EA" &&
    examType === "TYT" &&
    EA_LIMITED_TYT_SCIENCE.includes(subjectId)
  );
}

export function resolveFieldPriority(
  input: FieldPriorityInput,
): FieldPriorityResult {
  if (isCoreSubjectForField(input.field, input.subjectId)) {
    return {
      boost: FIELD_PRIORITY_BOOST,
      isCore: true,
      allowed: true,
      label: `${input.field} Alan Önceliği`,
    };
  }

  if (
    isLimitedToGuaranteedTopics(input.field, input.subjectId, input.examType) &&
    (input.avgRecentQuestions ?? 0) < OSYM_GUARANTEED_AVG
  ) {
    return {
      boost: 0,
      isCore: false,
      allowed: false,
      label: `Alan dışı • ${input.field} için temel/garanti konu değil`,
    };
  }

  const urgent =
    input.priorityLevel === 1 || input.statusLabel === "🔴 Acil Çalış";
  if (urgent) {
    return {
      boost: 0,
      isCore: false,
      allowed: true,
      label: `Alan dışı • yüksek kayıp puan`,
    };
  }

  return {
    boost: -FIELD_DEPRIORITY_PENALTY,
    isCore: false,
    allowed: true,
    label: `Alan dışı (${input.field}) • düşük ağırlık`,
  };
}
