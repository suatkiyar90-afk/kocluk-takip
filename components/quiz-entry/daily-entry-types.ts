import type { ExamType } from "./weekly-quiz-schema";

export interface TopicOption {
  id: number;
  name: string;
}

export interface SubjectOption {
  subjectId: string;
  subjectName: string;
  topics: TopicOption[];
}

export type SubjectOptions = Record<ExamType, SubjectOption[]>;

export interface DayEntryRow {
  id: number;
  examType: ExamType;
  subjectName: string;
  topicName: string;
  correct: number;
  wrong: number;
  blank: number;
}
