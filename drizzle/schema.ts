import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Google OAuth identifier (sub) or legacy Manus openId. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  googleId: varchar("google_id", { length: 64 }).unique(), // Google OAuth sub
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: varchar("avatar_url", { length: 512 }), // Google profile picture
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  currentOrganizationId: int("current_organization_id"), // Active tenant
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Telegram Bot Settings
export const botSettings = mysqlTable("bot_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("setting_key", { length: 128 }).notNull().unique(),
  settingValue: text("setting_value"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BotSetting = typeof botSettings.$inferSelect;
export type InsertBotSetting = typeof botSettings.$inferInsert;

// Group Chats Management
export const groupChats = mysqlTable("group_chats", {
  id: int("id").autoincrement().primaryKey(),
  groupChatId: varchar("group_chat_id", { length: 64 }).notNull().unique(),
  groupName: text("group_name"),
  responsibleUserId: varchar("responsible_user_id", { length: 64 }),
  calendarId: varchar("calendar_id", { length: 255 }),
  isActive: int("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type GroupChat = typeof groupChats.$inferSelect;
export type InsertGroupChat = typeof groupChats.$inferInsert;

// Reminder Settings
export const reminderSettings = mysqlTable("reminder_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("setting_key", { length: 128 }).notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ReminderSetting = typeof reminderSettings.$inferSelect;
export type InsertReminderSetting = typeof reminderSettings.$inferInsert;

// Tasks
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  groupChatId: varchar("group_chat_id", { length: 64 }).notNull(),
  messageId: varchar("message_id", { length: 64 }).notNull(),
  requesterId: varchar("requester_id", { length: 64 }).notNull(),
  assigneeId: varchar("assignee_id", { length: 64 }).notNull(),
  title: text("title").notNull(),
  status: mysqlEnum("status", [
    "pending_acceptance",
    "in_progress",
    "blocked",
    "completed",
    "rejected"
  ]).default("pending_acceptance").notNull(),
  dueAt: timestamp("due_at"),
  blockReason: text("block_reason"),
  artifactUrl: varchar("artifact_url", { length: 2048 }),
  lastNudgeAt: timestamp("last_nudge_at"),
  nudgeLevel: int("nudge_level").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// Meetings
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  groupChatId: varchar("group_chat_id", { length: 64 }).notNull(),
  creatorId: varchar("creator_id", { length: 64 }).notNull(),
  title: text("title").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  calendarEventId: varchar("calendar_event_id", { length: 255 }),
  meetUrl: varchar("meet_url", { length: 2048 }),
  meetingType: mysqlEnum("meeting_type", ["google_meet", "in_person", "other"]).default("google_meet"),
  status: mysqlEnum("status", ["draft", "confirmed"]).default("draft").notNull(),
  reminderSent: int("reminder_sent").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;

// Meeting Attendees
export const meetingAttendees = mysqlTable("meeting_attendees", {
  meetingId: int("meeting_id").notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  email: varchar("email", { length: 320 }),
});

export type MeetingAttendee = typeof meetingAttendees.$inferSelect;
export type InsertMeetingAttendee = typeof meetingAttendees.$inferInsert;

// Drafts (AI Generated Messages)
export const drafts = mysqlTable("drafts", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: varchar("owner_id", { length: 64 }).notNull(),
  sourceType: mysqlEnum("source_type", ["ai_query", "reply_generation"]).notNull(),
  sourceContext: text("source_context"),
  draftText: text("draft_text").notNull(),
  targetGroupChatId: varchar("target_group_chat_id", { length: 64 }),
  status: mysqlEnum("status", ["pending_approval", "editing", "approved", "rejected"]).default("pending_approval").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = typeof drafts.$inferInsert;

// Audit Logs
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("user_id", { length: 64 }),
  action: varchar("action", { length: 64 }).notNull(),
  objectType: varchar("object_type", { length: 64 }),
  objectId: varchar("object_id", { length: 64 }),
  payload: text("payload"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Triggers (Bot Trigger Configuration)
export const triggers = mysqlTable("triggers", {
  id: int("id").autoincrement().primaryKey(),
  triggerKeyword: varchar("trigger_keyword", { length: 64 }).notNull().unique(),
  triggerType: mysqlEnum("trigger_type", ["task", "meeting", "ai_draft", "reply_generation", "custom"]).notNull(),
  description: text("description"),
  enabled: int("enabled").default(1).notNull(),
  actionFlow: text("action_flow"), // JSON string describing the action flow
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Trigger = typeof triggers.$inferSelect;
export type InsertTrigger = typeof triggers.$inferInsert;

// Reminders
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chat_id", { length: 64 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  message: text("message").notNull(),
  remindAt: timestamp("remind_at").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "cancelled"]).default("pending").notNull(),
  originalMessageId: varchar("original_message_id", { length: 64 }),
  // Repeat settings
  repeatType: mysqlEnum("repeat_type", ["none", "daily", "weekly", "monthly"]).default("none").notNull(),
  repeatDays: varchar("repeat_days", { length: 64 }), // For weekly: "0,1,2" (Sun,Mon,Tue), For monthly: "1,15" (1st and 15th)
  repeatEndDate: timestamp("repeat_end_date"), // Optional end date for recurring reminders
  eventName: varchar("event_name", { length: 255 }), // Store event name for recurring reminders
  reminderMinutesBefore: int("reminder_minutes_before").default(15), // Minutes before event to remind
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

// Google OAuth Credentials
export const googleCredentials = mysqlTable("google_credentials", {
  id: int("id").autoincrement().primaryKey(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  isConnected: int("is_connected").default(0).notNull(),
  connectedEmail: varchar("connected_email", { length: 320 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type GoogleCredential = typeof googleCredentials.$inferSelect;
export type InsertGoogleCredential = typeof googleCredentials.$inferInsert;

// Translation Sessions
export const translationSessions = mysqlTable("translation_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chat_id", { length: 64 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  isActive: int("is_active").default(1).notNull(),
  targetLanguage: varchar("target_language", { length: 32 }).notNull(), // The language of the other party (en, zh, ko, tl, tgl-en)
  myLanguage: varchar("my_language", { length: 32 }).default("ja").notNull(), // User's language (default: Japanese)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TranslationSession = typeof translationSessions.$inferSelect;
export type InsertTranslationSession = typeof translationSessions.$inferInsert;

// Translation Settings
export const translationSettings = mysqlTable("translation_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("setting_key", { length: 128 }).notNull().unique(),
  settingValue: text("setting_value"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TranslationSetting = typeof translationSettings.$inferSelect;
export type InsertTranslationSetting = typeof translationSettings.$inferInsert;


// Recurring Tasks (定期タスク)
export const recurringTasks = mysqlTable("recurring_tasks", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chat_id", { length: 64 }).notNull(),
  creatorId: varchar("creator_id", { length: 64 }).notNull(),
  assigneeId: varchar("assignee_id", { length: 64 }).notNull(),
  assigneeMention: varchar("assignee_mention", { length: 128 }), // @username
  taskTitle: text("task_title").notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly"]).notNull(),
  dayOfWeek: int("day_of_week"), // 0-6 for weekly (0=Sunday)
  dayOfMonth: int("day_of_month"), // 1-31 for monthly
  excludeDays: varchar("exclude_days", { length: 32 }), // Comma-separated days to exclude for daily (e.g., "0,6" for Sun,Sat)
  hour: int("hour").notNull(), // 0-23
  minute: int("minute").default(0).notNull(), // 0-59
  isActive: int("is_active").default(1).notNull(),
  lastSentAt: timestamp("last_sent_at"),
  nextSendAt: timestamp("next_send_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type RecurringTask = typeof recurringTasks.$inferSelect;
export type InsertRecurringTask = typeof recurringTasks.$inferInsert;


// Organizations (Tenants)
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(), // URL-friendly identifier
  ownerId: int("owner_id").notNull(), // References users.id
  telegramBotToken: text("telegram_bot_token"), // Each tenant's own bot token
  telegramBotUsername: varchar("telegram_bot_username", { length: 128 }),
  webhookSecret: varchar("webhook_secret", { length: 64 }), // For webhook verification
  subscriptionStatus: mysqlEnum("subscription_status", ["trial", "active", "cancelled", "expired"]).default("trial").notNull(),
  subscriptionPlan: mysqlEnum("subscription_plan", ["free", "starter", "pro", "enterprise"]).default("free").notNull(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// Organization Members
export const organizationMembers = mysqlTable("organization_members", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organization_id").notNull(),
  userId: int("user_id").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "member"]).default("member").notNull(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  joinedAt: timestamp("joined_at"),
});

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

// Payments (for tracking all payments including crypto)
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organization_id").notNull(),
  amount: int("amount").notNull(), // Amount in cents
  currency: varchar("currency", { length: 10 }).default("usd").notNull(),
  paymentMethod: mysqlEnum("payment_method", ["stripe", "crypto"]).notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  cryptoPaymentId: varchar("crypto_payment_id", { length: 255 }), // Internal crypto payment ID
  cryptoTransactionHash: varchar("crypto_transaction_hash", { length: 255 }),
  cryptoCurrency: varchar("crypto_currency", { length: 20 }), // BTC, ETH, USDT, etc.
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// Recurring Task Completions (定期タスク完了履歴)
export const recurringTaskCompletions = mysqlTable("recurring_task_completions", {
  id: int("id").autoincrement().primaryKey(),
  recurringTaskId: int("recurring_task_id").notNull(),
  chatId: varchar("chat_id", { length: 64 }).notNull(),
  completedBy: varchar("completed_by", { length: 64 }).notNull(),
  completedByName: varchar("completed_by_name", { length: 128 }),
  scheduledAt: timestamp("scheduled_at").notNull(), // When the reminder was scheduled
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  note: text("note"), // Optional completion note
});

export type RecurringTaskCompletion = typeof recurringTaskCompletions.$inferSelect;
export type InsertRecurringTaskCompletion = typeof recurringTaskCompletions.$inferInsert;
