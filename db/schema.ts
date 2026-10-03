import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const examTypeEnum = pgEnum("exam_type", ["TYT", "AYT", "YDT"]);

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
  (t) => ({
    weeklyEntriesUnique: uniqueIndex("weekly_entries_unique").on(
      t.studentId,
      t.weekStart,
      t.examType,
      t.subjectId,
    ),
    weeklyEntriesStudentWeekIdx: index("weekly_entries_student_week_idx").on(
      t.studentId,
      t.weekStart,
    ),
  }),
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
  studentNumber: text("student_number").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("student"),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    identifier: text("identifier").notNull(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    identifierCreatedIdx: index("login_attempts_identifier_created_idx").on(
      t.identifier,
      t.createdAt,
    ),
  }),
);

export const mockExams = pgTable(
  "mock_exams",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examName: text("exam_name").notNull(),
    examDate: date("exam_date").notNull(),
    turkceNet: real("turkce_net").notNull().default(0),
    tarihNet: real("tarih_net").notNull().default(0),
    cografyaNet: real("cografya_net").notNull().default(0),
    felsefeNet: real("felsefe_net").notNull().default(0),
    dinNet: real("din_net").notNull().default(0),
    matematikNet: real("matematik_net").notNull().default(0),
    geometriNet: real("geometri_net").notNull().default(0),
    fizikNet: real("fizik_net").notNull().default(0),
    kimyaNet: real("kimya_net").notNull().default(0),
    biyolojiNet: real("biyoloji_net").notNull().default(0),
    toplamNet: real("toplam_net").notNull().default(0),
    tytPuani: real("tyt_puani").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    mockExamsUnique: uniqueIndex("mock_exams_unique").on(
      t.studentId,
      t.examName,
      t.examDate,
    ),
    mockExamsStudentIdx: index("mock_exams_student_idx").on(t.studentId),
  }),
);

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
  (t) => ({
    accountsPk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    accountsUserIdIdx: index("accounts_user_id_idx").on(t.userId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({
    sessionsUserIdIdx: index("sessions_user_id_idx").on(t.userId),
  }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({
    verificationTokensPk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
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
  (t) => ({
    teacherStudentsUnique: uniqueIndex("teacher_students_unique").on(
      t.teacherId,
      t.studentId,
    ),
    teacherStudentsStudentIdx: index("teacher_students_student_idx").on(
      t.studentId,
    ),
  }),
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    studentId: uuid("student_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    activityLogsActorCreatedIdx: index("activity_logs_actor_created_idx").on(
      t.actorId,
      t.createdAt,
    ),
    activityLogsCreatedIdx: index("activity_logs_created_idx").on(t.createdAt),
  }),
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
  (t) => ({
    coachingFeedbacksUnique: uniqueIndex("coaching_feedbacks_unique").on(
      t.studentId,
      t.teacherId,
      t.weekStart,
    ),
    coachingFeedbacksStudentWeekIdx: index(
      "coaching_feedbacks_student_week_idx",
    ).on(t.studentId, t.weekStart),
  }),
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
  (t) => ({
    questionImagesStudentWeekIdx: index("question_images_student_week_idx").on(
      t.studentId,
      t.weekStart,
    ),
  }),
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
  (t) => ({
    curriculumTopicsUnique: uniqueIndex("curriculum_topics_unique").on(
      t.examType,
      t.subjectId,
      t.topicName,
    ),
    curriculumTopicsSubjectIdx: index("curriculum_topics_subject_idx").on(
      t.examType,
      t.subjectId,
    ),
  }),
);

export const dailyQuestionEntries = pgTable(
  "daily_question_entries",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    examType: examTypeEnum("exam_type").notNull(),
    subjectId: text("subject_id").notNull(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => curriculumTopics.id, { onDelete: "cascade" }),
    correct: integer("correct").notNull().default(0),
    wrong: integer("wrong").notNull().default(0),
    blank: integer("blank").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    dailyEntriesUnique: uniqueIndex("daily_entries_unique").on(
      t.studentId,
      t.date,
      t.examType,
      t.subjectId,
      t.topicId,
    ),
    dailyEntriesStudentDateIdx: index("daily_entries_student_date_idx").on(
      t.studentId,
      t.date,
    ),
  }),
);

export const studentDailyNotes = pgTable(
  "student_daily_notes",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentDateUnique: uniqueIndex("student_daily_notes_unique").on(
      t.studentId,
      t.date,
    ),
  }),
);

export const weeklyTargets = pgTable(
  "weekly_targets",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStartDate: date("week_start_date").notNull(),
    subjectId: text("subject_id").notNull(),
    targetQuestionCount: integer("target_question_count").notNull().default(0),
    targetTopics: integer("target_topics").array().notNull(),
    scheduleFileUrl: text("schedule_file_url"),
    isScheduleApproved: boolean("is_schedule_approved")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    weeklyTargetsUnique: uniqueIndex("weekly_targets_unique").on(
      t.studentId,
      t.weekStartDate,
      t.subjectId,
    ),
    weeklyTargetsStudentWeekIdx: index("weekly_targets_student_week_idx").on(
      t.studentId,
      t.weekStartDate,
    ),
  }),
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userEndpointUnique: uniqueIndex("push_subscriptions_user_endpoint_unique").on(
      t.userId,
      t.endpoint,
    ),
    userIdIdx: index("push_subscriptions_user_id_idx").on(t.userId),
  }),
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
  (t) => ({
    studentTopicProgressUnique: uniqueIndex("student_topic_progress_unique").on(
      t.studentId,
      t.topicId,
    ),
    studentTopicProgressStudentIdx: index(
      "student_topic_progress_student_idx",
    ).on(t.studentId),
  }),
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
  (t) => ({
    qaThreadsStudentStatusIdx: index("qa_threads_student_status_idx").on(
      t.studentId,
      t.status,
    ),
    qaThreadsStudentIdx: index("qa_threads_student_idx").on(t.studentId),
  }),
);

export const announcementKindEnum = pgEnum("announcement_kind", [
  "info",
  "update",
  "important",
]);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: announcementKindEnum("kind").notNull().default("info"),
    audienceStudent: boolean("audience_student").notNull().default(false),
    audienceTeacher: boolean("audience_teacher").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    announcementsCreatedByIdx: index("announcements_created_by_idx").on(
      t.createdBy,
    ),
    announcementsCreatedAtIdx: index("announcements_created_at_idx").on(
      t.createdAt,
    ),
  }),
);

export const announcementDismissals = pgTable(
  "announcement_dismissals",
  {
    id: serial("id").primaryKey(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    announcementDismissalsUnique: uniqueIndex(
      "announcement_dismissals_unique",
    ).on(t.announcementId, t.userId),
    announcementDismissalsUserIdIdx: index(
      "announcement_dismissals_user_id_idx",
    ).on(t.userId),
  }),
);

export const announcementTargets = pgTable(
  "announcement_targets",
  {
    id: serial("id").primaryKey(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    announcementTargetsUnique: uniqueIndex("announcement_targets_unique").on(
      t.announcementId,
      t.userId,
    ),
    announcementTargetsUserIdIdx: index(
      "announcement_targets_user_id_idx",
    ).on(t.userId),
  }),
);

export type WeeklyQuestionEntry = typeof weeklyQuestionEntries.$inferSelect;
export type NewWeeklyQuestionEntry = typeof weeklyQuestionEntries.$inferInsert;
export type DailyQuestionEntry = typeof dailyQuestionEntries.$inferSelect;
export type NewDailyQuestionEntry = typeof dailyQuestionEntries.$inferInsert;
export type User = typeof users.$inferSelect;
export type MockExam = typeof mockExams.$inferSelect;
export type NewMockExam = typeof mockExams.$inferInsert;
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
export type WeeklyTarget = typeof weeklyTargets.$inferSelect;
export type NewWeeklyTarget = typeof weeklyTargets.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;