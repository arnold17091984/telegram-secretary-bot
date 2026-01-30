import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { ENV } from "./_core/env";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    // Development login - only works when ALLOW_DEV_LOGIN is enabled
    devLogin: publicProcedure
      .input(z.object({ name: z.string().optional() }).optional())
      .mutation(async ({ ctx, input }) => {
        // Only allow when explicitly enabled via ALLOW_DEV_LOGIN=true
        if (ENV.isProduction && !ENV.allowDevLogin) {
          throw new Error("Dev login is not available in production");
        }

        const openId = ENV.ownerOpenId || "dev-user-001";
        const name = input?.name || "Dev User";

        // Create or update dev user
        await db.upsertUser({
          openId,
          name,
          email: "dev@localhost",
          loginMethod: "dev",
          lastSignedIn: new Date(),
          role: "admin",
        });

        // Create session token
        const sessionToken = await sdk.createSessionToken(openId, { name });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true, openId, name };
      }),
  }),

  // Webhook Management
  webhook: router({
    getInfo: protectedProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${input.token}/getWebhookInfo`);
          const data = await response.json();
          if (data.ok) {
            return {
              success: true,
              url: data.result.url || null,
              hasCustomCertificate: data.result.has_custom_certificate,
              pendingUpdateCount: data.result.pending_update_count,
              lastErrorDate: data.result.last_error_date,
              lastErrorMessage: data.result.last_error_message,
            };
          } else {
            return { success: false, message: `エラー: ${data.description}` };
          }
        } catch (error) {
          return { success: false, message: `接続失敗: ${error instanceof Error ? error.message : '不明なエラー'}` };
        }
      }),
    setWebhook: protectedProcedure
      .input(z.object({ token: z.string(), webhookUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${input.token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: input.webhookUrl }),
          });
          const data = await response.json();
          if (data.ok) {
            const { createAuditLog } = await import('./db');
            await createAuditLog({
              userId: ctx.user.openId,
              action: 'webhook_registered',
              objectType: 'webhook',
              objectId: 'telegram',
              payload: JSON.stringify({ webhookUrl: input.webhookUrl }),
            });
            return { success: true, message: 'Webhook URLを登録しました' };
          } else {
            return { success: false, message: `エラー: ${data.description}` };
          }
        } catch (error) {
          return { success: false, message: `登録失敗: ${error instanceof Error ? error.message : '不明なエラー'}` };
        }
      }),
    deleteWebhook: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${input.token}/deleteWebhook`);
          const data = await response.json();
          if (data.ok) {
            const { createAuditLog } = await import('./db');
            await createAuditLog({
              userId: ctx.user.openId,
              action: 'webhook_deleted',
              objectType: 'webhook',
              objectId: 'telegram',
              payload: JSON.stringify({}),
            });
            return { success: true, message: 'Webhook URLを削除しました' };
          } else {
            return { success: false, message: `エラー: ${data.description}` };
          }
        } catch (error) {
          return { success: false, message: `削除失敗: ${error instanceof Error ? error.message : '不明なエラー'}` };
        }
      }),
  }),

  // Test API Connections
  testConnections: router({
    telegram: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${input.token}/getMe`);
          const data = await response.json();
          if (data.ok) {
            return { success: true, message: `Bot接続成功: @${data.result.username}` };
          } else {
            return { success: false, message: `エラー: ${data.description}` };
          }
        } catch (error) {
          return { success: false, message: `接続失敗: ${error instanceof Error ? error.message : '不明なエラー'}` };
        }
      }),
    openai: protectedProcedure
      .input(z.object({ apiKey: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${input.apiKey}`,
            },
          });
          if (response.ok) {
            return { success: true, message: 'OpenAI API接続成功' };
          } else {
            const data = await response.json();
            return { success: false, message: `エラー: ${data.error?.message || 'APIキーが無効です'}` };
          }
        } catch (error) {
          return { success: false, message: `接続失敗: ${error instanceof Error ? error.message : '不明なエラー'}` };
        }
      }),
    googleCalendar: protectedProcedure
      .input(z.object({ credentials: z.string() }))
      .mutation(async ({ input }) => {
        try {
          JSON.parse(input.credentials);
          return { success: true, message: 'Google Calendar認証情報の形式は正しいです' };
        } catch (error) {
          return { success: false, message: 'JSON形式が無効です' };
        }
      }),
    gemini: protectedProcedure
      .input(z.object({ apiKey: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const { testGeminiConnection } = await import('./integrations/gemini');
          return await testGeminiConnection(input.apiKey);
        } catch (error) {
          return { success: false, message: `接続失敗: ${error instanceof Error ? error.message : '不明なエラー'}` };
        }
      }),
  }),

  // Bot Settings Router
  botSettings: router({
    getAll: protectedProcedure.query(async () => {
      const { getAllBotSettings } = await import("./db");
      return await getAllBotSettings();
    }),
    get: protectedProcedure.input(z.object({ key: z.string() })).query(async ({ input }) => {
      const { getBotSetting } = await import("./db");
      return await getBotSetting(input.key);
    }),
    upsert: protectedProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { upsertBotSetting, createAuditLog } = await import("./db");
        await upsertBotSetting(input.key, input.value, input.description);
        await createAuditLog({
          userId: ctx.user.openId,
          action: "bot_setting_updated",
          objectType: "bot_setting",
          objectId: input.key,
          payload: JSON.stringify({ key: input.key }),
        });
        return { success: true };
      }),
  }),

  // Group Chats Router
  groupChats: router({
    getAll: protectedProcedure.query(async () => {
      const { getAllGroupChats } = await import("./db");
      return await getAllGroupChats();
    }),
    get: protectedProcedure.input(z.object({ groupChatId: z.string() })).query(async ({ input }) => {
      const { getGroupChat } = await import("./db");
      return await getGroupChat(input.groupChatId);
    }),
    upsert: protectedProcedure
      .input(
        z.object({
          groupChatId: z.string(),
          groupName: z.string().optional(),
          responsibleUserId: z.string().optional(),
          calendarId: z.string().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { upsertGroupChat, createAuditLog } = await import("./db");
        await upsertGroupChat(input);
        await createAuditLog({
          userId: ctx.user.openId,
          action: "group_chat_updated",
          objectType: "group_chat",
          objectId: input.groupChatId,
          payload: JSON.stringify(input),
        });
        return { success: true };
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const { deleteGroupChat, createAuditLog } = await import("./db");
      await deleteGroupChat(input.id);
      await createAuditLog({
        userId: ctx.user.openId,
        action: "group_chat_deleted",
        objectType: "group_chat",
        objectId: input.id.toString(),
      });
      return { success: true };
    }),
  }),

  // Reminder Settings Router
  reminderSettings: router({
    getAll: protectedProcedure.query(async () => {
      const { getAllReminderSettings } = await import("./db");
      return await getAllReminderSettings();
    }),
    get: protectedProcedure.input(z.object({ key: z.string() })).query(async ({ input }) => {
      const { getReminderSetting } = await import("./db");
      return await getReminderSetting(input.key);
    }),
    upsert: protectedProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { upsertReminderSetting, createAuditLog } = await import("./db");
        await upsertReminderSetting(input.key, input.value, input.description);
        await createAuditLog({
          userId: ctx.user.openId,
          action: "reminder_setting_updated",
          objectType: "reminder_setting",
          objectId: input.key,
          payload: JSON.stringify({ key: input.key }),
        });
        return { success: true };
      }),
  }),

  // Tasks Router
  tasks: router({
    getAll: protectedProcedure.query(async () => {
      const { getAllTasks } = await import("./db");
      return await getAllTasks();
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getTaskById } = await import("./db");
      return await getTaskById(input.id);
    }),
  }),

  // Meetings Router
  meetings: router({
    getAll: protectedProcedure.query(async () => {
      const { getAllMeetings } = await import("./db");
      return await getAllMeetings();
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getMeetingById } = await import("./db");
      return await getMeetingById(input.id);
    }),
  }),

  // Drafts Router
  drafts: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      const { getAllDrafts } = await import("./db");
      return await getAllDrafts(ctx.user.openId);
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getDraftById } = await import("./db");
      return await getDraftById(input.id);
    }),
  }),

  // Audit Logs Router
  auditLogs: router({
    getAll: protectedProcedure.query(async () => {
      const { getAllAuditLogs } = await import("./db");
      return await getAllAuditLogs();
    }),
  }),

  // Triggers Router
  triggers: router({
    list: protectedProcedure.query(async () => {
      const { getAllTriggers } = await import("./db");
      return await getAllTriggers();
    }),
    create: protectedProcedure
      .input(
        z.object({
          triggerKeyword: z.string(),
          triggerType: z.enum(["task", "meeting", "ai_draft", "reply_generation", "custom"]),
          description: z.string().optional(),
          enabled: z.number().optional(),
          actionFlow: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { createTrigger, createAuditLog } = await import("./db");
        const id = await createTrigger(input);
        await createAuditLog({
          action: "trigger_created",
          objectType: "trigger",
          objectId: id.toString(),
        });
        return { success: true, id };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          triggerKeyword: z.string().optional(),
          description: z.string().optional(),
          enabled: z.number().optional(),
          actionFlow: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { updateTrigger, createAuditLog } = await import("./db");
        const { id, ...updates } = input;
        await updateTrigger(id, updates);
        await createAuditLog({
          action: "trigger_updated",
          objectType: "trigger",
          objectId: id.toString(),
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteTrigger, createAuditLog } = await import("./db");
        await deleteTrigger(input.id);
        await createAuditLog({
          action: "trigger_deleted",
          objectType: "trigger",
          objectId: input.id.toString(),
        });
        return { success: true };
      }),
  }),

  // Reminders Management
  reminders: router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["all", "pending", "sent", "cancelled"]).optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getAllReminders } = await import("./db");
        const allReminders = await getAllReminders(input?.limit || 100);
        if (input?.status && input.status !== "all") {
          return allReminders.filter(r => r.status === input.status);
        }
        return allReminders;
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getReminderById } = await import("./db");
        return await getReminderById(input.id);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        message: z.string().optional(),
        remindAt: z.date().optional(),
        status: z.enum(["pending", "sent", "cancelled"]).optional(),
        repeatType: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
        repeatDays: z.string().nullable().optional(),
        repeatEndDate: z.date().nullable().optional(),
        eventName: z.string().optional(),
        reminderMinutesBefore: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateReminder, createAuditLog } = await import("./db");
        const { id, ...updates } = input;
        await updateReminder(id, updates);
        await createAuditLog({
          userId: ctx.user.openId,
          action: "reminder_updated",
          objectType: "reminder",
          objectId: id.toString(),
          payload: JSON.stringify(updates),
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { cancelReminder, createAuditLog } = await import("./db");
        await cancelReminder(input.id);
        await createAuditLog({
          userId: ctx.user.openId,
          action: "reminder_cancelled",
          objectType: "reminder",
          objectId: input.id.toString(),
        });
        return { success: true };
      }),
  }),

  // Google Calendar Integration
  google: router({
    getCredentials: protectedProcedure.query(async () => {
      const { getGoogleCredentials } = await import("./db");
      const creds = await getGoogleCredentials();
      if (!creds) return null;
      // Don't expose secrets to frontend
      return {
        id: creds.id,
        hasClientId: !!creds.clientId,
        hasClientSecret: !!creds.clientSecret,
        isConnected: creds.isConnected === 1,
        connectedEmail: creds.connectedEmail,
      };
    }),
    // List calendar events
    listEvents: protectedProcedure
      .input(z.object({
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        maxResults: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { listCalendarEvents, isGoogleCalendarConnected } = await import("./integrations/googleCalendar");
        
        const isConnected = await isGoogleCalendarConnected();
        if (!isConnected) {
          return { success: false, error: "Googleカレンダーが接続されていません", events: [] };
        }
        
        const result = await listCalendarEvents({
          timeMin: input?.timeMin ? new Date(input.timeMin) : undefined,
          timeMax: input?.timeMax ? new Date(input.timeMax) : undefined,
          maxResults: input?.maxResults,
        });
        
        return result;
      }),
    // Update calendar event
    updateEvent: protectedProcedure
      .input(z.object({
        eventId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateCalendarEvent, isGoogleCalendarConnected } = await import("./integrations/googleCalendar");
        const { createAuditLog } = await import("./db");
        
        const isConnected = await isGoogleCalendarConnected();
        if (!isConnected) {
          return { success: false, error: "Googleカレンダーが接続されていません" };
        }
        
        const updates: any = {};
        if (input.title) updates.title = input.title;
        if (input.description !== undefined) updates.description = input.description;
        if (input.startTime) updates.startTime = new Date(input.startTime);
        if (input.endTime) updates.endTime = new Date(input.endTime);
        
        const result = await updateCalendarEvent(input.eventId, updates);
        
        if (result.success) {
          await createAuditLog({
            userId: ctx.user.openId,
            action: "calendar_event_updated",
            objectType: "calendar_event",
            objectId: input.eventId,
            payload: JSON.stringify(updates),
          });
        }
        
        return result;
      }),
    // Delete calendar event
    deleteEvent: protectedProcedure
      .input(z.object({ eventId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { deleteCalendarEvent, isGoogleCalendarConnected } = await import("./integrations/googleCalendar");
        const { createAuditLog } = await import("./db");
        
        const isConnected = await isGoogleCalendarConnected();
        if (!isConnected) {
          return { success: false, error: "Googleカレンダーが接続されていません" };
        }
        
        const result = await deleteCalendarEvent(input.eventId);
        
        if (result.success) {
          await createAuditLog({
            userId: ctx.user.openId,
            action: "calendar_event_deleted",
            objectType: "calendar_event",
            objectId: input.eventId,
          });
        }
        
        return result;
      }),
    saveCredentials: protectedProcedure
      .input(z.object({
        clientId: z.string(),
        clientSecret: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { saveGoogleCredentials, createAuditLog } = await import("./db");
        await saveGoogleCredentials({
          clientId: input.clientId,
          clientSecret: input.clientSecret,
        });
        await createAuditLog({
          userId: ctx.user.openId,
          action: "google_credentials_saved",
          objectType: "google_credentials",
          objectId: "1",
        });
        return { success: true };
      }),
    getAuthUrl: protectedProcedure.query(async ({ ctx }) => {
      const { getGoogleCredentials } = await import("./db");
      const creds = await getGoogleCredentials();
      if (!creds || !creds.clientId || !creds.clientSecret) {
        return { success: false, message: "Google認証情報が設定されていません" };
      }
      
      const redirectUri = `${ctx.req.protocol}://${ctx.req.get('host')}/api/oauth/google/callback`;
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${creds.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
      
      return { success: true, authUrl };
    }),
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      const { disconnectGoogle, createAuditLog } = await import("./db");
      await disconnectGoogle();
      await createAuditLog({
        userId: ctx.user.openId,
        action: "google_disconnected",
        objectType: "google_credentials",
        objectId: "1",
      });
      return { success: true };
    }),
  }),
  
  // Recurring Tasks
  recurringTasks: router({
    list: protectedProcedure.query(async () => {
      const { getAllRecurringTasks } = await import("./db");
      const tasks = await getAllRecurringTasks();
      return tasks;
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getRecurringTaskById } = await import("./db");
        return await getRecurringTaskById(input.id);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        taskTitle: z.string().optional(),
        frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
        dayOfWeek: z.number().nullable().optional(),
        dayOfMonth: z.number().nullable().optional(),
        excludeDays: z.string().nullable().optional(),
        hour: z.number().optional(),
        minute: z.number().optional(),
        assigneeMention: z.string().nullable().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateRecurringTask, createAuditLog } = await import("./db");
        const { id, ...updates } = input;
        await updateRecurringTask(id, updates);
        await createAuditLog({
          userId: ctx.user.openId,
          action: "recurring_task_updated",
          objectType: "recurring_task",
          objectId: id.toString(),
          payload: JSON.stringify(updates),
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { deleteRecurringTask, createAuditLog } = await import("./db");
        await deleteRecurringTask(input.id);
        await createAuditLog({
          userId: ctx.user.openId,
          action: "recurring_task_deleted",
          objectType: "recurring_task",
          objectId: input.id.toString(),
        });
        return { success: true };
      }),
    // Completion history
    completions: protectedProcedure
      .input(z.object({ taskId: z.number().optional() }))
      .query(async ({ input }) => {
        const { getCompletionsByTaskId, getRecentCompletions } = await import("./db");
        if (input.taskId) {
          return await getCompletionsByTaskId(input.taskId);
        }
        return await getRecentCompletions(100);
      }),
    completionsByDateRange: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        const { getCompletionsByDateRange } = await import("./db");
        return await getCompletionsByDateRange(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
  }),

  // Translation Settings
  translation: router({
    getSettings: protectedProcedure.query(async () => {
      const { getTranslationSetting } = await import("./db");
      const startKeywords = await getTranslationSetting('start_keywords') || '翻訳開始,翻訳スタート,通訳開始,通訳スタート';
      const endKeywords = await getTranslationSetting('end_keywords') || '翻訳終了,翻訳ストップ,翻訳停止,通訳終了,通訳ストップ,通訳停止';
      const autoTranslateOnMention = await getTranslationSetting('auto_translate_on_mention') || 'true';
      
      return {
        startKeywords,
        endKeywords,
        autoTranslateOnMention: autoTranslateOnMention === 'true',
      };
    }),
    saveSettings: protectedProcedure
      .input(z.object({
        startKeywords: z.string(),
        endKeywords: z.string(),
        autoTranslateOnMention: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { setTranslationSetting, createAuditLog } = await import("./db");
        await setTranslationSetting('start_keywords', input.startKeywords, '翻訳開始キーワード');
        await setTranslationSetting('end_keywords', input.endKeywords, '翻訳終了キーワード');
        await setTranslationSetting('auto_translate_on_mention', input.autoTranslateOnMention.toString(), '@メンション時の自動翻訳');
        
        await createAuditLog({
          userId: ctx.user.openId,
          action: "translation_settings_updated",
          objectType: "translation_settings",
          objectId: "1",
          payload: JSON.stringify(input),
        });
        
        return { success: true };
      }),
    getSessions: protectedProcedure.query(async () => {
      const { getAllTranslationSessions } = await import("./db");
      const sessions = await getAllTranslationSessions();
      return sessions;
    }),
  }),

  // Organization (Tenant) Management
  organizations: router({
    // Get current user's organizations
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getOrganizationsByUserId } = await import("./db");
      return await getOrganizationsByUserId(ctx.user.id);
    }),

    // Get single organization by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getOrganizationById, isOrganizationMember } = await import("./db");
        
        // Check if user is a member
        const isMember = await isOrganizationMember(input.id, ctx.user.id);
        if (!isMember) {
          throw new Error("You are not a member of this organization");
        }
        
        return await getOrganizationById(input.id);
      }),

    // Create new organization
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input, ctx }) => {
        const { createOrganization, generateUniqueSlug, createAuditLog } = await import("./db");
        
        const slug = await generateUniqueSlug(input.name);
        const org = await createOrganization({
          name: input.name,
          slug,
          ownerId: ctx.user.id,
        });
        
        await createAuditLog({
          userId: ctx.user.openId,
          action: "organization_created",
          objectType: "organization",
          objectId: org?.id.toString() || "unknown",
          payload: JSON.stringify({ name: input.name, slug }),
        });
        
        return org;
      }),

    // Update organization
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateOrganization, getOrganizationMemberRole, createAuditLog } = await import("./db");
        
        // Check if user is owner or admin
        const role = await getOrganizationMemberRole(input.id, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Only owners and admins can update organization");
        }
        
        const { id, ...updateData } = input;
        const org = await updateOrganization(id, updateData);
        
        await createAuditLog({
          userId: ctx.user.openId,
          action: "organization_updated",
          objectType: "organization",
          objectId: id.toString(),
          payload: JSON.stringify(updateData),
        });
        
        return org;
      }),

    // Delete organization
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { deleteOrganization, getOrganizationMemberRole, createAuditLog } = await import("./db");
        
        // Only owner can delete
        const role = await getOrganizationMemberRole(input.id, ctx.user.id);
        if (role !== "owner") {
          throw new Error("Only the owner can delete the organization");
        }
        
        await deleteOrganization(input.id);
        
        await createAuditLog({
          userId: ctx.user.openId,
          action: "organization_deleted",
          objectType: "organization",
          objectId: input.id.toString(),
        });
        
        return { success: true };
      }),

    // Set Telegram bot token for organization
    setBotToken: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        token: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateOrganizationBotToken, getOrganizationMemberRole, createAuditLog } = await import("./db");
        
        // Check if user is owner or admin
        const role = await getOrganizationMemberRole(input.organizationId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Only owners and admins can set bot token");
        }
        
        // Verify the token by calling Telegram API
        try {
          const response = await fetch(`https://api.telegram.org/bot${input.token}/getMe`);
          const data = await response.json();
          if (!data.ok) {
            throw new Error(`Invalid bot token: ${data.description}`);
          }
          
          await updateOrganizationBotToken(
            input.organizationId,
            input.token,
            data.result.username
          );
          
          await createAuditLog({
            userId: ctx.user.openId,
            action: "bot_token_updated",
            objectType: "organization",
            objectId: input.organizationId.toString(),
            payload: JSON.stringify({ botUsername: data.result.username }),
          });
          
          return { success: true, botUsername: data.result.username };
        } catch (error) {
          throw new Error(`Failed to verify bot token: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }),

    // Get organization members
    getMembers: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getOrganizationMembers, isOrganizationMember } = await import("./db");
        
        // Check if user is a member
        const isMember = await isOrganizationMember(input.organizationId, ctx.user.id);
        if (!isMember) {
          throw new Error("You are not a member of this organization");
        }
        
        return await getOrganizationMembers(input.organizationId);
      }),

    // Remove member from organization
    removeMember: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { removeOrganizationMember, getOrganizationMemberRole, createAuditLog } = await import("./db");
        
        // Check if user is owner or admin
        const role = await getOrganizationMemberRole(input.organizationId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Only owners and admins can remove members");
        }
        
        // Cannot remove owner
        const targetRole = await getOrganizationMemberRole(input.organizationId, input.userId);
        if (targetRole === "owner") {
          throw new Error("Cannot remove the owner");
        }
        
        await removeOrganizationMember(input.organizationId, input.userId);
        
        await createAuditLog({
          userId: ctx.user.openId,
          action: "member_removed",
          objectType: "organization",
          objectId: input.organizationId.toString(),
          payload: JSON.stringify({ removedUserId: input.userId }),
        });
        
        return { success: true };
      }),

    // Switch current organization
    switchCurrent: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { updateUserCurrentOrganization, isOrganizationMember } = await import("./db");
        
        // Check if user is a member
        const isMember = await isOrganizationMember(input.organizationId, ctx.user.id);
        if (!isMember) {
          throw new Error("You are not a member of this organization");
        }
        
        await updateUserCurrentOrganization(ctx.user.id, input.organizationId);
        return { success: true };
      }),
  }),

  // Stripe Payment
  stripe: router({
    // Create checkout session for subscription
    createCheckoutSession: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        priceId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getOrganizationById, getOrganizationMemberRole } = await import("./db");
        const Stripe = (await import("stripe")).default;
        
        // Check if user is owner or admin
        const role = await getOrganizationMemberRole(input.organizationId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Only owners and admins can manage subscriptions");
        }
        
        const org = await getOrganizationById(input.organizationId);
        if (!org) {
          throw new Error("Organization not found");
        }
        
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
          apiVersion: "2024-12-18.acacia",
        });
        
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: input.priceId,
              quantity: 1,
            },
          ],
          customer_email: ctx.user.email || undefined,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            organization_id: input.organizationId.toString(),
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email || "",
            customer_name: ctx.user.name || "",
          },
          allow_promotion_codes: true,
          success_url: `${origin}/settings/billing?success=true`,
          cancel_url: `${origin}/settings/billing?canceled=true`,
        });
        
        return { url: session.url };
      }),

    // Create customer portal session
    createPortalSession: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getOrganizationById, getOrganizationMemberRole } = await import("./db");
        const Stripe = (await import("stripe")).default;
        
        // Check if user is owner or admin
        const role = await getOrganizationMemberRole(input.organizationId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Only owners and admins can manage subscriptions");
        }
        
        const org = await getOrganizationById(input.organizationId);
        if (!org || !org.stripeCustomerId) {
          throw new Error("No active subscription found");
        }
        
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
          apiVersion: "2024-12-18.acacia",
        });
        
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        
        const session = await stripe.billingPortal.sessions.create({
          customer: org.stripeCustomerId,
          return_url: `${origin}/settings/billing`,
        });
        
        return { url: session.url };
      }),

    // Get subscription status
    getSubscription: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getOrganizationById, isOrganizationMember } = await import("./db");
        
        // Check if user is a member
        const isMember = await isOrganizationMember(input.organizationId, ctx.user.id);
        if (!isMember) {
          throw new Error("You are not a member of this organization");
        }
        
        const org = await getOrganizationById(input.organizationId);
        if (!org) {
          throw new Error("Organization not found");
        }
        
        return {
          status: org.subscriptionStatus,
          plan: org.subscriptionPlan,
          expiresAt: org.subscriptionExpiresAt,
          hasStripeCustomer: !!org.stripeCustomerId,
        };
      }),

    // Get payment history
    getPayments: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getPaymentsByOrganization, isOrganizationMember } = await import("./db");
        
        // Check if user is a member
        const isMember = await isOrganizationMember(input.organizationId, ctx.user.id);
        if (!isMember) {
          throw new Error("You are not a member of this organization");
        }
        
        return await getPaymentsByOrganization(input.organizationId);
      }),
  }),

  // Crypto Payment
  crypto: router({
    // Get supported cryptocurrencies
    getSupportedCryptos: publicProcedure.query(async () => {
      const { SUPPORTED_CRYPTOS } = await import("./crypto/cryptoPayment");
      return Object.entries(SUPPORTED_CRYPTOS).map(([symbol, info]) => ({
        symbol,
        ...info,
      }));
    }),

    // Create crypto payment
    createPayment: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        amountJPY: z.number().min(100),
        cryptoCurrency: z.enum(["BTC", "ETH", "USDT", "USDC"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getOrganizationMemberRole } = await import("./db");
        const { createCryptoPayment, generatePaymentQRData } = await import("./crypto/cryptoPayment");
        
        // Check if user is owner or admin
        const role = await getOrganizationMemberRole(input.organizationId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Only owners and admins can create payments");
        }
        
        const payment = await createCryptoPayment(
          input.organizationId,
          input.amountJPY,
          input.cryptoCurrency,
          `Subscription payment for organization ${input.organizationId}`
        );
        
        const qrData = generatePaymentQRData(payment);
        
        return {
          paymentId: payment.id,
          walletAddress: payment.walletAddress,
          cryptoAmount: payment.cryptoAmount,
          cryptoCurrency: payment.cryptoCurrency,
          expiresAt: payment.expiresAt,
          qrData,
        };
      }),

    // Get payment status
    getPaymentStatus: protectedProcedure
      .input(z.object({ paymentId: z.string() }))
      .query(async ({ input }) => {
        const { getCryptoPayment } = await import("./crypto/cryptoPayment");
        
        const payment = getCryptoPayment(input.paymentId);
        if (!payment) {
          throw new Error("Payment not found");
        }
        
        return {
          status: payment.status,
          txHash: payment.txHash,
          expiresAt: payment.expiresAt,
        };
      }),

    // Manually verify payment (for admin use)
    verifyPayment: protectedProcedure
      .input(z.object({
        paymentId: z.string(),
        txHash: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getCryptoPayment, updateCryptoPaymentStatus } = await import("./crypto/cryptoPayment");
        const { getOrganizationMemberRole, createAuditLog } = await import("./db");
        
        const payment = getCryptoPayment(input.paymentId);
        if (!payment) {
          throw new Error("Payment not found");
        }
        
        // Check if user is owner or admin of the organization
        const role = await getOrganizationMemberRole(payment.organizationId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Only owners and admins can verify payments");
        }
        
        await updateCryptoPaymentStatus(input.paymentId, "completed", input.txHash);
        
        await createAuditLog({
          userId: ctx.user.openId,
          action: "crypto_payment_verified",
          objectType: "payment",
          objectId: input.paymentId,
          payload: JSON.stringify({ txHash: input.txHash }),
        });
        
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
