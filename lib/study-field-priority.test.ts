import { describe, expect, it } from "vitest";
import {
  FIELD_DEPRIORITY_PENALTY,
  FIELD_PRIORITY_BOOST,
  fieldPriorityLabel,
  isCoreSubjectForField,
  isLimitedToGuaranteedTopics,
  resolveFieldPriority,
} from "./study-field-priority";

describe("study-field-priority", () => {
  it("alan cekirdek branslarina +25 oncelik verir", () => {
    expect(
      resolveFieldPriority({
        field: "SAY",
        subjectId: "matematik-ayt",
        examType: "AYT",
      }).boost,
    ).toBe(FIELD_PRIORITY_BOOST);
    expect(
      resolveFieldPriority({
        field: "SAY",
        subjectId: "fizik",
        examType: "AYT",
      }).isCore,
    ).toBe(true);
    expect(
      isCoreSubjectForField("DIL", "ydt-ingilizce"),
    ).toBe(true);
    expect(isCoreSubjectForField("EA", "edebiyat")).toBe(true);
    expect(isCoreSubjectForField("SOZ", "cografya2")).toBe(true);
  });

  it("alan disi branslari dusuk agirliga duserir", () => {
    const result = resolveFieldPriority({
      field: "SAY",
      subjectId: "tyt-tarih",
      examType: "TYT",
    });
    expect(result.isCore).toBe(false);
    expect(result.allowed).toBe(true);
    expect(result.boost).toBe(-FIELD_DEPRIORITY_PENALTY);
    expect(result.label).toContain("düşük ağırlık");
  });

  it("alan disi brans 1. oncelik veya acil ise tutulur ama dusurulmez", () => {
    const priority = resolveFieldPriority({
      field: "SAY",
      subjectId: "tyt-cografya",
      examType: "TYT",
      priorityLevel: 1,
    });
    expect(priority.allowed).toBe(true);
    expect(priority.boost).toBe(0);

    const urgent = resolveFieldPriority({
      field: "DIL",
      subjectId: "tyt-fizik",
      examType: "TYT",
      statusLabel: "🔴 Acil Çalış",
    });
    expect(urgent.allowed).toBe(true);
    expect(urgent.boost).toBe(0);
  });

  it("EA alaninda TYT fen yalnizca garanti konularda onerilir", () => {
    expect(isLimitedToGuaranteedTopics("EA", "tyt-fizik", "TYT")).toBe(true);
    expect(isLimitedToGuaranteedTopics("SAY", "tyt-fizik", "TYT")).toBe(false);
    expect(isLimitedToGuaranteedTopics("EA", "matematik-ayt", "AYT")).toBe(
      false,
    );

    const weak = resolveFieldPriority({
      field: "EA",
      subjectId: "tyt-kimya",
      examType: "TYT",
      avgRecentQuestions: 0.2,
    });
    expect(weak.allowed).toBe(false);

    const guaranteed = resolveFieldPriority({
      field: "EA",
      subjectId: "tyt-kimya",
      examType: "TYT",
      avgRecentQuestions: 1.6,
    });
    expect(guaranteed.allowed).toBe(true);
  });

  it("etiket alan kodunu icerir", () => {
    expect(fieldPriorityLabel("SOZ")).toBe("🎯 SOZ Alan Önceliği");
    expect(
      resolveFieldPriority({
        field: "SOZ",
        subjectId: "edebiyat",
        examType: "AYT",
      }).label,
    ).toBe("SOZ Alan Önceliği");
  });
});
