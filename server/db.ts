import { eq, and, lte, gte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  triggers,
  InsertTrigger,
  botSettings,
  groupChats,
  InsertGroupChat,
  reminderSettings,
  tasks,
  InsertTask,
  meetings,
  InsertMeeting,
  drafts,
  InsertDraft,
  auditLogs,
  InsertAuditLog,
  reminders,
  InsertReminder,
  googleCredentials,
  InsertGoogleCredential,
  translationSessions,
  InsertTranslationSession,
  translationSettings,
  InsertTranslationSetting,
  recurringTasks,
  InsertRecurringTask,
  recurringTaskCompletions,
  InsertRecurringTaskCompletion,
  organizations,
  InsertOrganization,
  organizationMembers,
  InsertOrganizationMember,
  payments,
  InsertPayment
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByGoogleId(googleId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserFromGoogle(data: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use googleId as openId for compatibility
  const openId = `google_${data.googleId}`;
  
  await db.insert(users).values({
    openId,
    googleId: data.googleId,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatarUrl,
    loginMethod: "google",
    lastSignedIn: new Date(),
  });

  return await getUserByGoogleId(data.googleId);
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserCurrentOrganization(userId: number, organizationId: number | null) {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ currentOrganizationId: organizationId })
    .where(eq(users.id, userId));
}

// Bot Settings helpers
export async function getBotSetting(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(botSettings).where(eq(botSettings.settingKey, key)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllBotSettings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(botSettings);
}

export async function upsertBotSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(botSettings)
    .values({ settingKey: key, settingValue: value, description })
    .onDuplicateKeyUpdate({ set: { settingValue: value, description, updatedAt: new Date() } });
}

// Group Chats helpers
export async function getAllGroupChats() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(groupChats).where(eq(groupChats.isActive, 1));
}

export async function getGroupChat(groupChatId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groupChats).where(eq(groupChats.groupChatId, groupChatId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertGroupChat(data: InsertGroupChat) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(groupChats)
    .values(data)
    .onDuplicateKeyUpdate({ 
      set: { 
        groupName: data.groupName,
        responsibleUserId: data.responsibleUserId,
        calendarId: data.calendarId,
        isActive: data.isActive ?? 1,
        updatedAt: new Date()
      } 
    });
}

export async function deleteGroupChat(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(groupChats).set({ isActive: 0 }).where(eq(groupChats.id, id));
}

// Reminder Settings helpers
export async function getReminderSetting(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reminderSettings).where(eq(reminderSettings.settingKey, key)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllReminderSettings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(reminderSettings);
}

export async function upsertReminderSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(reminderSettings)
    .values({ settingKey: key, settingValue: value, description })
    .onDuplicateKeyUpdate({ set: { settingValue: value, description, updatedAt: new Date() } });
}

// Tasks helpers
export async function getAllTasks(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks).limit(limit).orderBy(tasks.createdAt);
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTaskByMessageId(messageId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.messageId, messageId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return result;
}

export async function updateTask(id: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

// Meetings helpers
export async function getAllMeetings(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(meetings).limit(limit).orderBy(meetings.startAt);
}

export async function getMeetingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMeeting(data: InsertMeeting) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(meetings).values(data);
  return result;
}

export async function updateMeeting(id: number, data: Partial<InsertMeeting>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(meetings).set(data).where(eq(meetings.id, id));
}

// Drafts helpers
export async function getAllDrafts(ownerId?: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  if (ownerId) {
    return await db.select().from(drafts).where(eq(drafts.ownerId, ownerId)).limit(limit).orderBy(drafts.createdAt);
  }
  return await db.select().from(drafts).limit(limit).orderBy(drafts.createdAt);
}

export async function getDraftById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createDraft(data: InsertDraft): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(drafts).values(data);
  // Return the inserted ID (MySQL returns insertId in result)
  return Number(result[0].insertId);
}

export async function updateDraft(id: number, data: Partial<InsertDraft>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(drafts).set(data).where(eq(drafts.id, id));
}

// Audit Logs helpers
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(auditLogs).values(data);
}

export async function getAllAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auditLogs).limit(limit).orderBy(auditLogs.timestamp);
}

// Trigger management
export async function getAllTriggers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(triggers);
}

export async function getTriggerByKeyword(keyword: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(triggers).where(eq(triggers.triggerKeyword, keyword)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createTrigger(trigger: InsertTrigger) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(triggers).values(trigger);
  return result[0].insertId;
}

export async function updateTrigger(id: number, updates: Partial<InsertTrigger>) {
  const db = await getDb();
  if (!db) return;
  await db.update(triggers).set(updates).where(eq(triggers.id, id));
}

export async function deleteTrigger(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(triggers).where(eq(triggers.id, id));
}

// Reminders helpers
export async function createReminder(data: InsertReminder): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reminders).values(data);
  return Number(result[0].insertId);
}

export async function getPendingReminders(): Promise<typeof reminders.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db.select().from(reminders)
    .where(and(
      eq(reminders.status, "pending"),
      lte(reminders.remindAt, now)
    ));
}

export async function getAllReminders(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(reminders).limit(limit).orderBy(desc(reminders.createdAt));
}

export async function getReminderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateReminder(id: number, data: Partial<InsertReminder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reminders).set(data).where(eq(reminders.id, id));
}

export async function cancelReminder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reminders).set({ status: "cancelled" }).where(eq(reminders.id, id));
}

// Google Credentials helpers
export async function getGoogleCredentials() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(googleCredentials).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function saveGoogleCredentials(data: InsertGoogleCredential) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if credentials already exist
  const existing = await getGoogleCredentials();
  if (existing) {
    // Update existing
    await db.update(googleCredentials).set(data).where(eq(googleCredentials.id, existing.id));
    return existing.id;
  } else {
    // Insert new
    const result = await db.insert(googleCredentials).values(data);
    return Number(result[0].insertId);
  }
}

export async function updateGoogleTokens(accessToken: string, refreshToken: string | null, tokenExpiry: Date, connectedEmail?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getGoogleCredentials();
  if (!existing) throw new Error("No Google credentials found");
  
  const updateData: Partial<InsertGoogleCredential> = {
    accessToken,
    tokenExpiry,
    isConnected: 1,
  };
  
  if (refreshToken) {
    updateData.refreshToken = refreshToken;
  }
  
  if (connectedEmail) {
    updateData.connectedEmail = connectedEmail;
  }
  
  await db.update(googleCredentials).set(updateData).where(eq(googleCredentials.id, existing.id));
}

export async function disconnectGoogle() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getGoogleCredentials();
  if (!existing) return;
  
  await db.update(googleCredentials).set({
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    isConnected: 0,
    connectedEmail: null,
  }).where(eq(googleCredentials.id, existing.id));
}

// Translation Session helpers
export async function getActiveTranslationSession(chatId: string, userId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(translationSessions)
    .where(and(
      eq(translationSessions.chatId, chatId),
      eq(translationSessions.userId, userId),
      eq(translationSessions.isActive, 1)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// Get any active translation session in a chat (for translating other users' messages)
export async function getAnyActiveTranslationSessionInChat(chatId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(translationSessions)
    .where(and(
      eq(translationSessions.chatId, chatId),
      eq(translationSessions.isActive, 1)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createTranslationSession(data: InsertTranslationSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(translationSessions).values(data);
  return Number(result[0].insertId);
}

export async function endTranslationSession(chatId: string, userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(translationSessions)
    .set({ isActive: 0 })
    .where(and(
      eq(translationSessions.chatId, chatId),
      eq(translationSessions.userId, userId),
      eq(translationSessions.isActive, 1)
    ));
}

export async function getAllTranslationSessions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(translationSessions).orderBy(translationSessions.createdAt);
}

export async function updateTranslationSessionLanguage(chatId: string, userId: string, targetLanguage: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(translationSessions)
    .set({ targetLanguage })
    .where(and(
      eq(translationSessions.chatId, chatId),
      eq(translationSessions.userId, userId),
      eq(translationSessions.isActive, 1)
    ));
}

// Translation Settings helpers
export async function getTranslationSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(translationSettings)
    .where(eq(translationSettings.settingKey, key))
    .limit(1);
  return result.length > 0 ? result[0].settingValue : null;
}

export async function setTranslationSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(translationSettings)
    .where(eq(translationSettings.settingKey, key))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(translationSettings)
      .set({ settingValue: value, description })
      .where(eq(translationSettings.settingKey, key));
  } else {
    await db.insert(translationSettings).values({
      settingKey: key,
      settingValue: value,
      description
    });
  }
}


// Recurring Tasks helpers
export async function createRecurringTask(data: InsertRecurringTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recurringTasks).values(data);
  return Number(result[0].insertId);
}

export async function getAllRecurringTasks(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(recurringTasks)
    .where(eq(recurringTasks.isActive, 1))
    .limit(limit)
    .orderBy(desc(recurringTasks.createdAt));
}

export async function getRecurringTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(recurringTasks).where(eq(recurringTasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getActiveRecurringTasks() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(recurringTasks)
    .where(eq(recurringTasks.isActive, 1));
}

export async function updateRecurringTask(id: number, data: Partial<InsertRecurringTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recurringTasks).set(data).where(eq(recurringTasks.id, id));
}

export async function deleteRecurringTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recurringTasks).set({ isActive: 0 }).where(eq(recurringTasks.id, id));
}

export async function getDueRecurringTasks() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db.select().from(recurringTasks)
    .where(and(
      eq(recurringTasks.isActive, 1),
      lte(recurringTasks.nextSendAt, now)
    ));
}


// Recurring Task Completions
export async function createRecurringTaskCompletion(data: InsertRecurringTaskCompletion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recurringTaskCompletions).values(data);
  return result[0].insertId;
}

export async function getCompletionsByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(recurringTaskCompletions)
    .where(eq(recurringTaskCompletions.recurringTaskId, taskId))
    .orderBy(desc(recurringTaskCompletions.completedAt));
}

export async function getRecentCompletions(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    completion: recurringTaskCompletions,
    task: recurringTasks
  })
    .from(recurringTaskCompletions)
    .leftJoin(recurringTasks, eq(recurringTaskCompletions.recurringTaskId, recurringTasks.id))
    .orderBy(desc(recurringTaskCompletions.completedAt))
    .limit(limit);
}

export async function getCompletionsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    completion: recurringTaskCompletions,
    task: recurringTasks
  })
    .from(recurringTaskCompletions)
    .leftJoin(recurringTasks, eq(recurringTaskCompletions.recurringTaskId, recurringTasks.id))
    .where(and(
      gte(recurringTaskCompletions.completedAt, startDate),
      lte(recurringTaskCompletions.completedAt, endDate)
    ))
    .orderBy(desc(recurringTaskCompletions.completedAt));
}

// ==================== Organization (Tenant) Functions ====================

export async function createOrganization(data: InsertOrganization) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(organizations).values(data);
  const insertId = result[0].insertId;
  
  // Add owner as a member
  await db.insert(organizationMembers).values({
    organizationId: insertId,
    userId: data.ownerId,
    role: "owner",
    joinedAt: new Date(),
  });

  return await getOrganizationById(insertId);
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrganizationBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrganizationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    organization: organizations,
    member: organizationMembers
  })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));
  
  return result.map(r => ({ ...r.organization, memberRole: r.member.role }));
}

export async function updateOrganization(id: number, data: Partial<InsertOrganization>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, id));
  
  return await getOrganizationById(id);
}

export async function updateOrganizationBotToken(id: number, token: string, username?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(organizations)
    .set({ 
      telegramBotToken: token,
      telegramBotUsername: username,
      updatedAt: new Date()
    })
    .where(eq(organizations.id, id));
}

export async function updateOrganizationSubscription(
  id: number,
  status: "trial" | "active" | "cancelled" | "expired",
  plan: "free" | "starter" | "pro" | "enterprise",
  expiresAt?: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(organizations)
    .set({ 
      subscriptionStatus: status,
      subscriptionPlan: plan,
      subscriptionExpiresAt: expiresAt,
      updatedAt: new Date()
    })
    .where(eq(organizations.id, id));
}

export async function deleteOrganization(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete members first
  await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, id));
  // Delete organization
  await db.delete(organizations).where(eq(organizations.id, id));
}

// ==================== Organization Member Functions ====================

export async function addOrganizationMember(data: InsertOrganizationMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(organizationMembers).values(data);
}

export async function getOrganizationMembers(organizationId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    member: organizationMembers,
    user: users
  })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId));
  
  return result.map(r => ({
    ...r.member,
    user: r.user
  }));
}

export async function updateOrganizationMemberRole(
  organizationId: number,
  userId: number,
  role: "owner" | "admin" | "member"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(organizationMembers)
    .set({ role })
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId)
    ));
}

export async function removeOrganizationMember(organizationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId)
    ));
}

export async function isOrganizationMember(organizationId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId)
    ))
    .limit(1);
  
  return result.length > 0;
}

export async function getOrganizationMemberRole(organizationId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0].role : null;
}

// ==================== Payment Functions ====================

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(payments).values(data);
  return result[0].insertId;
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPaymentsByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(payments)
    .where(eq(payments.organizationId, organizationId))
    .orderBy(desc(payments.createdAt));
}

export async function updatePaymentStatus(
  id: number,
  status: "pending" | "completed" | "failed" | "refunded"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(payments)
    .set({ paymentStatus: status })
    .where(eq(payments.id, id));
}

// Get organization by Telegram bot token (for webhook routing)
export async function getOrganizationByBotToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select()
    .from(organizations)
    .where(eq(organizations.telegramBotToken, token))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Generate unique slug for organization
export async function generateUniqueSlug(baseName: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Convert to URL-friendly slug
  let slug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  // Check if slug exists
  let counter = 0;
  let finalSlug = slug;
  
  while (true) {
    const existing = await db.select()
      .from(organizations)
      .where(eq(organizations.slug, finalSlug))
      .limit(1);
    
    if (existing.length === 0) {
      return finalSlug;
    }
    
    counter++;
    finalSlug = `${slug}-${counter}`;
  }
}
