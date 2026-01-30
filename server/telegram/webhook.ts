import { Request, Response } from "express";
import { createTask, createMeeting, createDraft, createAuditLog, getGroupChat, getDb, createReminder, getActiveTranslationSession, getAnyActiveTranslationSessionInChat, createTranslationSession, endTranslationSession, getTranslationSetting, setTranslationSetting, updateTranslationSessionLanguage, upsertGroupChat, getTaskByMessageId, updateTask, createRecurringTask, createRecurringTaskCompletion, getRecurringTaskById } from "../db";
import { sendMessageWithButtons, answerCallbackQuery, sendMessage, getBotInfo, sendPhoto, downloadFile, sendVoice } from "./bot";
import { invokeLLM } from "../_core/llm";
import { callOpenAI } from "../integrations/openai";
import { transcribeAudioWithGemini, generateSpeechWithGemini, pcmToWav, GEMINI_TTS_VOICES } from "../integrations/gemini";
import { drafts as draftsTable, botSettings, translationSettings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Post-process AI output to remove unwanted formatting and phrases
function postProcessAIOutput(text: string): string {
  let result = text;
  
  // Remove Markdown emphasis (**, __, *, _)
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1'); // **bold**
  result = result.replace(/__([^_]+)__/g, '$1'); // __underline__
  result = result.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '$1'); // *italic* (not **)
  result = result.replace(/(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)/g, '$1'); // _italic_ (not __)
  
  // Remove unwanted opening phrases
  const openingPhrases = [
    /^承知いたしました[。、\s]*/,
    /^かしこまりました[。、\s]*/,
    /^はい[。、\s]*/,
    /^ありがとうございます[。、\s]*/,
  ];
  
  for (const phrase of openingPhrases) {
    result = result.replace(phrase, '');
  }
  
  // Remove unwanted closing phrases
  const closingPhrases = [
    /[。\s]*何か関連して確認したいことはありますか[？？]?\s*$/,
    /[。\s]*何かご不明な点があれば[、。]?[^。]*[。]?\s*$/,
    /[。\s]*お気軽にお申し付けください[。]?\s*$/,
    /[。\s]*何かあればお知らせください[。]?\s*$/,
    /[。\s]*他にご質問があれば[、。]?[^。]*[。]?\s*$/,
  ];
  
  for (const phrase of closingPhrases) {
    result = result.replace(phrase, '');
  }
  
  return result.trim();
}

// Determine if a query requires web search for realtime information
function requiresWebSearch(query: string): boolean {
  // Keywords that indicate the need for current/realtime information
  const realtimeKeywords = [
    // Time-related
    '今', '現在', '最新', '今日', '昨日', '今週', '今月', '今年',
    '最近', '新しい', 'リアルタイム',
    // News-related
    'ニュース', '速報', '報道', '発表', 'アナウンス',
    // Specific years (current and recent)
    '2024年', '2025年', '2026年', '2027年',
    // Question patterns about current state
    '誰が', '何が', 'どこが', 'いくら',
    // Positions/roles that change
    '総理大臣', '大統領', '首相', '社長', 'CEO',
    // Events
    'イベント', '開催', '予定', 'スケジュール',
    // Prices/rates
    '株価', '為替', 'レート', '価格', '相場',
    // Weather
    '天気', '気温', '予報',
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check if any realtime keyword is present
  for (const keyword of realtimeKeywords) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  // Check for question patterns that typically need current info
  const questionPatterns = [
    /今の.+は[\uff1f？]/,
    /現在の.+は[\uff1f？]/,
    /最新の.+/,
    /いつ.+ですか[\uff1f？]/,
  ];
  
  for (const pattern of questionPatterns) {
    if (pattern.test(query)) {
      return true;
    }
  }
  
  return false;
}

// Check if the message mentions the bot
async function checkBotMention(message: any): Promise<{ isMentioned: boolean; cleanedText: string }> {
  const text = message.text || '';
  const entities = message.entities || [];
  
  // Get bot info
  const botInfo = await getBotInfo();
  if (!botInfo || !botInfo.username) {
    return { isMentioned: false, cleanedText: text };
  }
  
  const botUsername = botInfo.username.toLowerCase();
  
  // Check for mention entities
  for (const entity of entities) {
    if (entity.type === 'mention') {
      const mentionText = text.substring(entity.offset, entity.offset + entity.length);
      // Remove @ and compare
      if (mentionText.toLowerCase().replace('@', '') === botUsername) {
        // Remove the mention from text
        const cleanedText = (text.substring(0, entity.offset) + text.substring(entity.offset + entity.length)).trim();
        console.log(`[Bot Mention] Detected mention @${botUsername}, cleaned text: "${cleanedText}"`);
        return { isMentioned: true, cleanedText };
      }
    }
  }
  
  // Also check for text_mention (when user has no username)
  for (const entity of entities) {
    if (entity.type === 'text_mention' && entity.user?.id === botInfo.id) {
      const cleanedText = (text.substring(0, entity.offset) + text.substring(entity.offset + entity.length)).trim();
      console.log(`[Bot Mention] Detected text_mention, cleaned text: "${cleanedText}"`);
      return { isMentioned: true, cleanedText };
    }
  }
  
  return { isMentioned: false, cleanedText: text };
}

// Track processing messages to prevent duplicate handling
const processingMessages = new Set<string>();

// Telegram Webhook handler
export async function handleTelegramWebhook(req: Request, res: Response) {
  // Immediately respond to Telegram to prevent timeout retries
  res.sendStatus(200);
  
  try {
    const update = req.body;

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }

    // Handle photo messages with caption
    if (update.message && update.message.photo && update.message.caption) {
      const messageKey = `${update.message.chat.id}_${update.message.message_id}`;
      
      if (processingMessages.has(messageKey)) {
        console.log(`[Telegram Webhook] Skipping duplicate photo message: ${messageKey}`);
        return;
      }
      
      processingMessages.add(messageKey);
      
      try {
        await handlePhotoMessage(update.message);
      } finally {
        setTimeout(() => {
          processingMessages.delete(messageKey);
        }, 60000);
      }
      return;
    }

    // Handle voice messages
    if (update.message && update.message.voice) {
      const messageKey = `${update.message.chat.id}_${update.message.message_id}`;
      
      if (processingMessages.has(messageKey)) {
        console.log(`[Telegram Webhook] Skipping duplicate voice message: ${messageKey}`);
        return;
      }
      
      processingMessages.add(messageKey);
      
      try {
        await handleVoiceMessage(update.message);
      } finally {
        setTimeout(() => {
          processingMessages.delete(messageKey);
        }, 120000); // Voice processing may take longer
      }
      return;
    }

    // Handle text messages
    if (update.message && update.message.text) {
      // Create unique message ID to prevent duplicate processing
      const messageKey = `${update.message.chat.id}_${update.message.message_id}`;
      
      // Skip if already processing this message
      if (processingMessages.has(messageKey)) {
        console.log(`[Telegram Webhook] Skipping duplicate message: ${messageKey}`);
        return;
      }
      
      // Mark as processing
      processingMessages.add(messageKey);
      
      try {
        await handleTextMessage(update.message);
      } finally {
        // Clean up after processing (with delay to handle late retries)
        setTimeout(() => {
          processingMessages.delete(messageKey);
        }, 60000); // Keep in set for 60 seconds
      }
    }
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
  }
}

// Tenant-specific webhook handler
export async function handleTenantTelegramWebhook(req: Request, res: Response) {
  // Immediately respond to Telegram to prevent timeout retries
  res.sendStatus(200);
  
  const organizationSlug = req.params.organizationSlug;
  
  try {
    // Look up organization by slug
    const { getOrganizationBySlug } = await import("../db");
    const organization = await getOrganizationBySlug(organizationSlug);
    
    if (!organization) {
      console.error(`[Telegram Webhook] Organization not found: ${organizationSlug}`);
      return;
    }
    
    if (!organization.telegramBotToken) {
      console.error(`[Telegram Webhook] No bot token configured for organization: ${organizationSlug}`);
      return;
    }
    
    // Check subscription status
    if (organization.subscriptionStatus === "expired" || organization.subscriptionStatus === "cancelled") {
      console.warn(`[Telegram Webhook] Organization subscription inactive: ${organizationSlug}`);
      return;
    }
    
    const update = req.body;
    
    // Store organization context for this request
    // This will be used by message handlers to use the correct bot token
    const orgContext = {
      organizationId: organization.id,
      botToken: organization.telegramBotToken,
      organizationSlug: organization.slug,
    };
    
    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQueryWithContext(update.callback_query, orgContext);
      return;
    }
    
    // Handle text messages
    if (update.message && update.message.text) {
      const messageKey = `${organization.id}_${update.message.chat.id}_${update.message.message_id}`;
      
      if (processingMessages.has(messageKey)) {
        console.log(`[Telegram Webhook] Skipping duplicate message: ${messageKey}`);
        return;
      }
      
      processingMessages.add(messageKey);
      
      try {
        await handleTextMessageWithContext(update.message, orgContext);
      } finally {
        setTimeout(() => {
          processingMessages.delete(messageKey);
        }, 60000);
      }
    }
  } catch (error) {
    console.error(`[Telegram Webhook] Error for org ${organizationSlug}:`, error);
  }
}

// Organization context type
type OrganizationContext = {
  organizationId: number;
  botToken: string;
  organizationSlug: string;
};

// Handle callback query with organization context
async function handleCallbackQueryWithContext(callbackQuery: any, orgContext: OrganizationContext) {
  // For now, delegate to the existing handler
  // In the future, this can be extended to handle tenant-specific callbacks
  await handleCallbackQuery(callbackQuery);
}

// Handle text message with organization context
async function handleTextMessageWithContext(message: any, orgContext: OrganizationContext) {
  // For now, delegate to the existing handler
  // In the future, this can be extended to handle tenant-specific messages
  // and use the organization's bot token for responses
  await handleTextMessage(message);
}

// Handle text messages with triggers
async function handleTextMessage(message: any) {
  const text = message.text;
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();
  const messageId = message.message_id.toString();
  const chatType = message.chat.type; // "private", "group", "supergroup"

  // Handle DM messages (private chat) - check for editing drafts
  if (chatType === "private") {
    const handled = await handleDraftEdit(userId, text);
    if (handled) return;
    // If not editing a draft, ignore DM (or handle other DM commands)
    return;
  }

  // 【チャットID】トリガー - グループ登録前でも動作
  if (text.includes("【チャットID】") || text.toLowerCase() === "/chatid") {
    await handleChatIdRequest(message);
    return;
  }

  // Check for pending custom date input
  const pendingTaskMessageId = pendingCustomDateTasks.get(chatId);
  if (pendingTaskMessageId) {
    const handled = await handleCustomDateInput(chatId, text, pendingTaskMessageId);
    if (handled) {
      pendingCustomDateTasks.delete(chatId);
      return;
    }
  }

  // Check for pending in-person meeting location input
  const pendingInPersonMeeting = pendingInPersonMeetings.get(chatId);
  if (pendingInPersonMeeting) {
    await handleInPersonMeetingLocation(chatId, text, pendingInPersonMeeting);
    pendingInPersonMeetings.delete(chatId);
    return;
  }

  // Check for pending recurring task input
  const pendingRecurring = pendingRecurringTasks.get(chatId);
  if (pendingRecurring && ['day_of_month', 'time', 'task_title', 'assignee'].includes(pendingRecurring.step)) {
    const handled = await handleRecurringTaskInput(chatId, text);
    if (handled) return;
  }

  // Check if group is registered
  const groupChat = await getGroupChat(chatId);
  if (!groupChat) {
    console.log(`[Telegram] Group ${chatId} not registered, ignoring message`);
    return;
  }

  // 【タスク】トリガー
  if (text.includes("【タスク】")) {
    await handleTaskTrigger(message, groupChat);
    return;
  }

  // 【ミーティング】トリガー
  if (text.includes("【ミーティング】")) {
    await handleMeetingTrigger(message, groupChat);
    return;
  }

  // 【AI】トリガー
  if (text.includes("【AI】")) {
    await handleAITrigger(message, groupChat);
    return;
  }

  // 【画像生成】トリガー
  if (text.includes("【画像生成】")) {
    await handleImageGenerationTrigger(message, groupChat);
    return;
  }

  // 【定期タスク】トリガー
  if (text.includes("【定期タスク】")) {
    await handleRecurringTaskTrigger(message, groupChat);
    return;
  }
  
  // ボットへのメンションでAIトリガー
  const botMention = await checkBotMention(message);
  if (botMention.isMentioned) {
    // メンションを除去したテキストでAIトリガーを実行
    const modifiedMessage = {
      ...message,
      text: botMention.cleanedText,
    };
    await handleAITrigger(modifiedMessage, groupChat);
    return;
  }

  // 【返答】トリガー
  if (text.includes("【返答】")) {
    await handleReplyTrigger(message, groupChat);
    return;
  }
  
  // 翻訳開始/終了トリガー
  const translationHandled = await handleTranslationTrigger(message, chatId, userId);
  if (translationHandled) return;
  
  // アクティブな翻訳セッションがある場合、メッセージを翻訳
  const translatedHandled = await handleActiveTranslation(message, chatId, userId);
  if (translatedHandled) return;
}

// Handle task creation
async function handleTaskTrigger(message: any, groupChat: any) {
  const text = message.text;
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();
  const messageId = message.message_id.toString();

  // Extract assignee from mentions first
  const mentions = message.entities?.filter((e: any) => e.type === "mention") || [];
  let assigneeId = userId; // Default to requester
  let assigneeMention = "";

  if (mentions.length > 0) {
    // Extract username from mention
    const mentionText = text.substring(mentions[0].offset, mentions[0].offset + mentions[0].length);
    assigneeId = mentionText.replace("@", "");
    assigneeMention = mentionText; // Store the full mention text (e.g., @username)
  }

  // Extract task title (text after 【タスク】, removing the assignee mention to avoid duplication)
  let taskTitle = text.replace("【タスク】", "").trim();
  if (assigneeMention) {
    // Remove the assignee mention from the task title
    taskTitle = taskTitle.replace(assigneeMention, "").trim();
  }

  // Create task in database
  await createTask({
    groupChatId: chatId,
    messageId,
    requesterId: userId,
    assigneeId,
    title: taskTitle,
    status: "pending_acceptance",
  });

  // Send deadline selection buttons to assignee
  const buttons = [
    [
      { text: "今日中", callback_data: `task_deadline_today_${messageId}` },
      { text: "明日", callback_data: `task_deadline_tomorrow_${messageId}` },
    ],
    [
      { text: "3日後", callback_data: `task_deadline_3days_${messageId}` },
      { text: "日付指定", callback_data: `task_deadline_custom_${messageId}` },
    ],
  ];

  await sendMessageWithButtons(
    chatId,
    `@${assigneeId} さん、タスク「${taskTitle}」の期限を設定してください`,
    buttons
  );

  // Log audit
  await createAuditLog({
    userId,
    action: "task_created",
    objectType: "task",
    objectId: messageId,
    payload: JSON.stringify({ title: taskTitle, assigneeId }),
  });
}

// Handle meeting creation
// Store pending meeting info for later use
const pendingMeetings = new Map<string, {
  title: string;
  datetime: string;
  attendees: string[];
  rawText: string;
}>();

// Store pending custom date task requests
const pendingCustomDateTasks = new Map<string, string>();

// Store pending in-person meeting location requests
const pendingInPersonMeetings = new Map<string, {
  title: string;
  datetime: string;
  attendees: string[];
  userId: string;
}>();

// Store meeting info for reminder setup
const pendingMeetingReminders = new Map<string, {
  chatId: string;
  userId: string;
  meetLink: string;
  datetime?: string;
  attendees?: string[];
  title: string;
  timezone: string;
  timezoneLabel: string;
}>();

// Round time to nearest 30 minutes
function roundToNearest30Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  if (minutes < 15) {
    rounded.setMinutes(0, 0, 0);
  } else if (minutes < 45) {
    rounded.setMinutes(30, 0, 0);
  } else {
    rounded.setMinutes(0, 0, 0);
    rounded.setHours(rounded.getHours() + 1);
  }
  return rounded;
}

// Get current time in Philippines timezone (UTC+8)
function getNowInPhilippines(): Date {
  const now = new Date();
  // Convert to Philippines time (UTC+8)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const philippinesTime = new Date(utc + (8 * 60 * 60 * 1000));
  return philippinesTime;
}

// Format datetime to Japanese format with 24-hour time (e.g., "1月29日 19:30")
function formatDatetime(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  // 24時間形式で表示
  return `${month}月${day}日 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

async function handleMeetingTrigger(message: any, groupChat: any) {
  const text = message.text;
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();

  // Extract meeting details from text
  const meetingText = text.replace("【ミーティング】", "").trim();
  console.log(`[Meeting] Processing meeting text: "${meetingText}"`);
  
  // Parse date/time and convert to concrete datetime
  let datetime = "";
  const now = getNowInPhilippines();
  
  // 全角数字を半角に変換（全てのパターンで使用）
  const normalizedText = meetingText.replace(/[０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  console.log(`[Meeting] Normalized text: "${normalizedText}"`);
  
  // Pattern 1: 具体的な日付 (1月29日17時)
  const fullDateMatch = normalizedText.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2})時/);
  if (fullDateMatch) {
    const month = parseInt(fullDateMatch[1]);
    const day = parseInt(fullDateMatch[2]);
    const hour = parseInt(fullDateMatch[3]);
    const year = now.getFullYear();
    // 月が過去の場合は来年
    const targetDate = new Date(year, month - 1, day, hour, 0);
    if (targetDate < now) {
      targetDate.setFullYear(year + 1);
    }
    datetime = formatDatetime(targetDate);
  }
  // Pattern 2: 相対的な日付 (今日/明日/明後日15時)
  else if (meetingText.match(/(今日|明日|明後日)\s*(\d{1,2})時/)) {
    const relMatch = meetingText.match(/(今日|明日|明後日)\s*(\d{1,2})時/)!;
    const dayOffset = relMatch[1] === '今日' ? 0 : relMatch[1] === '明日' ? 1 : 2;
    const hour = parseInt(relMatch[2]);
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    targetDate.setHours(hour, 0, 0, 0);
    datetime = formatDatetime(targetDate);
  }
  // Pattern 3: 時間帯 + 時間 (朝3時, 午後3時, 夜8時など)
  else if (meetingText.match(/(朝|午前|午後|夕方|夜|深夜)\s*(\d{1,2})時/)) {
    const timeMatch = meetingText.match(/(朝|午前|午後|夕方|夜|深夜)\s*(\d{1,2})時/)!;
    const period = timeMatch[1];
    let hour = parseInt(timeMatch[2]);
    
    // 時間帯に応じて時間を調整
    if (period === '午後' && hour < 12) hour += 12;
    if (period === '夕方' && hour < 12) hour += 12;
    if (period === '夜' && hour < 12) hour += 12;
    if (period === '深夜' && hour >= 1 && hour <= 4) hour = hour; // 深夜1-4時はそのまま
    
    const targetDate = new Date(now);
    targetDate.setHours(hour, 0, 0, 0);
    
    // 指定時間が過ぎていれば翌日に
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    datetime = formatDatetime(targetDate);
  }
  // Pattern 4: X時間後に (3時間後に, 2時間後など) - 全角・半角数字両方に対応
  else if (normalizedText.match(/(\d{1,2})時間後/)) {
    const hoursMatch = normalizedText.match(/(\d{1,2})時間後/)!;
    const hoursLater = parseInt(hoursMatch[1]);
    const targetDate = new Date(now);
    targetDate.setTime(targetDate.getTime() + hoursLater * 60 * 60 * 1000);
    const roundedDate = roundToNearest30Minutes(targetDate);
    datetime = formatDatetime(roundedDate);
  }
  // Pattern 5: 単純な時間 (3時, 15時から)
  else if (meetingText.match(/(\d{1,2})時/)) {
    const hourMatch = meetingText.match(/(\d{1,2})時/)!;
    const hour = parseInt(hourMatch[1]);
    const targetDate = new Date(now);
    targetDate.setHours(hour, 0, 0, 0);
    
    // 指定時間が過ぎていれば翌日に
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    datetime = formatDatetime(targetDate);
  }
  
  // Parse attendees (e.g., "@username と" or "田中さんと")
  const attendees: string[] = [];
  const attendeePatterns = [
    /@(\w+)/g,
    /([\u4e00-\u9fa5]+さん)/g,
  ];
  
  for (const pattern of attendeePatterns) {
    const matches = meetingText.matchAll(pattern);
    for (const match of matches) {
      attendees.push(match[1] || match[0]);
    }
  }
  
  console.log(`[Meeting] Parsed datetime: "${datetime}", attendees: ${JSON.stringify(attendees)}`);
  
  // Store meeting info for later use
  pendingMeetings.set(chatId, {
    title: meetingText,
    datetime,
    attendees,
    rawText: meetingText,
  });

  // Send confirmation buttons
  const buttons = [
    [
      { text: "Google Meet", callback_data: `meeting_type_meet` },
      { text: "対面", callback_data: `meeting_type_inperson` },
    ],
  ];

  await sendMessageWithButtons(
    chatId,
    `ミーティング「${meetingText}」の形式を選択してください`,
    buttons
  );
}

// Parse meeting datetime from text like "1月29日17時" or "明日15時"
function parseMeetingDatetime(datetimeText: string, timezone: string): Date | null {
  try {
    const now = new Date();
    
    // Get current date in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const currentYear = parseInt(parts.find(p => p.type === 'year')?.value || String(now.getFullYear()));
    const currentMonth = parseInt(parts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1));
    const currentDay = parseInt(parts.find(p => p.type === 'day')?.value || String(now.getDate()));
    
    let year = currentYear;
    let month: number | null = null;
    let day: number | null = null;
    let hour: number | null = null;
    let minute = 0;
    
    // Pattern: "1月29日17時" or "1月29日 3:00"
    const fullDateMatch = datetimeText.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[時:]/);
    if (fullDateMatch) {
      month = parseInt(fullDateMatch[1]);
      day = parseInt(fullDateMatch[2]);
      hour = parseInt(fullDateMatch[3]);
      
      // Check for minute part (e.g., "3:00" or "3:30")
      const minuteMatch = datetimeText.match(/(\d{1,2}):(\d{2})/);
      if (minuteMatch) {
        minute = parseInt(minuteMatch[2]);
      }
    }
    
    // Pattern: "今日/明日/明後日 15時"
    const relativeDateMatch = datetimeText.match(/(今日|明日|明後日)\s*(\d{1,2})時/);
    if (relativeDateMatch) {
      const relative = relativeDateMatch[1];
      hour = parseInt(relativeDateMatch[2]);
      
      const baseDate = new Date();
      if (relative === '明日') {
        baseDate.setDate(baseDate.getDate() + 1);
      } else if (relative === '明後日') {
        baseDate.setDate(baseDate.getDate() + 2);
      }
      
      month = baseDate.getMonth() + 1;
      day = baseDate.getDate();
      year = baseDate.getFullYear();
    }
    
    // Pattern: "15時から" (today)
    const timeOnlyMatch = datetimeText.match(/(\d{1,2})時/);
    if (!fullDateMatch && !relativeDateMatch && timeOnlyMatch) {
      hour = parseInt(timeOnlyMatch[1]);
      month = currentMonth;
      day = currentDay;
    }
    
    if (month === null || day === null || hour === null) {
      return null;
    }
    
    // Create date in UTC, then adjust for timezone
    // Get timezone offset
    const tempDate = new Date();
    const utcTime = tempDate.getTime();
    const localTimeStr = tempDate.toLocaleString('en-US', { timeZone: timezone });
    const localTime = new Date(localTimeStr).getTime();
    const tzOffsetMs = localTime - utcTime;
    
    // Create local datetime and convert to UTC
    const localDatetime = new Date(year, month - 1, day, hour, minute, 0, 0);
    const utcDatetime = new Date(localDatetime.getTime() - tzOffsetMs);
    
    return utcDatetime;
  } catch (error) {
    console.error('[parseMeetingDatetime] Error:', error);
    return null;
  }
}

// Parse reminder request from user message
function parseReminderRequest(text: string): { eventName: string; eventTime: string; reminderMinutes: number } | null {
  // Patterns for reminder requests
  // e.g., "18時にミーティング、15分前に教えて"
  // e.g., "明日10時の会議、5分前にリマインド"
  
  const patterns = [
    // "今日18時にミーティング、15分前に教えて"
    /(今日|明日|明後日)?\s*(\d{1,2})時(\d{1,2}分)?\s*(に|から)?\s*(.+?)[、。\s]+?(\d+)分前に[教えて|リマインド|通知|知らせて]/,
    // "ミーティングが18時から、15分前にリマインドして"
    /(.+?)が\s*(今日|明日|明後日)?\s*(\d{1,2})時(\d{1,2}分)?\s*(から|に)?[、。\s]+?(\d+)分前に[教えて|リマインド|通知|知らせて]/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Try to extract info based on pattern structure
      // This is a simplified parser - in production, use NLP
      return null; // Will use AI function calling instead
    }
  }
  
  return null;
}

// Check if message is a reminder request
function isReminderRequest(text: string): boolean {
  const reminderKeywords = [
    'リマインダー', 'リマインド', '通知', '知らせて', '思い出させて',
    '分前に', '前に教え', '前にリマインド', '前に通知',
    '分後に', '分後リマインド', '分後リマインダー',
    '時間後に', '後に教えて', '後にリマインド', '後にリマインダー',
    '後に通知', '教えて', 'お知らせ'
  ];
  
  return reminderKeywords.some(keyword => text.includes(keyword));
}

// Check if message is asking for current time
function isTimeQuery(text: string): boolean {
  const timeKeywords = [
    '今何時', '今、何時', '何時？', '何時ですか',
    '今日は何日', '今日何日', '何日？', '何日ですか',
    '現在時刻', '今の時間', '時間教えて'
  ];
  
  return timeKeywords.some(keyword => text.includes(keyword));
}

// Calculate next reminder time for recurring reminders
function calculateNextReminderTime(
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly',
  repeatDays: string | null,
  currentTime: Date,
  eventHour: number,
  eventMinute: number,
  reminderMinutesBefore: number
): Date | null {
  const now = new Date();
  let nextDate = new Date(currentTime);
  
  // Set the time for the event
  nextDate.setHours(eventHour, eventMinute, 0, 0);
  
  // Calculate reminder time (before the event)
  let reminderTime = new Date(nextDate.getTime() - reminderMinutesBefore * 60 * 1000);
  
  // If the reminder time is in the past, calculate the next occurrence
  if (reminderTime <= now) {
    switch (repeatType) {
      case 'daily':
        // Move to tomorrow
        nextDate.setDate(nextDate.getDate() + 1);
        break;
        
      case 'weekly':
        if (repeatDays) {
          const days = repeatDays.split(',').map(d => parseInt(d.trim()));
          const currentDay = nextDate.getDay();
          
          // Find the next day in the list
          let found = false;
          for (let i = 1; i <= 7; i++) {
            const checkDay = (currentDay + i) % 7;
            if (days.includes(checkDay)) {
              nextDate.setDate(nextDate.getDate() + i);
              found = true;
              break;
            }
          }
          if (!found) return null;
        } else {
          // Default to same day next week
          nextDate.setDate(nextDate.getDate() + 7);
        }
        break;
        
      case 'monthly':
        if (repeatDays) {
          const days = repeatDays.split(',').map(d => parseInt(d.trim()));
          const currentDayOfMonth = nextDate.getDate();
          
          // Find the next day in the current month or next month
          let found = false;
          for (const day of days) {
            if (day > currentDayOfMonth) {
              nextDate.setDate(day);
              found = true;
              break;
            }
          }
          if (!found) {
            // Move to next month, first day in the list
            nextDate.setMonth(nextDate.getMonth() + 1);
            nextDate.setDate(days[0]);
          }
        } else {
          // Default to same day next month
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        break;
        
      default:
        return null;
    }
    
    reminderTime = new Date(nextDate.getTime() - reminderMinutesBefore * 60 * 1000);
  }
  
  return reminderTime;
}

// Get day name in Japanese
function getDayName(day: number): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[day];
}

// Process reminder tool call and create reminder in database
async function processReminderToolCall(
  chatId: string,
  userId: string,
  eventName: string,
  eventDatetime: string,
  reminderMinutesBefore: number,
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly' = 'none',
  repeatDays: string | null = null
) {
  try {
    // Get configured timezone
    const db = await getDb();
    let timezone = 'Asia/Manila';
    if (db) {
      const tzSetting = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'timezone')).limit(1);
      if (tzSetting[0]?.settingValue) {
        timezone = tzSetting[0].settingValue;
      }
    }
    
    // Parse the event datetime - AI returns local time in the configured timezone
    // We need to convert it to UTC for storage
    // eventDatetime is like "2026-01-28T18:28:00" (local time in timezone)
    
    // Get timezone offset
    const tempDate = new Date();
    const utcTime = tempDate.getTime();
    const localTimeStr = tempDate.toLocaleString('en-US', { timeZone: timezone });
    const localTime = new Date(localTimeStr).getTime();
    const tzOffsetMs = localTime - utcTime;
    
    // Parse the datetime string as local time and convert to UTC
    const localEventTime = new Date(eventDatetime);
    // Adjust for timezone: subtract the offset to get UTC
    const eventTime = new Date(localEventTime.getTime() - tzOffsetMs);
    
    console.log(`[Reminder] Parsing datetime: ${eventDatetime}`);
    console.log(`[Reminder] Timezone: ${timezone}, offset: ${tzOffsetMs / 1000 / 60} minutes`);
    console.log(`[Reminder] Event time (UTC): ${eventTime.toISOString()}`);
    
    const eventHour = localEventTime.getHours();
    const eventMinute = localEventTime.getMinutes();
    
    // Calculate reminder time
    let reminderTime: Date;
    
    if (repeatType !== 'none') {
      // For recurring reminders, calculate the first occurrence
      const nextTime = calculateNextReminderTime(
        repeatType,
        repeatDays,
        eventTime,
        eventHour,
        eventMinute,
        reminderMinutesBefore
      );
      
      if (!nextTime) {
        await sendMessage(chatId, `❌ 繰り返しリマインダーの設定に失敗しました。`);
        return;
      }
      reminderTime = nextTime;
    } else {
      reminderTime = new Date(eventTime.getTime() - reminderMinutesBefore * 60 * 1000);
    }
    
    // Check if reminder time is in the past (for non-recurring)
    const now = new Date();
    if (repeatType === 'none' && reminderTime <= now) {
      await sendMessage(chatId, `❌ リマインド時刻が過去の時刻です。別の時刻を指定してください。`);
      return;
    }
    
    // Create reminder in database
    const reminderId = await createReminder({
      chatId,
      userId,
      message: reminderMinutesBefore === 0 
        ? `🔔 「${eventName}」のお時間です。`
        : `🔔 「${eventName}」まであと${reminderMinutesBefore}分です。ご準備をお願いいたします。`,
      remindAt: reminderTime,
      status: "pending",
      repeatType,
      repeatDays,
      eventName,
      reminderMinutesBefore,
    });
    
    // Format times for display using configured timezone (reuse db from above)
    const displayTimezone = timezone;
    
    const reminderTimeStr = reminderTime.toLocaleString('ja-JP', { 
      month: 'numeric', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: displayTimezone
    });
    
    // Build confirmation message
    let confirmMessage = `✅ リマインダーを設定しました！\n\n📅 イベント: ${eventName}\n🔔 次回リマインド: ${reminderTimeStr}`;
    
    if (repeatType !== 'none') {
      let repeatDesc = '';
      switch (repeatType) {
        case 'daily':
          repeatDesc = '毎日';
          break;
        case 'weekly':
          if (repeatDays) {
            const dayNames = repeatDays.split(',').map(d => getDayName(parseInt(d.trim())));
            repeatDesc = `毎週${dayNames.join('・')}曜日`;
          } else {
            repeatDesc = '毎週';
          }
          break;
        case 'monthly':
          if (repeatDays) {
            repeatDesc = `毎月${repeatDays}日`;
          } else {
            repeatDesc = '毎月';
          }
          break;
      }
      confirmMessage += `\n🔁 繰り返し: ${repeatDesc}`;
    }
    
    await sendMessage(chatId, confirmMessage);
    
    console.log(`[Reminder] Created ${repeatType} reminder #${reminderId} for ${eventName} at ${reminderTimeStr}`);
  } catch (error) {
    console.error("[Reminder] Error creating reminder:", error);
    await sendMessage(chatId, '❌ リマインダーの作成に失敗しました。');
  }
}

// Get current time in the configured timezone
async function getCurrentTimeInTimezone(): Promise<{ datetime: string; timezone: string; formatted: string }> {
  const db = await getDb();
  let timezone = 'Asia/Manila'; // Default to Philippines time
  
  if (db) {
    const tzSetting = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'timezone')).limit(1);
    if (tzSetting[0]?.settingValue) {
      timezone = tzSetting[0].settingValue;
    }
  }
  
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const isoDatetime = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
  const formatted = `${getPart('year')}年${getPart('month')}月${getPart('day')}日 ${getPart('hour')}:${getPart('minute')}`;
  
  return { datetime: isoDatetime, timezone, formatted };
}

// Tools definition for AI function calling
const reminderTools = [
  {
    type: "function" as const,
    function: {
      name: "get_current_time",
      description: "現在の日時を取得します。「今何時？」「今日は何日？」「3分後」「1時間後」などの質問や相対時刻の計算に使用します。リマインダーを設定する前に必ずこのツールで現在時刻を取得してください。",
      parameters: {
        type: "object",
        properties: {} as Record<string, { type: string; description: string }>,
        required: [] as string[]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_reminder",
      description: "ユーザーのためにリマインダーを設定します。指定された時刻にTelegramで通知を送信します。繰り返しリマインダーも設定可能です。リマインダーを設定する前に必ずget_current_timeで現在時刻を取得してください。",
      parameters: {
        type: "object",
        properties: {
          event_name: {
            type: "string",
            description: "イベント名（例: ミーティング、会議、打ち合わせ、朝会、トイレに行く）"
          },
          event_datetime: {
            type: "string",
            description: "イベントの日時（ISO 8601形式: YYYY-MM-DDTHH:mm:ss）。get_current_timeで取得した現在時刻を基準に計算してください。"
          },
          reminder_minutes_before: {
            type: "number",
            description: "イベントの何分前にリマインドするか。「X分後に教えて」の場合は0を設定し、event_datetimeに現在時刻+X分を設定。"
          },
          repeat_type: {
            type: "string",
            enum: ["none", "daily", "weekly", "monthly"],
            description: "繰り返しタイプ。none=1回のみ, daily=毎日, weekly=毎週, monthly=毎月。「毎日」「毎週」「毎月」などの言葉があれば該当するタイプを選択。"
          },
          repeat_days: {
            type: "string",
            description: "weeklyの場合: 曜日番号をカンマ区切り（0=日,1=月,2=火,3=水,4=木,5=金,6=土）。例: '1,3,5'は月・水・金。monthlyの場合: 日付をカンマ区切り。例: '1,15'は1日と15日。"
          }
        },
        required: ["event_name", "event_datetime", "reminder_minutes_before"]
      }
    }
  }
];

// Handle AI query
async function handleAITrigger(message: any, groupChat: any) {
  const text = message.text;
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();

  // Check if user is admin (simplified - should check against admin list)
  // For now, allow all users

  try {
    // Get AI settings from database (individual keys)
    const db = await getDb();
    let systemPrompt = "あなたはTelegramグループチャットのアシスタントです。過去の会話を要約し、適切な返答を生成してください。";
    let temperature = 0.7;
    let maxTokens = 1000;
    
    if (db) {
      const settings = await db.select().from(botSettings);
      
      const promptSetting = settings.find(s => s.settingKey === "ai_system_prompt");
      const tempSetting = settings.find(s => s.settingKey === "ai_temperature");
      const tokensSetting = settings.find(s => s.settingKey === "ai_max_tokens");
      
      if (promptSetting && promptSetting.settingValue) {
        systemPrompt = promptSetting.settingValue;
        console.log("[AI Trigger] Using custom system prompt:", systemPrompt.substring(0, 50) + "...");
      }
      if (tempSetting && tempSetting.settingValue) {
        temperature = parseFloat(tempSetting.settingValue);
      }
      if (tokensSetting && tokensSetting.settingValue) {
        maxTokens = parseInt(tokensSetting.settingValue);
      }
    }

    // Collect recent chat history (simplified - in real implementation, fetch from Telegram API)
    const context = "Recent chat context would be collected here";

    // Check if web search is enabled in settings
    let webSearchEnabled = false;
    let webSearchContext = "";
    
    if (db) {
      const webSearchSetting = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'enable_web_search')).limit(1);
      webSearchEnabled = webSearchSetting[0]?.settingValue === 'true';
    }
    
    // Determine if the query needs real-time information
    const userQuery = text.replace("【AI】", "").trim();
    const needsRealtimeInfo = requiresWebSearch(userQuery);
    
    console.log("[AI Trigger] Web search enabled in settings:", webSearchEnabled);
    console.log("[AI Trigger] Query needs realtime info:", needsRealtimeInfo);
    
    // Only perform web search if enabled AND query needs realtime info
    if (webSearchEnabled && needsRealtimeInfo) {
      console.log("[AI Trigger] Performing web search for realtime information...");
      
      try {
        const { searchWeb } = await import('../integrations/websearch');
        const searchResult = await searchWeb(userQuery);
        
        webSearchContext = `\n\n【最新のWeb検索結果】\n${searchResult.content}`;
        if (searchResult.sources && searchResult.sources.length > 0) {
          webSearchContext += `\n\n出典: ${searchResult.sources.slice(0, 3).join(", ")}`;
        }
        
        console.log("[AI Trigger] Web search completed, context added");
      } catch (error) {
        console.error("[AI Trigger] Web search failed:", error);
        // Continue without web search context
      }
    } else if (webSearchEnabled && !needsRealtimeInfo) {
      console.log("[AI Trigger] Web search skipped - query does not require realtime info");
    }

    // Generate AI response with settings
    // Get API provider and settings from database
    if (!db) {
      await sendMessage(chatId, '❌ データベース接続エラーが発生しました。');
      return;
    }
    
    const apiProviderRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'ai_provider')).limit(1);
    const apiProvider = apiProviderRow[0]?.settingValue || 'openai';
    
    const aiModelRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'ai_model')).limit(1);
    const aiModel = aiModelRow[0]?.settingValue || (apiProvider === 'claude' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o');
    
    console.log("[AI Trigger] Using API provider:", apiProvider);
    console.log("[AI Trigger] Using model:", aiModel);
    console.log("[AI Trigger] Full system prompt:", systemPrompt);
    console.log("[AI Trigger] Temperature:", temperature);
    console.log("[AI Trigger] Max tokens:", maxTokens);
    console.log("[AI Trigger] User message:", text.replace("【AI】", "").trim());
    
    let draftText = "";
    
    // Add strict output constraints to system prompt
    const outputConstraints = `

【出力の絶対ルール（必ず守ること）】
- Markdownの強調記号（**、__、*、_）は絶対に使用禁止
- 「承知いたしました」「かしこまりました」などの冒頭挨拶は禁止
- 「何か関連して確認したいことはありますか？」「何かご不明な点があれば」などの結びのフレーズは禁止
- 結果のみを簡潔に返答すること`;
    
    const enhancedSystemPrompt = systemPrompt + outputConstraints;
    
    // Check if this is a time query
    const isTime = isTimeQuery(userQuery);
    
    if (isTime) {
      console.log("[AI Trigger] Detected time query");
      const currentTime = await getCurrentTimeInTimezone();
      const response = `現在の時刻は ${currentTime.formatted} です。`;
      await sendMessage(chatId, response);
      return;
    }
    
    // Check if this is a reminder request (reuse userQuery from above)
    const isReminder = isReminderRequest(userQuery);
    
    if (isReminder) {
      console.log("[AI Trigger] Detected reminder request, using function calling");
      
      // Get current date/time in configured timezone
      const currentTime = await getCurrentTimeInTimezone();
      const currentDateStr = currentTime.datetime.split('T')[0];
      const currentTimeStr = currentTime.datetime.split('T')[1].substring(0, 5);
      
      const reminderSystemPrompt = `あなたはリマインダー設定アシスタントです。
現在の日付: ${currentDateStr}
現在の時刻: ${currentTimeStr} (タイムゾーン: ${currentTime.timezone})

ユーザーのリクエストからイベント名、イベント日時、リマインド時間、繰り返し設定を抽出してset_reminder関数を呼び出してください。

ルール:
- 「今日」は${currentDateStr}を使用
- 「明日」は翌日の日付を使用
- 「X分後」「X時間後」の場合は、現在時刻${currentTimeStr}に指定分数を加算してevent_datetimeを設定し、reminder_minutes_beforeは0にする
- 時間が指定されていない場合はデフォルトで15分前
- event_datetimeはISO 8601形式（YYYY-MM-DDTHH:mm:ss）で返す
- 「毎日」「毎週」「毎月」などの言葉があればrepeat_typeを設定
- 「毎週月曜日」ならrepeat_type="weekly"、repeat_days="1"
- 「毎週月・水・金」ならrepeat_type="weekly"、repeat_days="1,3,5"
- 「毎月1日」ならrepeat_type="monthly"、repeat_days="1"
- 繰り返しがない場合はrepeat_type="none"または省略`;
      
      try {
        if (apiProvider === 'claude') {
          // Claude doesn't support function calling in the same way, so use OpenAI for this
          // Fall back to OpenAI for function calling
          const openaiApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'openai_api_key')).limit(1);
          const openaiApiKey = openaiApiKeyRow[0]?.settingValue || '';
          
          if (!openaiApiKey || openaiApiKey.trim() === '') {
            // Try Claude without function calling
            const { callClaude } = await import('../integrations/claude');
            const claudeApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'claude_api_key')).limit(1);
            const claudeApiKey = claudeApiKeyRow[0]?.settingValue || '';
            
            if (!claudeApiKey) {
              await sendMessage(chatId, '❌ API Keyが設定されていません。');
              return;
            }
            
            // Use Claude with tool use
            const response = await callClaude(claudeApiKey, {
              model: aiModel,
              system: reminderSystemPrompt,
              messages: [{ role: "user", content: userQuery }],
              tools: [{
                name: "set_reminder",
                description: "リマインダーを設定する（繰り返しも可能）",
                input_schema: {
                  type: "object",
                  properties: {
                    event_name: { type: "string", description: "イベント名" },
                    event_datetime: { type: "string", description: "イベント日時 (ISO 8601)" },
                    reminder_minutes_before: { type: "number", description: "何分前にリマインドするか" },
                    repeat_type: { type: "string", description: "繰り返しタイプ (none/daily/weekly/monthly)" },
                    repeat_days: { type: "string", description: "weekly: 曜日番号(0-6), monthly: 日付" }
                  },
                  required: ["event_name", "event_datetime", "reminder_minutes_before"]
                }
              }],
              tool_choice: { type: "tool", name: "set_reminder" },
              max_tokens: 1024,
            });
            
            // Check if Claude used the tool
            const toolUse = response.content.find((c: any) => c.type === 'tool_use') as any;
            if (toolUse && toolUse.input) {
              const { event_name, event_datetime, reminder_minutes_before, repeat_type, repeat_days } = toolUse.input;
              await processReminderToolCall(chatId, userId, event_name, event_datetime, reminder_minutes_before, repeat_type || 'none', repeat_days || null);
              return;
            }
          } else {
            // Use OpenAI for function calling
            const response = await callOpenAI(openaiApiKey, {
              model: 'gpt-4o',
              messages: [
                { role: "system", content: reminderSystemPrompt },
                { role: "user", content: userQuery }
              ],
              tools: reminderTools,
              tool_choice: { type: "function", function: { name: "set_reminder" } },
            });
            
            const toolCall = response.choices[0]?.message?.tool_calls?.[0];
            if (toolCall && toolCall.function.name === 'set_reminder') {
              const args = JSON.parse(toolCall.function.arguments);
              await processReminderToolCall(chatId, userId, args.event_name, args.event_datetime, args.reminder_minutes_before, args.repeat_type || 'none', args.repeat_days || null);
              return;
            }
          }
        } else {
          // Use OpenAI for function calling
          const openaiApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'openai_api_key')).limit(1);
          const openaiApiKey = openaiApiKeyRow[0]?.settingValue || '';
          
          if (!openaiApiKey || openaiApiKey.trim() === '') {
            await sendMessage(chatId, '❌ OpenAI API Keyが設定されていません。');
            return;
          }
          
          const response = await callOpenAI(openaiApiKey, {
            model: aiModel,
            messages: [
              { role: "system", content: reminderSystemPrompt },
              { role: "user", content: userQuery }
            ],
            tools: reminderTools,
            tool_choice: { type: "function", function: { name: "set_reminder" } },
          });
          
          const toolCall = response.choices[0]?.message?.tool_calls?.[0];
          if (toolCall && toolCall.function.name === 'set_reminder') {
            const args = JSON.parse(toolCall.function.arguments);
            await processReminderToolCall(chatId, userId, args.event_name, args.event_datetime, args.reminder_minutes_before, args.repeat_type || 'none', args.repeat_days || null);
            return;
          }
        }
        
        // If we get here, function calling didn't work
        await sendMessage(chatId, '❌ リマインダーの設定に失敗しました。もう一度お試しください。');
        return;
      } catch (error) {
        console.error("[AI Trigger] Reminder function calling error:", error);
        await sendMessage(chatId, '❌ リマインダーの設定中にエラーが発生しました。');
        return;
      }
    }
    
    if (apiProvider === 'claude') {
      // Use Claude API
      const { callClaude } = await import('../integrations/claude');
      const claudeApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'claude_api_key')).limit(1);
      const claudeApiKey = claudeApiKeyRow[0]?.settingValue || '';
      
      if (!claudeApiKey || claudeApiKey.trim() === '') {
        await sendMessage(chatId, '❌ Claude API Keyが設定されていません。管理画面から設定してください。');
        return;
      }
      
      const response = await callClaude(claudeApiKey, {
        model: aiModel,
        system: enhancedSystemPrompt,
        messages: [
          {
            role: "user",
            content: text.replace("【AI】", "").trim() + webSearchContext,
          },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      });
      
      const textContent = response.content.find((c: any) => c.type === 'text') as any;
      draftText = textContent?.text || "生成に失敗しました";
      const contentPreview = draftText.substring(0, 100) + "...";
      console.log("[AI Trigger] Claude response:", contentPreview);
    } else {
      // Use OpenAI API
      const openaiApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'openai_api_key')).limit(1);
      const openaiApiKey = openaiApiKeyRow[0]?.settingValue || '';
      
      if (!openaiApiKey || openaiApiKey.trim() === '') {
        await sendMessage(chatId, '❌ OpenAI API Keyが設定されていません。管理画面から設定してください。');
        return;
      }
      
      const response = await callOpenAI(openaiApiKey, {
        model: aiModel,
        messages: [
          {
            role: "system",
            content: enhancedSystemPrompt,
          },
          {
            role: "user",
            content: text.replace("【AI】", "").trim() + webSearchContext,
          },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      });
      
      draftText = response.choices[0]?.message?.content || "生成に失敗しました";
      const contentPreview = draftText.substring(0, 100) + "...";
      console.log("[AI Trigger] OpenAI response:", contentPreview);
    }
    
    // Post-process: Remove any remaining Markdown emphasis and unwanted phrases
    draftText = postProcessAIOutput(draftText);

    // Store draft in database for later retrieval
    const draftId = await createDraft({
      ownerId: userId,
      sourceType: "ai_query",
      sourceContext: text,
      draftText,
      targetGroupChatId: chatId,
      status: "pending_approval",
    });

    // Create buttons with draft ID
    const buttons = [
      [
        { text: "投稿", callback_data: `draft_post_${draftId}` },
        { text: "編集", callback_data: `draft_edit_${draftId}` },
      ],
      [{ text: "破棄", callback_data: `draft_discard_${draftId}` }],
    ];

    // Send draft to user's DM only (no group notification)
    await sendMessageWithButtons(userId, `AI生成下書き:\n\n${draftText}`, buttons);
  } catch (error) {
    console.error("[AI Trigger] Error:", error);
    await sendMessage(chatId, "AI下書きの生成に失敗しました。");
  }
}

// Handle reply generation
async function handleReplyTrigger(message: any, groupChat: any) {
  const text = message.text;
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();

  // Similar to AI trigger but focused on finding unanswered questions
  await sendMessage(chatId, "返答生成機能は実装中です。");
}

// Handle callback queries (button clicks)
async function handleCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id.toString();
  const messageId = callbackQuery.message?.message_id;
  const chatId = callbackQuery.message?.chat?.id?.toString();

  // Task deadline selection
  if (data.startsWith("task_deadline_")) {
    await handleTaskDeadlineSelection(data, userId, chatId, messageId);
  }

  // Meeting type selection
  if (data.startsWith("meeting_type_")) {
    await handleMeetingTypeSelection(data, userId, chatId, messageId);
  }

  // Draft actions
  if (data.startsWith("draft_")) {
    await handleDraftAction(data, userId, chatId, messageId);
  }
  
  // Translation language selection
  if (data.startsWith("trans_start_") && chatId) {
    await handleTranslationCallback(data, userId, chatId);
  }
  
  // Group registration
  if (data.startsWith("register_group_") && chatId) {
    await handleGroupRegistration(data, userId, chatId, messageId);
  }
  
  // Meeting reminder setup
  if (data.startsWith("set_meeting_reminder_") && chatId) {
    await handleMeetingReminderSetup(data, userId, chatId, messageId);
  }
  
  // Task completion
  if (data.startsWith("task_complete_") && chatId) {
    await handleTaskCompletion(data, userId, chatId, messageId);
  }
  
  // Recurring task frequency selection
  if (data.startsWith("recurring_freq_") && chatId) {
    await handleRecurringFrequencySelection(data, userId, chatId, messageId);
  }
  
  // Recurring task day of week selection
  if (data.startsWith("recurring_dow_") && chatId) {
    await handleRecurringDayOfWeekSelection(data, userId, chatId, messageId);
  }
  
  // Recurring task exclude days selection
  if (data.startsWith("recurring_exclude_") && chatId) {
    await handleRecurringExcludeDaysSelection(data, userId, chatId, messageId);
  }
  
  // Recurring task completion
  if (data.startsWith("rt_complete:") && chatId) {
    await handleRecurringTaskCompletion(data, userId, chatId, messageId, callbackQuery.from);
  }

  // Acknowledge callback
  await answerCallbackQuery(callbackQuery.id, "処理しました");
}

async function handleTaskDeadlineSelection(
  data: string,
  userId: string,
  chatId: string | undefined,
  messageId: number | undefined
) {
  // Extract deadline type and task message ID
  const parts = data.split("_");
  const deadlineType = parts[2];
  const taskMessageId = parts[3]; // Get the original task message ID

  let dueDate: Date | undefined;
  const now = new Date();

  switch (deadlineType) {
    case "today":
      dueDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case "tomorrow":
      dueDate = new Date(now.setDate(now.getDate() + 1));
      dueDate.setHours(23, 59, 59, 999);
      break;
    case "3days":
      dueDate = new Date(now.setDate(now.getDate() + 3));
      dueDate.setHours(23, 59, 59, 999);
      break;
    case "custom":
      // Store pending custom date request
      if (chatId && taskMessageId) {
        pendingCustomDateTasks.set(chatId, taskMessageId);
        await sendMessage(chatId, "📅 期限の日付を入力してください\n\n例: 2026/2/15 または 2/15");
      }
      return; // Don't proceed to set deadline yet
  }

  if (chatId && dueDate) {
    // Update task in database with due date
    if (taskMessageId) {
      const task = await getTaskByMessageId(taskMessageId);
      if (task) {
        await updateTask(task.id, { dueAt: dueDate, status: "in_progress" });
      }
    }
    
    // Send message with task completion button
    const deadlineMessage = `タスクの期限を ${dueDate.toLocaleDateString("ja-JP")} に設定しました\n\n完了したら下記のボタンを押してください。期限を過ぎても完了ボタンが押されていない場合、３時間ごとにリマインダーが送られます。`;
    
    const completeButton = [
      [{ text: "✅ タスク完了", callback_data: `task_complete_${taskMessageId}` }]
    ];
    
    await sendMessageWithButtons(chatId, deadlineMessage, completeButton);
  }
}

async function handleCustomDateInput(
  chatId: string,
  text: string,
  taskMessageId: string
): Promise<boolean> {
  // Try to parse the date from user input
  // Supported formats: 2026/2/15, 2/15, 2-15, 2月15日
  const now = new Date();
  let dueDate: Date | null = null;
  
  // Try full date format: YYYY/M/D or YYYY-M-D
  const fullDateMatch = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
  }
  
  // Try short date format: M/D or M-D
  if (!dueDate) {
    const shortDateMatch = text.match(/(\d{1,2})[\/-](\d{1,2})/);
    if (shortDateMatch) {
      const [, month, day] = shortDateMatch;
      let year = now.getFullYear();
      // If the date is in the past, assume next year
      const testDate = new Date(year, parseInt(month) - 1, parseInt(day));
      if (testDate < now) {
        year++;
      }
      dueDate = new Date(year, parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
    }
  }
  
  // Try Japanese format: M月D日
  if (!dueDate) {
    const jpDateMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
    if (jpDateMatch) {
      const [, month, day] = jpDateMatch;
      let year = now.getFullYear();
      const testDate = new Date(year, parseInt(month) - 1, parseInt(day));
      if (testDate < now) {
        year++;
      }
      dueDate = new Date(year, parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
    }
  }
  
  if (!dueDate || isNaN(dueDate.getTime())) {
    await sendMessage(chatId, "日付の形式が認識できませんでした。\n例: 2026/2/15 または 2/15 の形式で入力してください。");
    return false;
  }
  
  // Update task in database
  const task = await getTaskByMessageId(taskMessageId);
  if (task) {
    await updateTask(task.id, { dueAt: dueDate, status: "in_progress" });
  }
  
  // Send confirmation with completion button
  const deadlineMessage = `タスクの期限を ${dueDate.toLocaleDateString("ja-JP")} に設定しました\n\n完了したら下記のボタンを押してください。期限を過ぎても完了ボタンが押されていない場合、３時間ごとにリマインダーが送られます。`;
  
  const completeButton = [
    [{ text: "✅ タスク完了", callback_data: `task_complete_${taskMessageId}` }]
  ];
  
  await sendMessageWithButtons(chatId, deadlineMessage, completeButton);
  return true;
}

async function handleInPersonMeetingLocation(
  chatId: string,
  location: string,
  meetingInfo: {
    title: string;
    datetime: string;
    attendees: string[];
    userId: string;
  }
) {
  // Build confirmation message with location
  let confirmMessage = "✅ 対面ミーティングを設定しました\n\n";
  confirmMessage += `📅 日時: ${meetingInfo.datetime}\n`;
  confirmMessage += `📍 場所: ${location}\n`;
  if (meetingInfo.attendees && meetingInfo.attendees.length > 0) {
    const attendeeList = meetingInfo.attendees.map(a => a.startsWith('@') ? a : `@${a}`).join(', ');
    confirmMessage += `👥 参加者: ${attendeeList}\n`;
  }
  
  // Create meeting in database
  try {
    const groupChat = await getGroupChat(chatId);
    if (groupChat) {
      // Parse datetime to get start time
      const parsedDatetime = parseMeetingDatetime(meetingInfo.datetime, "Asia/Manila");
      const startAt = parsedDatetime || new Date();
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1 hour later
      
      await createMeeting({
        groupChatId: chatId,
        title: meetingInfo.title || "対面ミーティング",
        meetUrl: `場所: ${location}`,
        startAt: startAt,
        endAt: endAt,
        creatorId: meetingInfo.userId,
        meetingType: "in_person",
      });
    }
  } catch (error) {
    console.error("[Meeting] Failed to save in-person meeting:", error);
  }
  
  await sendMessage(chatId, confirmMessage);
  
  // Clean up pending meetings
  pendingMeetings.delete(chatId);
}

async function handleTaskCompletion(
  data: string,
  userId: string,
  chatId: string,
  messageId: number | undefined
) {
  // Extract task message ID from callback data
  const taskMessageId = data.replace("task_complete_", "");
  
  if (!taskMessageId) {
    await sendMessage(chatId, "タスクが見つかりませんでした。");
    return;
  }
  
  // Get task from database
  const task = await getTaskByMessageId(taskMessageId);
  
  if (!task) {
    await sendMessage(chatId, "タスクが見つかりませんでした。");
    return;
  }
  
  // Update task status to completed
  await updateTask(task.id, { 
    status: "completed",
    updatedAt: new Date()
  });
  
  // Send completion confirmation to the chat
  await sendMessage(chatId, `✅ タスク「${task.title}」が完了しました！`);
  
  // Send notification to the requester (task creator)
  if (task.requesterId && task.requesterId !== userId) {
    try {
      // Get the group chat to find the requester
      const completionNotice = `🎉 タスク完了のお知らせ\n\nタスク「${task.title}」が @${task.assigneeId} さんによって完了されました。`;
      
      // Send to the same group chat (requester will see it)
      await sendMessage(chatId, completionNotice);
    } catch (error) {
      console.error("[Task Completion] Failed to send notification to requester:", error);
    }
  }
  
  // Log the completion
  await createAuditLog({
    action: "task_completed",
    userId: userId,
    objectType: "task",
    objectId: task.id.toString(),
    payload: JSON.stringify({ taskTitle: task.title, assigneeId: task.assigneeId }),
  });
}

async function handleMeetingTypeSelection(
  data: string,
  userId: string,
  chatId: string | undefined,
  messageId: number | undefined
) {
  const meetingType = data.replace("meeting_type_", "");

  if (!chatId) return;
  
  // Get pending meeting info
  const meetingInfo = pendingMeetings.get(chatId);

  if (meetingType === "meet") {
    // Google Meetを選択した場合、即座にMeetリンクを生成
    await sendMessage(chatId, "🔄 Google Meetリンクを生成中...");
    
    try {
      const { createQuickMeetLink, isGoogleCalendarConnected } = await import("../integrations/googleCalendar");
      
      // Google Calendarが接続されているか確認
      const isConnected = await isGoogleCalendarConnected();
      if (!isConnected) {
        await sendMessage(chatId, "⚠️ Googleアカウントが連携されていません。\n\n管理画面の「設定」→「Google」タブからGoogleアカウントを連携してください。");
        return;
      }
      
      // Get timezone setting
      const db = await getDb();
      let timezone = 'Asia/Manila';
      if (db) {
        const tzSetting = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'timezone')).limit(1);
        if (tzSetting[0]?.settingValue) {
          timezone = tzSetting[0].settingValue;
        }
      }
      
      // Parse meeting datetime if available
      let startTime: Date | undefined;
      let endTime: Date | undefined;
      if (meetingInfo?.datetime) {
        const parsedDate = parseMeetingDatetime(meetingInfo.datetime, timezone);
        if (parsedDate) {
          startTime = parsedDate;
          endTime = new Date(parsedDate.getTime() + 60 * 60 * 1000); // 1 hour duration
        }
      }
      
      // Meetリンクを生成（ミーティング情報を渡す）
      const meetingTitle = meetingInfo?.rawText || "ミーティング";
      const result = await createQuickMeetLink(meetingTitle, {
        startTime,
        endTime,
        description: meetingInfo?.attendees?.length 
          ? `参加者: ${meetingInfo.attendees.join(', ')}` 
          : undefined,
      });
      
      if (result.success && result.meetLink) {
        // Map timezone to friendly label
        const tzLabels: Record<string, string> = {
          'Asia/Manila': 'フィリピン時間',
          'Asia/Tokyo': '日本時間',
          'Asia/Singapore': 'シンガポール時間',
          'Asia/Hong_Kong': '香港時間',
          'America/New_York': 'ニューヨーク時間',
          'America/Los_Angeles': 'ロサンゼルス時間',
          'Europe/London': 'ロンドン時間',
          'UTC': 'UTC',
        };
        const timezoneLabel = tzLabels[timezone] || timezone;
        
        // Build formatted confirmation message
        let confirmMessage = "✅ Google Meetミーティングを設定しました\n\n";
        confirmMessage += "───────────────\n";
        
        // Add datetime if available with timezone
        if (meetingInfo?.datetime) {
          confirmMessage += `📅 日時: ${meetingInfo.datetime} (${timezoneLabel})\n`;
        }
        
        // Add attendees if available
        if (meetingInfo?.attendees && meetingInfo.attendees.length > 0) {
          const attendeeList = meetingInfo.attendees.map(a => a.startsWith('@') ? a : `@${a}`).join(', ');
          confirmMessage += `👥 参加者: ${attendeeList}\n`;
        }
        
        confirmMessage += `🔗 Meet: ${result.meetLink}\n`;
        confirmMessage += "───────────────\n\n";
        confirmMessage += "参加される皆様、よろしくお願いいたします。";
        
        // Store meeting info for potential reminder setup
        const meetingId = `meeting_${Date.now()}_${chatId}`;
        pendingMeetingReminders.set(meetingId, {
          chatId,
          userId,
          meetLink: result.meetLink,
          datetime: meetingInfo?.datetime,
          attendees: meetingInfo?.attendees,
          title: meetingTitle,
          timezone,
          timezoneLabel,
        });
        
        // Send message with reminder button
        await sendMessageWithButtons(
          chatId,
          confirmMessage,
          [
            [{ text: "🔔 リマインダーを設定する", callback_data: `set_meeting_reminder_${meetingId}` }],
          ]
        );
        
        // Clean up pending meeting info
        pendingMeetings.delete(chatId);
      } else {
        await sendMessage(chatId, `❌ Meetリンクの生成に失敗しました: ${result.error || "不明なエラー"}`);
      }
    } catch (error) {
      console.error("[Meeting] Failed to create Meet link:", error);
      await sendMessage(chatId, "❌ Meetリンクの生成中にエラーが発生しました。");
    }
  } else if (meetingType === "inperson") {
    // Build formatted message for in-person meeting
    let confirmMessage = "📍 対面ミーティングを選択しました\n\n";
    
    if (meetingInfo) {
      if (meetingInfo.datetime) {
        confirmMessage += `📅 日時: ${meetingInfo.datetime}\n`;
      }
      if (meetingInfo.attendees && meetingInfo.attendees.length > 0) {
        const attendeeList = meetingInfo.attendees.map(a => a.startsWith('@') ? a : `@${a}`).join(', ');
        confirmMessage += `👥 参加者: ${attendeeList}\n`;
      }
      confirmMessage += "\n";
      
      // Store pending in-person meeting for location input
      pendingInPersonMeetings.set(chatId, {
        title: meetingInfo.title,
        datetime: meetingInfo.datetime,
        attendees: meetingInfo.attendees,
        userId: userId,
      });
    }
    
    confirmMessage += "場所を教えてください。";
    await sendMessage(chatId, confirmMessage);
  } else {
    await sendMessage(chatId, `📝 ミーティング形式: ${meetingType} を選択しました。`);
    pendingMeetings.delete(chatId);
  }
}

// Handle meeting reminder setup callback
async function handleMeetingReminderSetup(
  data: string,
  userId: string,
  chatId: string,
  messageId: number | undefined
) {
  // Extract meeting ID from callback data
  const meetingId = data.replace("set_meeting_reminder_", "");
  
  // Get pending meeting reminder info
  const meetingInfo = pendingMeetingReminders.get(meetingId);
  
  if (!meetingInfo) {
    await sendMessage(chatId, "❌ ミーティング情報が見つかりませんでした。");
    return;
  }
  
  // Get reminder minutes from settings
  const db = await getDb();
  if (!db) {
    await sendMessage(chatId, "❌ データベースエラーが発生しました。");
    return;
  }
  
  // Get reminder time setting (default 15 minutes)
  const reminderMinutesRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'meeting_reminder_minutes')).limit(1);
  const reminderMinutes = reminderMinutesRow[0]?.settingValue ? parseInt(reminderMinutesRow[0].settingValue) : 15;
  
  if (!meetingInfo.datetime) {
    await sendMessage(chatId, "❌ ミーティングの日時が設定されていないため、リマインダーを設定できません。");
    return;
  }
  
  try {
    // Parse meeting datetime
    const meetingDatetime = parseMeetingDatetime(meetingInfo.datetime, meetingInfo.timezone);
    
    if (!meetingDatetime || meetingDatetime <= new Date()) {
      await sendMessage(chatId, "❌ ミーティングの日時が過去のため、リマインダーを設定できません。");
      return;
    }
    
    // Calculate reminder time
    const reminderTime = new Date(meetingDatetime.getTime() - reminderMinutes * 60 * 1000);
    
    if (reminderTime <= new Date()) {
      await sendMessage(chatId, `❌ リマインダー時刻（${reminderMinutes}分前）が既に過ぎています。`);
      return;
    }
    
    // Build attendee list for reminder message
    const attendeeList = meetingInfo.attendees && meetingInfo.attendees.length > 0
      ? meetingInfo.attendees.map(a => a.startsWith('@') ? a : `@${a}`).join(', ')
      : '';
    
    // Create secretary-style reminder message
    let reminderMessage = `🔔 ミーティングのお時間が近づいてまいりました\n\n`;
    reminderMessage += `───────────────\n`;
    reminderMessage += `📅 日時: ${meetingInfo.datetime} (${meetingInfo.timezoneLabel})\n`;
    if (attendeeList) {
      reminderMessage += `👥 参加者: ${attendeeList}\n`;
    }
    reminderMessage += `🔗 Meet: ${meetingInfo.meetLink}\n`;
    reminderMessage += `───────────────\n\n`;
    reminderMessage += `開始まであと${reminderMinutes}分です。ご準備をお願いいたします。`;
    
    // Create reminder in database
    await createReminder({
      chatId: meetingInfo.chatId,
      userId: meetingInfo.userId,
      message: reminderMessage,
      remindAt: reminderTime,
      status: "pending",
      repeatType: "none",
      repeatDays: null,
      eventName: meetingInfo.title,
      reminderMinutesBefore: reminderMinutes,
    });
    
    // Send confirmation
    await sendMessage(chatId, `✅ リマインダーを設定しました！\n\n🔔 ミーティング開始の${reminderMinutes}分前にお知らせします。`);
    
    console.log(`[Meeting] Created ${reminderMinutes}-minute reminder for meeting at ${meetingDatetime.toISOString()}`);
    
    // Clean up pending meeting reminder info
    pendingMeetingReminders.delete(meetingId);
    
  } catch (error) {
    console.error("[Meeting] Failed to create reminder:", error);
    await sendMessage(chatId, "❌ リマインダーの設定中にエラーが発生しました。");
  }
}

async function handleDraftAction(
  data: string,
  userId: string,
  chatId: string | undefined,
  messageId: number | undefined
) {
  const parts = data.split("_");
  const action = parts[1];
  const draftId = parts[2];
  
  // Validate draft ID
  if (!draftId || isNaN(parseInt(draftId))) {
    await sendMessage(userId, "無効な下書きIDです。");
    return;
  }

  // Get draft from database
  const db = await getDb();
  if (!db) return;

  const drafts = await db.select().from(draftsTable).where(eq(draftsTable.id, parseInt(draftId))).limit(1);
  if (drafts.length === 0) {
    await sendMessage(userId, "下書きが見つかりませんでした。");
    return;
  }

  const draft = drafts[0];

  if (action === "post") {
    // Post draft to original group chat
    if (draft.targetGroupChatId) {
      await sendMessage(draft.targetGroupChatId, draft.draftText);
    }
    
    // Update draft status
    await db.update(draftsTable).set({ status: "approved" }).where(eq(draftsTable.id, parseInt(draftId)));
    
    // Confirm to user
    await sendMessage(userId, "✅ 下書きをグループチャットに投稿しました。");
    
    await createAuditLog({
      action: "draft_posted",
      userId,
      objectType: "draft",
      objectId: draftId,
      payload: `Posted to group ${draft.targetGroupChatId}`,
    });
  } else if (action === "edit") {
    // Set draft status to editing
    await db.update(draftsTable).set({ status: "editing" }).where(eq(draftsTable.id, parseInt(draftId)));
    
    // Send edit instructions
    await sendMessage(
      userId,
      `📝 編集モードに入りました。\n\n現在の内容:\n${draft.draftText}\n\n新しい内容をそのまま送信してください。送信した内容で下書きが更新されます。`
    );
  } else if (action === "discard") {
    // Update draft status to rejected
    await db.update(draftsTable).set({ status: "rejected" }).where(eq(draftsTable.id, parseInt(draftId)));
    
    // Confirm to user
    await sendMessage(userId, "🗑️ 下書きを破棄しました。");
    
    await createAuditLog({
      action: "draft_discarded",
      userId,
      objectType: "draft",
      objectId: draftId,
    });
  }
}

// Handle draft editing from DM
async function handleDraftEdit(userId: string, newText: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Find draft in editing status for this user
  const editingDrafts = await db.select()
    .from(draftsTable)
    .where(and(eq(draftsTable.ownerId, userId), eq(draftsTable.status, "editing")))
    .limit(1);

  if (editingDrafts.length === 0) {
    return false; // No draft being edited
  }

  const draft = editingDrafts[0];

  // Update draft with new text
  await db.update(draftsTable)
    .set({ 
      draftText: newText,
      status: "pending_approval"
    })
    .where(eq(draftsTable.id, draft.id));

  // Send updated draft with action buttons
  const buttons = [
    [
      { text: "投稿", callback_data: `draft_post_${draft.id}` },
      { text: "編集", callback_data: `draft_edit_${draft.id}` },
    ],
    [{ text: "破棄", callback_data: `draft_discard_${draft.id}` }],
  ];

  await sendMessageWithButtons(
    userId,
    `✅ 下書きを更新しました。\n\n${newText}`,
    buttons
  );

  return true;
}


// ==================== Recurring Task Functions ====================

// Pending recurring task setup state
const pendingRecurringTasks = new Map<string, {
  step: 'frequency' | 'day_of_week' | 'day_of_month' | 'time' | 'exclude_days' | 'task_title' | 'assignee';
  frequency?: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  excludeDays?: string; // Comma-separated days to exclude (e.g., "0,6" for Sun,Sat)
  hour?: number;
  minute?: number;
  taskTitle?: string;
  assigneeMention?: string;
  assigneeId?: string;
  creatorId: string;
}>();

// Handle recurring task trigger
async function handleRecurringTaskTrigger(message: any, groupChat: any) {
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();
  const text = message.text;

  // Parse the message to extract any pre-filled information
  const taskText = text.replace("【定期タスク】", "").trim();
  
  // Initialize pending recurring task
  pendingRecurringTasks.set(chatId, {
    step: 'frequency',
    creatorId: userId,
  });
  
  // Send frequency selection buttons
  const buttons = [
    [
      { text: "📅 毎日", callback_data: "recurring_freq_daily" },
      { text: "📅 毎週", callback_data: "recurring_freq_weekly" },
      { text: "📅 毎月", callback_data: "recurring_freq_monthly" },
    ],
  ];
  
  await sendMessageWithButtons(
    chatId,
    "🔁 定期タスクを設定します\n\nまず、頻度を選択してください。",
    buttons
  );
}

// Handle recurring task frequency selection
async function handleRecurringFrequencySelection(
  data: string,
  userId: string,
  chatId: string,
  messageId: number | undefined
) {
  const frequency = data.replace("recurring_freq_", "") as 'daily' | 'weekly' | 'monthly';
  
  const pending = pendingRecurringTasks.get(chatId);
  if (!pending) {
    await sendMessage(chatId, "❗ 定期タスクの設定が見つかりませんでした。もう一度【定期タスク】と入力してください。");
    return;
  }
  
  pending.frequency = frequency;
  
  if (frequency === 'daily') {
    // Daily: show exclude days selection
    pending.step = 'exclude_days';
    const excludeButtons = [
      [
        { text: "日", callback_data: "recurring_exclude_0" },
        { text: "月", callback_data: "recurring_exclude_1" },
        { text: "火", callback_data: "recurring_exclude_2" },
        { text: "水", callback_data: "recurring_exclude_3" },
      ],
      [
        { text: "木", callback_data: "recurring_exclude_4" },
        { text: "金", callback_data: "recurring_exclude_5" },
        { text: "土", callback_data: "recurring_exclude_6" },
      ],
      [
        { text: "✅ 除外なし（毎日配信）", callback_data: "recurring_exclude_done" },
      ],
    ];
    await sendMessageWithButtons(
      chatId,
      "📅 配信しない曜日を選択してください\n\n複数選択可能です。選択が終わったら「除外なし」または「次へ」を押してください。",
      excludeButtons
    );
  } else if (frequency === 'weekly') {
    // Weekly: show day of week selection
    pending.step = 'day_of_week';
    const buttons = [
      [
        { text: "日", callback_data: "recurring_dow_0" },
        { text: "月", callback_data: "recurring_dow_1" },
        { text: "火", callback_data: "recurring_dow_2" },
        { text: "水", callback_data: "recurring_dow_3" },
      ],
      [
        { text: "木", callback_data: "recurring_dow_4" },
        { text: "金", callback_data: "recurring_dow_5" },
        { text: "土", callback_data: "recurring_dow_6" },
      ],
    ];
    await sendMessageWithButtons(chatId, "📅 曜日を選択してください", buttons);
  } else if (frequency === 'monthly') {
    // Monthly: ask for day of month
    pending.step = 'day_of_month';
    await sendMessage(chatId, "📅 毎月何日にリマインダーを送信しますか？\n\n例: 1 または 15");
  }
  
  pendingRecurringTasks.set(chatId, pending);
}

// Handle exclude days selection for daily recurring tasks
async function handleRecurringExcludeDaysSelection(
  data: string,
  userId: string,
  chatId: string,
  messageId: number | undefined
) {
  const pending = pendingRecurringTasks.get(chatId);
  if (!pending) {
    await sendMessage(chatId, "❗ 定期タスクの設定が見つかりませんでした。");
    return;
  }
  
  const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
  
  if (data === "recurring_exclude_done" || data === "recurring_exclude_next") {
    // Done selecting, move to time input
    pending.step = 'time';
    pendingRecurringTasks.set(chatId, pending);
    
    const excludeInfo = pending.excludeDays 
      ? `除外曜日: ${pending.excludeDays.split(',').map(d => DAY_NAMES[parseInt(d)]).join('、')}曜日`
      : "除外なし（毎日配信）";
    
    await sendMessage(chatId, `✅ ${excludeInfo}\n\n⏰ リマインダーを送信する時間を入力してください\n\n例: 9:00 または 14:30`);
    return;
  }
  
  // Toggle exclude day
  const dayToToggle = data.replace("recurring_exclude_", "");
  const currentExcludeDays = pending.excludeDays ? pending.excludeDays.split(',') : [];
  
  if (currentExcludeDays.includes(dayToToggle)) {
    // Remove from excluded days
    const newExcludeDays = currentExcludeDays.filter(d => d !== dayToToggle);
    pending.excludeDays = newExcludeDays.length > 0 ? newExcludeDays.join(',') : undefined;
  } else {
    // Add to excluded days
    currentExcludeDays.push(dayToToggle);
    pending.excludeDays = currentExcludeDays.join(',');
  }
  
  pendingRecurringTasks.set(chatId, pending);
  
  // Show updated selection
  const selectedDays = pending.excludeDays 
    ? pending.excludeDays.split(',').map(d => DAY_NAMES[parseInt(d)]).join('、')
    : "なし";
  
  const excludeButtons = [
    [
      { text: pending.excludeDays?.includes('0') ? "✅ 日" : "日", callback_data: "recurring_exclude_0" },
      { text: pending.excludeDays?.includes('1') ? "✅ 月" : "月", callback_data: "recurring_exclude_1" },
      { text: pending.excludeDays?.includes('2') ? "✅ 火" : "火", callback_data: "recurring_exclude_2" },
      { text: pending.excludeDays?.includes('3') ? "✅ 水" : "水", callback_data: "recurring_exclude_3" },
    ],
    [
      { text: pending.excludeDays?.includes('4') ? "✅ 木" : "木", callback_data: "recurring_exclude_4" },
      { text: pending.excludeDays?.includes('5') ? "✅ 金" : "金", callback_data: "recurring_exclude_5" },
      { text: pending.excludeDays?.includes('6') ? "✅ 土" : "土", callback_data: "recurring_exclude_6" },
    ],
    [
      { text: "➡️ 次へ", callback_data: "recurring_exclude_next" },
    ],
  ];
  
  await sendMessageWithButtons(
    chatId,
    `📅 配信しない曜日を選択してください\n\n現在の選択: ${selectedDays}曜日\n\n選択が終わったら「次へ」を押してください。`,
    excludeButtons
  );
}

// Handle day of week selection for weekly recurring tasks
async function handleRecurringDayOfWeekSelection(
  data: string,
  userId: string,
  chatId: string,
  messageId: number | undefined
) {
  const dayOfWeek = parseInt(data.replace("recurring_dow_", ""));
  
  const pending = pendingRecurringTasks.get(chatId);
  if (!pending) {
    await sendMessage(chatId, "❗ 定期タスクの設定が見つかりませんでした。");
    return;
  }
  
  pending.dayOfWeek = dayOfWeek;
  pending.step = 'time';
  pendingRecurringTasks.set(chatId, pending);
  
  await sendMessage(chatId, "⏰ リマインダーを送信する時間を入力してください\n\n例: 9:00 または 14:30");
}

// Handle recurring task text input (time, day of month, task title, assignee)
async function handleRecurringTaskInput(chatId: string, text: string): Promise<boolean> {
  const pending = pendingRecurringTasks.get(chatId);
  if (!pending) return false;
  
  const trimmedText = text.trim();
  
  if (pending.step === 'day_of_month') {
    // Parse day of month
    const dayMatch = trimmedText.match(/^(\d{1,2})/);
    if (!dayMatch) {
      await sendMessage(chatId, "❗ 日付の形式が認識できませんでした。数字で入力してください（例: 15）");
      return true;
    }
    
    const dayOfMonth = parseInt(dayMatch[1]);
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      await sendMessage(chatId, "❗ 1から31の間で入力してください。");
      return true;
    }
    
    pending.dayOfMonth = dayOfMonth;
    pending.step = 'time';
    pendingRecurringTasks.set(chatId, pending);
    
    await sendMessage(chatId, "⏰ リマインダーを送信する時間を入力してください\n\n例: 9:00 または 14:30");
    return true;
  }
  
  if (pending.step === 'time') {
    // Parse time (HH:MM or H:MM)
    const timeMatch = trimmedText.match(/^(\d{1,2})[::：](\d{2})/);
    if (!timeMatch) {
      await sendMessage(chatId, "❗ 時間の形式が認識できませんでした。\n例: 9:00 または 14:30");
      return true;
    }
    
    const hour = parseInt(timeMatch[1]);
    const minute = parseInt(timeMatch[2]);
    
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      await sendMessage(chatId, "❗ 時間は0:00から23:59の間で入力してください。");
      return true;
    }
    
    pending.hour = hour;
    pending.minute = minute;
    pending.step = 'task_title';
    pendingRecurringTasks.set(chatId, pending);
    
    await sendMessage(chatId, "📝 タスクの内容を入力してください\n\n例: 週次レポートの提出");
    return true;
  }
  
  if (pending.step === 'task_title') {
    pending.taskTitle = trimmedText;
    pending.step = 'assignee';
    pendingRecurringTasks.set(chatId, pending);
    
    await sendMessage(chatId, "👤 担当者を@メンションで入力してください\n\n例: @tanaka");
    return true;
  }
  
  if (pending.step === 'assignee') {
    // Extract mention
    const mentionMatch = trimmedText.match(/@(\w+)/);
    if (!mentionMatch) {
      await sendMessage(chatId, "❗ @メンションの形式で入力してください\n例: @tanaka");
      return true;
    }
    
    pending.assigneeMention = `@${mentionMatch[1]}`;
    pending.assigneeId = mentionMatch[1];
    
    // All information collected, create the recurring task
    await createRecurringTaskFromPending(chatId, pending);
    pendingRecurringTasks.delete(chatId);
    return true;
  }
  
  return false;
}

// Create recurring task from pending data
async function createRecurringTaskFromPending(
  chatId: string,
  pending: {
    frequency?: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    excludeDays?: string;
    hour?: number;
    minute?: number;
    taskTitle?: string;
    assigneeMention?: string;
    assigneeId?: string;
    creatorId: string;
  }
) {
  if (!pending.frequency || pending.hour === undefined || !pending.taskTitle || !pending.assigneeId) {
    await sendMessage(chatId, "❗ 定期タスクの情報が不完全です。もう一度設定してください。");
    return;
  }
  
  // Calculate next send time
  const nextSendAt = calculateNextSendTime(
    pending.frequency,
    pending.hour,
    pending.minute || 0,
    pending.dayOfWeek,
    pending.dayOfMonth
  );
  
  try {
    await createRecurringTask({
      chatId,
      creatorId: pending.creatorId,
      assigneeId: pending.assigneeId,
      assigneeMention: pending.assigneeMention,
      taskTitle: pending.taskTitle,
      frequency: pending.frequency,
      dayOfWeek: pending.dayOfWeek,
      dayOfMonth: pending.dayOfMonth,
      excludeDays: pending.excludeDays,
      hour: pending.hour,
      minute: pending.minute || 0,
      isActive: 1,
      nextSendAt,
    });
    
    // Build confirmation message
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    let scheduleText = '';
    
    if (pending.frequency === 'daily') {
      const excludeInfo = pending.excludeDays 
        ? `（${pending.excludeDays.split(',').map(d => dayNames[parseInt(d)]).join('、')}曜日除く）`
        : '';
      scheduleText = `毎日 ${pending.hour}:${String(pending.minute || 0).padStart(2, '0')}${excludeInfo}`;
    } else if (pending.frequency === 'weekly') {
      scheduleText = `毎週${dayNames[pending.dayOfWeek || 0]}曜日 ${pending.hour}:${String(pending.minute || 0).padStart(2, '0')}`;
    } else if (pending.frequency === 'monthly') {
      scheduleText = `毎月${pending.dayOfMonth}日 ${pending.hour}:${String(pending.minute || 0).padStart(2, '0')}`;
    }
    
    let confirmMessage = `✅ 定期タスクを設定しました\n\n`;
    confirmMessage += `📅 スケジュール: ${scheduleText}\n`;
    confirmMessage += `📝 タスク: ${pending.taskTitle}\n`;
    confirmMessage += `👤 担当者: ${pending.assigneeMention}\n\n`;
    confirmMessage += `次回のリマインダー: ${nextSendAt.toLocaleString('ja-JP', { timeZone: 'Asia/Manila' })}`;
    
    await sendMessage(chatId, confirmMessage);
    
    await createAuditLog({
      action: "recurring_task_created",
      userId: pending.creatorId,
      objectType: "recurring_task",
      payload: JSON.stringify({ taskTitle: pending.taskTitle, frequency: pending.frequency }),
    });
    
  } catch (error) {
    console.error("[Recurring Task] Failed to create:", error);
    await sendMessage(chatId, "❗ 定期タスクの作成に失敗しました。");
  }
}

// Calculate next send time based on frequency
function calculateNextSendTime(
  frequency: 'daily' | 'weekly' | 'monthly',
  hour: number,
  minute: number,
  dayOfWeek?: number,
  dayOfMonth?: number
): Date {
  // Use Philippines timezone (UTC+8)
  const now = new Date();
  const phOffset = 8 * 60; // UTC+8 in minutes
  const localOffset = now.getTimezoneOffset();
  const phNow = new Date(now.getTime() + (phOffset + localOffset) * 60 * 1000);
  
  let nextSend = new Date(phNow);
  nextSend.setHours(hour, minute, 0, 0);
  
  if (frequency === 'daily') {
    // If time has passed today, schedule for tomorrow
    if (nextSend <= phNow) {
      nextSend.setDate(nextSend.getDate() + 1);
    }
  } else if (frequency === 'weekly' && dayOfWeek !== undefined) {
    // Find next occurrence of the specified day of week
    const currentDay = phNow.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && nextSend <= phNow)) {
      daysUntil += 7;
    }
    nextSend.setDate(nextSend.getDate() + daysUntil);
  } else if (frequency === 'monthly' && dayOfMonth !== undefined) {
    // Find next occurrence of the specified day of month
    nextSend.setDate(dayOfMonth);
    if (nextSend <= phNow) {
      nextSend.setMonth(nextSend.getMonth() + 1);
    }
  }
  
  // Convert back to UTC for storage
  return new Date(nextSend.getTime() - (phOffset + localOffset) * 60 * 1000);
}

// Handle recurring task completion
async function handleRecurringTaskCompletion(
  data: string,
  userId: string,
  chatId: string,
  messageId: number | undefined,
  fromUser: any
) {
  try {
    // Parse callback data: rt_complete:taskId:scheduledAt
    const parts = data.split(':');
    if (parts.length < 3) {
      await sendMessage(chatId, '❗ 完了報告の処理に失敗しました。');
      return;
    }
    
    const taskId = parseInt(parts[1]);
    const scheduledAt = parseInt(parts[2]);
    
    // Get the task to verify it exists
    const task = await getRecurringTaskById(taskId);
    if (!task) {
      await sendMessage(chatId, '❗ 定期タスクが見つかりませんでした。');
      return;
    }
    
    // Create completion record
    const completedByName = fromUser.first_name + (fromUser.last_name ? ` ${fromUser.last_name}` : '');
    
    await createRecurringTaskCompletion({
      recurringTaskId: taskId,
      chatId: chatId,
      completedBy: userId,
      completedByName: completedByName,
      scheduledAt: new Date(scheduledAt),
    });
    
    // Send confirmation message
    const now = new Date();
    const phOffset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const phNow = new Date(now.getTime() + (phOffset + localOffset) * 60 * 1000);
    const timeStr = `${phNow.getHours()}:${String(phNow.getMinutes()).padStart(2, '0')}`;
    
    const confirmMessage = `✅ 完了報告を受け付けました\n\n📝 ${task.taskTitle}\n👤 報告者: ${completedByName}\n⏰ 完了時刻: ${timeStr} (PHT)`;
    
    await sendMessage(chatId, confirmMessage);
    
    // Log the completion
    await createAuditLog({
      action: 'recurring_task_completed',
      userId: userId,
      objectType: 'recurring_task_completion',
      objectId: taskId.toString(),
      payload: JSON.stringify({
        taskTitle: task.taskTitle,
        completedBy: completedByName,
        scheduledAt: new Date(scheduledAt).toISOString(),
      }),
    });
    
    console.log(`[Recurring Task] Task ${taskId} completed by ${completedByName}`);
    
  } catch (error) {
    console.error('[Recurring Task Completion] Error:', error);
    await sendMessage(chatId, '❗ 完了報告の処理中にエラーが発生しました。');
  }
}

// ==================== Translation Functions ====================

// Supported languages
const SUPPORTED_LANGUAGES: Record<string, string> = {
  'ja': '日本語',
  'en': '英語',
  'zh': '中国語',
  'ko': '韓国語',
  'tl': 'タガログ語',
  'tgl-en': 'タグリッシュ'
};

// Default translation keywords
const DEFAULT_START_KEYWORDS = ['翻訳開始', '翻訳スタート', '通訳開始', '通訳スタート'];
const DEFAULT_END_KEYWORDS = ['翻訳終了', '翻訳ストップ', '翻訳停止', '通訳終了', '通訳ストップ', '通訳停止'];

// Detect language from text
async function detectLanguage(text: string): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a language detector. Analyze the given text and return ONLY the language code. Supported codes: ja (Japanese), en (English), zh (Chinese), ko (Korean), tl (Tagalog), tgl-en (Taglish - mix of Tagalog and English). If the text is a mix of Tagalog and English, return "tgl-en". Return only the code, nothing else.`
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 10
    });
    
    const content = response.choices[0]?.message?.content;
    const detected = (typeof content === 'string' ? content.trim().toLowerCase() : 'en') || 'en';
    console.log(`[Translation] Detected language: ${detected} for text: "${text.substring(0, 50)}..."`);
    return detected;
  } catch (error) {
    console.error("[Translation] Language detection error:", error);
    return 'en'; // Default to English
  }
}

// Translate text using AI
async function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
  try {
    const fromLangName = SUPPORTED_LANGUAGES[fromLang] || fromLang;
    const toLangName = SUPPORTED_LANGUAGES[toLang] || toLang;
    
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given text from ${fromLangName} to ${toLangName}. 
- Maintain the original tone and nuance
- For Taglish (tgl-en), preserve the natural mix of Tagalog and English
- Return ONLY the translated text, no explanations or notes
- If the text contains emojis, keep them in the translation`
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 2000
    });
    
    const content = response.choices[0]?.message?.content;
    const translated = (typeof content === 'string' ? content.trim() : text) || text;
    console.log(`[Translation] Translated from ${fromLang} to ${toLang}: "${text.substring(0, 30)}..." -> "${translated.substring(0, 30)}..."`);
    return translated;
  } catch (error) {
    console.error("[Translation] Translation error:", error);
    return text; // Return original on error
  }
}

// Get translation keywords from settings
async function getTranslationKeywords(): Promise<{ startKeywords: string[], endKeywords: string[] }> {
  const startKeywordsSetting = await getTranslationSetting('start_keywords');
  const endKeywordsSetting = await getTranslationSetting('end_keywords');
  
  const startKeywords = startKeywordsSetting 
    ? startKeywordsSetting.split(',').map(k => k.trim())
    : DEFAULT_START_KEYWORDS;
  
  const endKeywords = endKeywordsSetting
    ? endKeywordsSetting.split(',').map(k => k.trim())
    : DEFAULT_END_KEYWORDS;
  
  return { startKeywords, endKeywords };
}

// Handle translation start/end triggers
async function handleTranslationTrigger(message: any, chatId: string, userId: string): Promise<boolean> {
  const text = message.text;
  const { startKeywords, endKeywords } = await getTranslationKeywords();
  
  // Check for end keyword first
  for (const keyword of endKeywords) {
    if (text.includes(keyword)) {
      const session = await getActiveTranslationSession(chatId, userId);
      if (session) {
        await endTranslationSession(chatId, userId);
        await sendMessage(chatId, `🌐 翻訳モードを終了しました。\n\n通常のチャットに戻ります。`);
        console.log(`[Translation] Session ended for user ${userId} in chat ${chatId}`);
      } else {
        await sendMessage(chatId, `❌ アクティブな翻訳セッションがありません。`);
      }
      return true;
    }
  }
  
  // Check for start keyword
  for (const keyword of startKeywords) {
    if (text.includes(keyword)) {
      // Check if already in translation mode
      const existingSession = await getActiveTranslationSession(chatId, userId);
      if (existingSession) {
        await sendMessage(chatId, `⚠️ すでに翻訳モードです。\n\n終了するには「翻訳終了」と入力してください。`);
        return true;
      }
      
      // Start auto-detect translation mode (no language selection needed)
      await createTranslationSession({
        chatId,
        userId,
        isActive: 1,
        targetLanguage: 'auto', // Auto-detect mode
        myLanguage: 'ja'
      });
      
      await sendMessage(chatId, `🌐 翻訳モードを開始しました！\n\n相手の言語は自動で検出します。\n• あなたの日本語は相手の言語に翻訳されます\n• 相手のメッセージは日本語に翻訳されます\n\n終了するには「翻訳終了」と入力してください。`);
      console.log(`[Translation] Auto-detect session started for user ${userId} in chat ${chatId}`);
      return true;
    }
  }
  
  return false;
}

// Handle active translation session
// This function handles translation for:
// 1. The user who started the translation session (their own messages)
// 2. Other users' messages in the same chat (translated to Japanese for the session owner)
async function handleActiveTranslation(message: any, chatId: string, messageUserId: string): Promise<boolean> {
  // First, check if there's any active translation session in this chat
  const session = await getAnyActiveTranslationSessionInChat(chatId);
  if (!session) return false;
  
  const text = message.text;
  const sessionOwnerId = session.userId;
  
  // Skip if text is a command or trigger
  if (text.startsWith('/') || text.includes('【') || text.includes('】')) {
    return false;
  }
  
  // Check if this message is from the session owner or from others
  const isFromSessionOwner = messageUserId === sessionOwnerId;
  
  // Detect language of the message
  const detectedLang = await detectLanguage(text);
  
  // Determine translation direction based on who sent the message
  let fromLang: string;
  let toLang: string;
  
  if (isFromSessionOwner) {
    // Session owner's message: translate from Japanese to target language
    if (detectedLang === 'ja') {
      if (session.targetLanguage === 'auto') {
        // Can't translate Japanese without knowing target language
        return false;
      }
      fromLang = 'ja';
      toLang = session.targetLanguage;
    } else {
      // Session owner sent non-Japanese (maybe they're practicing)
      // Don't translate their own non-Japanese messages
      return false;
    }
  } else {
    // Other user's message: translate to Japanese for the session owner
    if (detectedLang === 'ja') {
      // Already in Japanese, no need to translate
      return false;
    }
    
    fromLang = detectedLang;
    toLang = 'ja';
    
    // Always update session with the latest detected language
    // This ensures the session owner's Japanese messages are translated to the most recent language
    await updateTranslationSessionLanguage(chatId, sessionOwnerId, detectedLang);
  }
  
  // Translate the message
  const translated = await translateText(text, fromLang, toLang);
  
  // Send translated message (translation only, no language indicator)
  await sendMessage(chatId, translated);
  
  return true;
}

// Handle translation language selection callback
export async function handleTranslationCallback(data: string, userId: string, chatId: string): Promise<boolean> {
  if (!data.startsWith('trans_start_')) return false;
  
  const parts = data.split('_');
  const targetLang = parts[2]; // e.g., 'en', 'zh', 'ko', 'tl', 'tgl-en'
  const requestUserId = parts[3];
  
  // Verify user
  if (userId !== requestUserId) {
    return true; // Ignore clicks from other users
  }
  
  // Create translation session
  await createTranslationSession({
    chatId,
    userId,
    isActive: 1,
    targetLanguage: targetLang,
    myLanguage: 'ja'
  });
  
  const targetLangName = SUPPORTED_LANGUAGES[targetLang] || targetLang;
  
  await sendMessage(chatId, `✅ 翻訳モードを開始しました！\n\n🌐 ${targetLangName} ⇔ 日本語\n\n• あなたが日本語で入力すると${targetLangName}に翻訳されます\n• ${targetLangName}のメッセージは日本語に翻訳されます\n\n終了するには「翻訳終了」と入力してください。`);
  
  console.log(`[Translation] Session started for user ${userId} in chat ${chatId}: ja <-> ${targetLang}`);
  
  return true;
}


// Handle chat ID request - show chat information
async function handleChatIdRequest(message: any) {
  const chat = message.chat;
  const user = message.from;
  
  const chatId = chat.id.toString();
  const chatType = chat.type;
  const chatTitle = chat.title || 'プライベートチャット';
  const userId = user.id.toString();
  const userName = user.username ? `@${user.username}` : user.first_name;
  
  // Determine chat type label
  let chatTypeLabel = '';
  switch (chatType) {
    case 'private':
      chatTypeLabel = 'プライベート';
      break;
    case 'group':
      chatTypeLabel = 'グループ';
      break;
    case 'supergroup':
      chatTypeLabel = 'スーパーグループ';
      break;
    case 'channel':
      chatTypeLabel = 'チャンネル';
      break;
    default:
      chatTypeLabel = chatType;
  }
  
  // Check if group is already registered
  const existingGroup = await getGroupChat(chatId);
  const isRegistered = !!existingGroup;
  
  let infoMessage = `📋 チャット情報

━━━━━━━━━━━━━━━━━━
🆔 チャットID: \`${chatId}\`
📝 チャット名: ${chatTitle}
📁 タイプ: ${chatTypeLabel}
━━━━━━━━━━━━━━━━━━

👤 あなたの情報
━━━━━━━━━━━━━━━━━━
🆔 ユーザーID: \`${userId}\`
📝 ユーザー名: ${userName}
━━━━━━━━━━━━━━━━━━`;
  
  if (isRegistered) {
    infoMessage += `\n\n✅ このグループは登録済みです`;
    await sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });
  } else if (chatType === 'group' || chatType === 'supergroup') {
    // Show registration button for groups
    const buttons = [
      [{ text: '➕ このグループを登録する', callback_data: `register_group_${chatId}_${userId}` }]
    ];
    await sendMessageWithButtons(chatId, infoMessage, buttons, { parse_mode: 'Markdown' });
  } else {
    await sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });
  }
  
  console.log(`[ChatID] Info requested in chat ${chatId} by user ${userId}, registered: ${isRegistered}`);
}


// Handle group registration from chat ID info
async function handleGroupRegistration(
  data: string,
  userId: string,
  chatId: string,
  messageId: number | undefined
) {
  try {
    // Parse callback data: register_group_{chatId}_{userId}
    const parts = data.split('_');
    const targetChatId = parts[2];
    const requestUserId = parts[3];
    
    // Get chat info from Telegram
    const { getTelegramBot } = await import('./bot');
    const bot = await getTelegramBot();
    if (!bot) {
      await sendMessage(chatId, '❌ ボットが設定されていません');
      return;
    }
    
    // Get chat details
    const chatInfo = await bot.getChat(targetChatId);
    const chatTitle = chatInfo.title || 'Unknown Group';
    
    // Check if already registered
    const existingGroup = await getGroupChat(targetChatId);
    if (existingGroup) {
      await sendMessage(chatId, '✅ このグループは既に登録されています');
      return;
    }
    
    // Register the group
    await upsertGroupChat({
      groupChatId: targetChatId,
      groupName: chatTitle,
      responsibleUserId: requestUserId,
      isActive: 1,
    });
    
    // Create audit log
    await createAuditLog({
      action: 'group_registered',
      objectType: 'group',
      objectId: targetChatId,
      payload: JSON.stringify({ groupName: chatTitle, registeredBy: userId }),
      userId: userId,
    });
    
    // Send success message
    const successMessage = `✅ グループを登録しました！

━━━━━━━━━━━━━━━━━━
📝 グループ名: ${chatTitle}
🆔 チャットID: \`${targetChatId}\`
━━━━━━━━━━━━━━━━━━

このグループでボットの機能が使えるようになりました。
【タスク】【ミーティング】【リマインダー】などのキーワードをお試しください。`;
    
    await sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
    console.log(`[GroupRegistration] Group ${targetChatId} (${chatTitle}) registered by user ${userId}`);
    
  } catch (error) {
    console.error('[GroupRegistration] Error:', error);
    await sendMessage(chatId, '❌ グループの登録に失敗しました。もう一度お試しください。');
  }
}


// Handle image generation trigger
async function handleImageGenerationTrigger(message: any, groupChat: any) {
  const text = message.text;
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();

  try {
    // Check if image generation is enabled
    const db = await getDb();
    if (!db) {
      await sendMessage(chatId, '❌ データベース接続エラーが発生しました。');
      return;
    }

    const enableSetting = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'enable_image_generation')).limit(1);
    const isEnabled = enableSetting[0]?.settingValue === 'true';

    if (!isEnabled) {
      await sendMessage(chatId, '❌ 画像生成機能が無効です。管理画面から有効にしてください。');
      return;
    }

    // Get Gemini API key
    const geminiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'gemini_api_key')).limit(1);
    const geminiApiKey = geminiKeyRow[0]?.settingValue;

    if (!geminiApiKey || geminiApiKey.trim() === '') {
      await sendMessage(chatId, '❌ Gemini API Keyが設定されていません。管理画面から設定してください。');
      return;
    }

    // Get Gemini model
    const geminiModelRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'gemini_model')).limit(1);
    const geminiModel = geminiModelRow[0]?.settingValue || 'gemini-2.5-flash-image';

    // Extract prompt from message
    const prompt = text.replace('【画像生成】', '').trim();

    if (!prompt) {
      await sendMessage(chatId, '❌ 画像の説明を入力してください。\n例: 【画像生成】猫が宇宙を飛んでいる絵');
      return;
    }

    // Send "generating" message
    await sendMessage(chatId, '🎨 画像を生成中です... しばらくお待ちください。');

    console.log(`[Image Generation] Generating image for prompt: "${prompt}" with model: ${geminiModel}`);

    // Generate image using Gemini
    const { generateImageWithGemini } = await import('../integrations/gemini');
    const result = await generateImageWithGemini(geminiApiKey, {
      prompt,
      model: geminiModel,
    });

    if (!result.success) {
      await sendMessage(chatId, `❌ ${result.error}`);
      return;
    }

    if (!result.imageData) {
      await sendMessage(chatId, '❌ 画像の生成に失敗しました。別のプロンプトをお試しください。');
      return;
    }

    // Convert base64 to buffer and send photo
    const imageBuffer = Buffer.from(result.imageData, 'base64');
    
    const { sendPhoto } = await import('./bot');
    await sendPhoto(chatId, imageBuffer, {
      caption: `🎨 「${prompt}」\n\n${result.text || ''}`.trim(),
    });

    console.log(`[Image Generation] Image sent successfully to chat ${chatId}`);

    // Create audit log
    await createAuditLog({
      userId,
      action: 'image_generated',
      objectType: 'image',
      objectId: message.message_id.toString(),
      payload: JSON.stringify({ prompt, model: geminiModel }),
    });

  } catch (error) {
    console.error('[Image Generation] Error:', error);
    await sendMessage(chatId, '❌ 画像の生成中にエラーが発生しました。もう一度お試しください。');
  }
}


// Handle photo messages with caption (for image editing)
async function handlePhotoMessage(message: any) {
  const caption = message.caption || '';
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();
  const chatType = message.chat.type;

  // Only handle 【画像生成】 trigger in captions
  if (!caption.includes('【画像生成】')) {
    return;
  }

  // Check if group is registered (for group chats)
  if (chatType !== 'private') {
    const groupChat = await getGroupChat(chatId);
    if (!groupChat) {
      console.log(`[Telegram] Group ${chatId} not registered, ignoring photo message`);
      return;
    }
  }

  try {
    // Check if Gemini is enabled
    const db = await getDb();
    if (!db) {
      await sendMessage(chatId, '❌ データベース接続エラーが発生しました。');
      return;
    }
    const geminiEnabledRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'gemini_enabled')).limit(1);
    const geminiEnabled = geminiEnabledRow[0]?.settingValue === 'true';

    if (!geminiEnabled) {
      await sendMessage(chatId, '❌ 画像生成機能が無効になっています。管理画面から有効にしてください。');
      return;
    }

    // Get Gemini API key
    const geminiApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'gemini_api_key')).limit(1);
    const geminiApiKey = geminiApiKeyRow[0]?.settingValue;

    if (!geminiApiKey) {
      await sendMessage(chatId, '❌ Gemini API Keyが設定されていません。管理画面から設定してください。');
      return;
    }

    // Get Gemini model
    const geminiModelRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'gemini_model')).limit(1);
    const geminiModel = geminiModelRow[0]?.settingValue || 'gemini-2.5-flash-image';

    // Extract prompt from caption
    const prompt = caption.replace('【画像生成】', '').trim();

    if (!prompt) {
      await sendMessage(chatId, '❌ 画像の編集指示を入力してください。\n例: 【画像生成】この人をバナナを食べながら走っている姿にして');
      return;
    }

    // Send "generating" message
    await sendMessage(chatId, '🎨 画像を編集中です... しばらくお待ちください。');

    // Get the largest photo (last in array)
    const photos = message.photo;
    const largestPhoto = photos[photos.length - 1];
    const fileId = largestPhoto.file_id;

    console.log(`[Image Edit] Downloading image with file_id: ${fileId}`);

    // Download the image
    const imageBuffer = await downloadFile(fileId);
    if (!imageBuffer) {
      await sendMessage(chatId, '❌ 画像のダウンロードに失敗しました。もう一度お試しください。');
      return;
    }

    // Convert to base64
    const imageBase64 = imageBuffer.toString('base64');
    
    // Determine mime type (Telegram photos are usually JPEG)
    const mimeType = 'image/jpeg';

    console.log(`[Image Edit] Editing image with prompt: "${prompt}" using model: ${geminiModel}`);

    // Generate edited image using Gemini
    const { generateImageWithGemini } = await import('../integrations/gemini');
    const result = await generateImageWithGemini(geminiApiKey, {
      prompt,
      model: geminiModel,
      referenceImage: {
        data: imageBase64,
        mimeType,
      },
    });

    if (!result.success) {
      await sendMessage(chatId, `❌ ${result.error}`);
      return;
    }

    if (!result.imageData) {
      await sendMessage(chatId, '❌ 画像の編集に失敗しました。別の指示をお試しください。');
      return;
    }

    // Convert base64 to buffer and send photo
    const resultImageBuffer = Buffer.from(result.imageData, 'base64');
    
    await sendPhoto(chatId, resultImageBuffer, {
      caption: `🎨 「${prompt}」\n\n${result.text || ''}`.trim(),
    });

    console.log(`[Image Edit] Edited image sent successfully to chat ${chatId}`);

    // Create audit log
    await createAuditLog({
      userId,
      action: 'image_edited',
      objectType: 'image',
      objectId: message.message_id.toString(),
      payload: JSON.stringify({ prompt, model: geminiModel }),
    });

  } catch (error) {
    console.error('[Image Edit] Error:', error);
    await sendMessage(chatId, '❌ 画像の編集中にエラーが発生しました。もう一度お試しください。');
  }
}


// ============================================
// Voice Message Handler
// ============================================

async function handleVoiceMessage(message: any) {
  const chatId = message.chat.id.toString();
  const userId = message.from.id.toString();
  const chatType = message.chat.type;
  const voice = message.voice;

  console.log(`[Voice] Received voice message from ${userId} in chat ${chatId}`);
  console.log(`[Voice] Duration: ${voice.duration}s, File ID: ${voice.file_id}, MIME: ${voice.mime_type}`);

  // Ignore DM messages for now
  if (chatType === "private") {
    console.log(`[Voice] Ignoring voice message in private chat`);
    return;
  }

  // Check if group is registered
  const groupChat = await getGroupChat(chatId);
  if (!groupChat) {
    console.log(`[Voice] Group ${chatId} not registered, ignoring voice message`);
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error('[Voice] Database not initialized');
    return;
  }

  try {
    // Check if voice feature is enabled
    const voiceEnabledRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'voice_enabled')).limit(1);
    const voiceEnabled = voiceEnabledRow[0]?.settingValue === 'true';

    if (!voiceEnabled) {
      console.log(`[Voice] Voice feature is disabled`);
      return;
    }

    // Get Gemini API key
    const geminiApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'gemini_api_key')).limit(1);
    const geminiApiKey = geminiApiKeyRow[0]?.settingValue;

    if (!geminiApiKey) {
      console.log(`[Voice] Gemini API key not configured`);
      return;
    }

    // Get voice settings
    const voiceNameRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'voice_name')).limit(1);
    const voiceName = voiceNameRow[0]?.settingValue || 'Kore';

    const voiceResponseModeRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'voice_response_mode')).limit(1);
    const voiceResponseMode = voiceResponseModeRow[0]?.settingValue || 'voice_only'; // 'voice_only', 'text_only', 'both'

    // Send processing message
    await sendMessage(chatId, '🎤 音声を処理中です... しばらくお待ちください。');

    // Download voice file
    console.log(`[Voice] Downloading voice file...`);
    const voiceBuffer = await downloadFile(voice.file_id);
    if (!voiceBuffer) {
      await sendMessage(chatId, '❌ 音声ファイルのダウンロードに失敗しました。');
      return;
    }

    // Convert to base64
    const voiceBase64 = voiceBuffer.toString('base64');
    const mimeType = voice.mime_type || 'audio/ogg';

    console.log(`[Voice] Transcribing audio...`);

    // Transcribe audio using Gemini
    const transcriptionResult = await transcribeAudioWithGemini(geminiApiKey, {
      audioData: voiceBase64,
      mimeType: mimeType,
    });

    if (!transcriptionResult.success || !transcriptionResult.text) {
      await sendMessage(chatId, `❌ 音声の認識に失敗しました: ${transcriptionResult.error || '不明なエラー'}`);
      return;
    }

    const transcribedText = transcriptionResult.text;
    console.log(`[Voice] Transcription: ${transcribedText.substring(0, 100)}...`);

    // Get AI response for the transcribed text
    console.log(`[Voice] Getting AI response...`);

    // Get OpenAI API key for AI response
    const openaiApiKeyRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'openai_api_key')).limit(1);
    const openaiApiKey = openaiApiKeyRow[0]?.settingValue;

    // Get AI model preference
    const aiModelRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'ai_model')).limit(1);
    const aiModel = aiModelRow[0]?.settingValue || 'gpt-4o-mini';

    // Get bot persona
    const botPersonaRow = await db.select().from(botSettings).where(eq(botSettings.settingKey, 'bot_persona')).limit(1);
    const botPersona = botPersonaRow[0]?.settingValue || '親切で丁寧な秘書AIアシスタント';

    let aiResponse: string;

    // Generate AI response
    if (openaiApiKey && aiModel.startsWith('gpt')) {
      const result = await callOpenAI(openaiApiKey, {
        model: aiModel,
        messages: [
          {
            role: 'system',
            content: `あなたは${botPersona}です。音声メッセージで質問されています。簡潔で自然な日本語で回答してください。回答は音声で読み上げられるため、マークダウンや特殊記号は使わないでください。`,
          },
          {
            role: 'user',
            content: transcribedText,
          },
        ],
      });
      const content = result.choices[0]?.message?.content;
      aiResponse = typeof content === 'string' ? content : '申し訳ございません、回答を生成できませんでした。';
    } else {
      // Use built-in LLM
      const result = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `あなたは${botPersona}です。音声メッセージで質問されています。簡潔で自然な日本語で回答してください。回答は音声で読み上げられるため、マークダウンや特殊記号は使わないでください。`,
          },
          {
            role: 'user',
            content: transcribedText,
          },
        ],
      });
      const content = result.choices[0]?.message?.content;
      aiResponse = typeof content === 'string' ? content : '申し訳ございません、回答を生成できませんでした。';
    }

    // Post-process AI response
    aiResponse = postProcessAIOutput(aiResponse);

    console.log(`[Voice] AI Response: ${aiResponse.substring(0, 100)}...`);

    // Send text response if needed
    if (voiceResponseMode === 'text_only' || voiceResponseMode === 'both') {
      await sendMessage(chatId, `📝 *あなたの質問:*\n${transcribedText}\n\n💬 *回答:*\n${aiResponse}`, { parse_mode: 'Markdown' });
    }

    // Generate and send voice response if needed
    if (voiceResponseMode === 'voice_only' || voiceResponseMode === 'both') {
      console.log(`[Voice] Generating speech with voice: ${voiceName}...`);

      const ttsResult = await generateSpeechWithGemini(geminiApiKey, {
        text: aiResponse,
        voiceName: voiceName,
      });

      if (!ttsResult.success || !ttsResult.audioData) {
        console.error(`[Voice] TTS failed: ${ttsResult.error}`);
        // Fall back to text if voice generation fails
        if (voiceResponseMode === 'voice_only') {
          await sendMessage(chatId, `📝 *あなたの質問:*\n${transcribedText}\n\n💬 *回答:*\n${aiResponse}`, { parse_mode: 'Markdown' });
        }
      } else {
        // Convert PCM to WAV
        const wavBuffer = pcmToWav(ttsResult.audioData);

        // Send voice message
        await sendVoice(chatId, wavBuffer, {
          caption: voiceResponseMode === 'voice_only' ? `📝 ${transcribedText.substring(0, 100)}${transcribedText.length > 100 ? '...' : ''}` : undefined,
        });

        console.log(`[Voice] Voice response sent successfully`);
      }
    }

    // Create audit log
    await createAuditLog({
      userId,
      action: 'voice_message_processed',
      objectType: 'voice',
      objectId: message.message_id.toString(),
      payload: JSON.stringify({
        transcription: transcribedText.substring(0, 200),
        responseMode: voiceResponseMode,
        voiceName,
      }),
    });

  } catch (error) {
    console.error('[Voice] Error processing voice message:', error);
    await sendMessage(chatId, '❌ 音声メッセージの処理中にエラーが発生しました。');
  }
}
