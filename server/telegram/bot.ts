import TelegramBot from "node-telegram-bot-api";
import { getBotSetting } from "../db";

let botInstance: TelegramBot | null = null;

export async function getTelegramBot(): Promise<TelegramBot | null> {
  if (botInstance) {
    return botInstance;
  }

  const tokenSetting = await getBotSetting("telegram_bot_token");
  if (!tokenSetting?.settingValue) {
    console.warn("[Telegram Bot] Bot token not configured");
    return null;
  }

  try {
    botInstance = new TelegramBot(tokenSetting.settingValue, { polling: false });
    console.log("[Telegram Bot] Bot instance created successfully");
    return botInstance;
  } catch (error) {
    console.error("[Telegram Bot] Failed to create bot instance:", error);
    return null;
  }
}

export async function sendMessage(chatId: string | number, text: string, options?: any) {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }
  
  // Retry logic for network errors
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error: any) {
      lastError = error;
      console.error(`[Telegram Bot] sendMessage attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // Only retry on network errors
      if (error.code === 'EFATAL' || error.code === 'ECONNRESET' || error.message?.includes('network')) {
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      throw error;
    }
  }
  
  throw lastError;
}

export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
  options?: { parse_mode?: 'Markdown' | 'HTML' }
) {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }

  // Retry logic for network errors
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: buttons,
        },
        parse_mode: options?.parse_mode,
      });
    } catch (error: any) {
      lastError = error;
      console.error(`[Telegram Bot] sendMessageWithButtons attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // Only retry on network errors
      if (error.code === 'EFATAL' || error.code === 'ECONNRESET' || error.message?.includes('network')) {
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      throw error;
    }
  }
  
  throw lastError;
}

export async function editMessageText(
  text: string,
  options: { chat_id: string | number; message_id: number }
) {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }
  return await bot.editMessageText(text, options);
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }
  return await bot.answerCallbackQuery(callbackQueryId, { text });
}

export async function sendPhoto(
  chatId: string | number,
  photo: Buffer | string,
  options?: { caption?: string; parse_mode?: 'Markdown' | 'HTML' }
) {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }
  return await bot.sendPhoto(chatId, photo, options);
}

export function resetBotInstance() {
  if (botInstance) {
    botInstance.stopPolling();
    botInstance = null;
  }
}

// Download file from Telegram
export async function downloadFile(fileId: string): Promise<Buffer | null> {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }
  
  try {
    // Get file path from Telegram
    const file = await bot.getFile(fileId);
    if (!file.file_path) {
      console.error('[Telegram Bot] No file path returned');
      return null;
    }
    
    // Download the file
    const fileStream = await bot.getFileStream(fileId);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      fileStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      fileStream.on('end', () => resolve(Buffer.concat(chunks)));
      fileStream.on('error', reject);
    });
  } catch (error) {
    console.error('[Telegram Bot] Failed to download file:', error);
    return null;
  }
}

// Cache for bot info
let botInfoCache: { id: number; username: string } | null = null;

export async function getBotInfo(): Promise<{ id: number; username: string } | null> {
  if (botInfoCache) {
    return botInfoCache;
  }

  const bot = await getTelegramBot();
  if (!bot) {
    return null;
  }

  try {
    const me = await bot.getMe();
    botInfoCache = {
      id: me.id,
      username: me.username || '',
    };
    console.log(`[Telegram Bot] Bot info cached: @${botInfoCache.username}`);
    return botInfoCache;
  } catch (error) {
    console.error('[Telegram Bot] Failed to get bot info:', error);
    return null;
  }
}


// Send voice message
export async function sendVoice(
  chatId: string | number,
  voice: Buffer | string,
  options?: { caption?: string; parse_mode?: 'Markdown' | 'HTML'; duration?: number }
) {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }
  return await bot.sendVoice(chatId, voice, options);
}

// Send audio file
export async function sendAudio(
  chatId: string | number,
  audio: Buffer | string,
  options?: { caption?: string; parse_mode?: 'Markdown' | 'HTML'; title?: string; performer?: string }
) {
  const bot = await getTelegramBot();
  if (!bot) {
    throw new Error("Telegram bot not configured");
  }
  return await bot.sendAudio(chatId, audio, options);
}
