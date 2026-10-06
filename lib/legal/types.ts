export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalSummary {
  intro: string;
  bullets: string[];
  minorNote?: string;
}

export interface LegalDocumentModel {
  key: "kvkk_student" | "kvkk_teacher";
  version: string;
  title: string;
  summary: LegalSummary;
  sections: LegalSection[];
}
