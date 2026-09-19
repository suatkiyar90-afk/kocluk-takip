import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const examTypeEnum = pgEnum("exam_type", ["TYT", "AYT"]);

export const weeklyQuestionEntries = pgTable(
  "weekly_question_entries",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id").notNull(),
    weekStart: date("week_start").notNull(),
    examType: examTypeEnum("exam_type").notNull(),
    subjectId: text("subject_id").notNull(),
    correct: integer("correct").notNull().default(0),
    wrong: integer("wrong").notNull().default(0),
    blank: integer("blank").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("weekly_entries_unique").on(
      t.studentId,
      t.weekStart,
      t.examType,
      t.subjectId,
    ),
    index("weekly_entries_student_week_idx").on(t.studentId, t.weekStart),
  ],
);

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "teacher",
  "admin",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().default(""),
  email: text("email"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id").notNull(),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const teacherStudents = pgTable(
  "teacher_students",
  {
    id: serial("id").primaryKey(),
    teacherId: uuid("teacher_id").notNull(),
    studentId: uuid("student_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("teacher_students_unique").on(t.teacherId, t.studentId),
    index("teacher_students_student_idx").on(t.studentId),
  ],
);

export const coachingFeedbacks = pgTable(
  "coaching_feedbacks",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id").notNull(),
    teacherId: uuid("teacher_id").notNull(),
    weekStart: date("week_start").notNull(),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("coaching_feedbacks_unique").on(
      t.studentId,
      t.teacherId,
      t.weekStart,
    ),
    index("coaching_feedbacks_student_week_idx").on(t.studentId, t.weekStart),
  ],
);

export const questionImages = pgTable(
  "question_images",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id").notNull(),
    weekStart: date("week_start").notNull(),
    imageUrl: text("image_url").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("question_images_student_week_idx").on(t.studentId, t.weekStart),
  ],
);

export const curriculumTopics = pgTable(
  "curriculum_topics",
  {
    id: serial("id").primaryKey(),
    examType: examTypeEnum("exam_type").notNull(),
    subjectId: text("subject_id").notNull(),
    subjectName: text("subject_name").notNull(),
    topicName: text("topic_name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("curriculum_topics_unique").on(
      t.examType,
      t.subjectId,
      t.topicName,
    ),
    index("curriculum_topics_subject_idx").on(t.examType, t.subjectId),
  ],
);

export const topicStatusEnum = pgEnum("topic_status", [
  "baslamadi",
  "calisiliyor",
  "bitti",
]);

export const studentTopicProgress = pgTable(
  "student_topic_progress",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id").notNull(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => curriculumTopics.id),
    status: topicStatusEnum("status").notNull().default("baslamadi"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("student_topic_progress_unique").on(t.studentId, t.topicId),
    index("student_topic_progress_student_idx").on(t.studentId),
  ],
);

export const qaThreadStatusEnum = pgEnum("qa_thread_status", [
  "bekliyor",
  "cevaplandı",
]);

export const qaThreads = pgTable(
  "qa_threads",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id").notNull(),
    teacherId: uuid("teacher_id"),
    questionImageUrl: text("question_image_url").notNull(),
    studentNote: text("student_note").notNull().default(""),
    teacherReplyText: text("teacher_reply_text"),
    teacherReplyAudioUrl: text("teacher_reply_audio_url"),
    teacherReplyImageUrl: text("teacher_reply_image_url"),
    status: qaThreadStatusEnum("status").notNull().default("bekliyor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("qa_threads_student_status_idx").on(t.studentId, t.status),
    index("qa_threads_student_idx").on(t.studentId),
  ],
);

export type WeeklyQuestionEntry = typeof weeklyQuestionEntries.$inferSelect;
export type NewWeeklyQuestionEntry = typeof weeklyQuestionEntries.$inferInsert;
export type User = typeof users.$inferSelect;
export type CoachingFeedback = typeof coachingFeedbacks.$inferSelect;
export type NewCoachingFeedback = typeof coachingFeedbacks.$inferInsert;
export type QuestionImage = typeof questionImages.$inferSelect;
export type NewQuestionImage = typeof questionImages.$inferInsert;
export type CurriculumTopic = typeof curriculumTopics.$inferSelect;
export type NewCurriculumTopic = typeof curriculumTopics.$inferInsert;
export type StudentTopicProgress = typeof studentTopicProgress.$inferSelect;
export type NewStudentTopicProgress =
  typeof studentTopicProgress.$inferInsert;
export type QaThread = typeof qaThreads.$inferSelect;
export type NewQaThread = typeof qaThreads.$inferInsert;