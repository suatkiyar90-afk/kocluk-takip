import { describe, expect, it } from "vitest";
import { documentForRole, LEGAL_DOCUMENTS } from "./index";
import type { LegalDocumentModel } from "./types";

function expectValidDocument(doc: LegalDocumentModel) {
  expect(doc.key).toMatch(/^kvkk_(student|teacher)$/);
  expect(doc.version.trim().length).toBeGreaterThan(0);
  expect(doc.title.trim().length).toBeGreaterThan(0);

  expect(doc.summary.intro.trim().length).toBeGreaterThan(0);
  expect(doc.summary.bullets.length).toBeGreaterThan(0);
  for (const bullet of doc.summary.bullets) {
    expect(bullet.trim().length).toBeGreaterThan(0);
  }
  if (doc.summary.minorNote !== undefined && doc.summary.minorNote !== "") {
    expect(doc.summary.minorNote.trim().length).toBeGreaterThan(0);
  }

  expect(doc.sections.length).toBeGreaterThan(0);
  for (const section of doc.sections) {
    expect(section.heading.trim().length).toBeGreaterThan(0);
    expect(section.blocks.length).toBeGreaterThan(0);
    for (const block of section.blocks) {
      if (block.type === "p") {
        expect(block.text.trim().length).toBeGreaterThan(0);
      } else {
        expect(block.items.length).toBeGreaterThan(0);
        for (const item of block.items) {
          expect(item.trim().length).toBeGreaterThan(0);
        }
      }
    }
  }
}

describe("LEGAL_DOCUMENTS", () => {
  it("öğrenci ve öğretmen belgeleri geçerli yapıdadır", () => {
    expect(Object.keys(LEGAL_DOCUMENTS).sort()).toEqual([
      "kvkk_student",
      "kvkk_teacher",
    ]);
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      expectValidDocument(doc);
    }
  });

  it("iki belgenin sürümü aynıdır (tek seferde güncellenir)", () => {
    expect(LEGAL_DOCUMENTS.kvkk_student.version).toBe(
      LEGAL_DOCUMENTS.kvkk_teacher.version,
    );
  });

  it("öğretmen belgesinde ek not tanımlı değildir", () => {
    expect(LEGAL_DOCUMENTS.kvkk_teacher.summary.minorNote).toBeUndefined();
  });
});

describe("documentForRole", () => {
  it("öğrenci ve öğretmen rollerine doğru belgeyi verir", () => {
    expect(documentForRole("student")).toBe(LEGAL_DOCUMENTS.kvkk_student);
    expect(documentForRole("teacher")).toBe(LEGAL_DOCUMENTS.kvkk_teacher);
  });

  it("admin ve bilinmeyen roller için null döner", () => {
    expect(documentForRole("admin")).toBeNull();
    expect(documentForRole(null)).toBeNull();
    expect(documentForRole(undefined)).toBeNull();
  });
});
