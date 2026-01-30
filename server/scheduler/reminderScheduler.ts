/**
 * Reminder Scheduler
 * Periodically checks for pending reminders and sends notifications
 * Supports recurring reminders (daily, weekly, monthly)
 */

import { getPendingReminders, updateReminder, createReminder, getDueRecurringTasks, updateRecurringTask } from '../db';
import { sendMessage, sendMessageWithButtons } from '../telegram/bot';

let schedulerInterval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

/**
 * Calculate the next reminder time for recurring reminders
 */
function calculateNextReminderTime(
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly',
  repeatDays: string | null,
  currentRemindAt: Date,
  reminderMinutesBefore: number
): Date | null {
  if (repeatType === 'none') return null;
  
  // Calculate the event time from the reminder time
  const eventTime = new Date(currentRemindAt.getTime() + reminderMinutesBefore * 60 * 1000);
  const eventHour = eventTime.getHours();
  const eventMinute = eventTime.getMinutes();
  
  let nextEventDate = new Date(eventTime);
  
  switch (repeatType) {
    case 'daily':
      // Move to tomorrow
      nextEventDate.setDate(nextEventDate.getDate() + 1);
      break;
      
    case 'weekly':
      if (repeatDays) {
        const days = repeatDays.split(',').map(d => parseInt(d.trim()));
        const currentDay = nextEventDate.getDay();
        
        // Find the next day in the list
        let found = false;
        for (let i = 1; i <= 7; i++) {
          const checkDay = (currentDay + i) % 7;
          if (days.includes(checkDay)) {
            nextEventDate.setDate(nextEventDate.getDate() + i);
            found = true;
            break;
          }
        }
        if (!found) return null;
      } else {
        // Default to same day next week
        nextEventDate.setDate(nextEventDate.getDate() + 7);
      }
      break;
      
    case 'monthly':
      if (repeatDays) {
        const days = repeatDays.split(',').map(d => parseInt(d.trim())).sort((a, b) => a - b);
        const currentDayOfMonth = nextEventDate.getDate();
        
        // Find the next day in the current month or next month
        let found = false;
        for (const day of days) {
          if (day > currentDayOfMonth) {
            nextEventDate.setDate(day);
            found = true;
            break;
          }
        }
        if (!found) {
          // Move to next month, first day in the list
          nextEventDate.setMonth(nextEventDate.getMonth() + 1);
          nextEventDate.setDate(days[0]);
        }
      } else {
        // Default to same day next month
        nextEventDate.setMonth(nextEventDate.getMonth() + 1);
      }
      break;
      
    default:
      return null;
  }
  
  // Set the time
  nextEventDate.setHours(eventHour, eventMinute, 0, 0);
  
  // Calculate the next reminder time
  const nextReminderTime = new Date(nextEventDate.getTime() - reminderMinutesBefore * 60 * 1000);
  
  return nextReminderTime;
}

/**
 * Get day name in Japanese
 */
function getDayName(day: number): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[day];
}

/**
 * Process pending reminders and send notifications
 */
async function processReminders() {
  try {
    const pendingReminders = await getPendingReminders();
    
    if (pendingReminders.length > 0) {
      console.log(`[Reminder Scheduler] Found ${pendingReminders.length} pending reminders`);
    }
    
    for (const reminder of pendingReminders) {
      try {
        // Send reminder message to the chat
        await sendMessage(reminder.chatId, reminder.message);
        
        // Check if this is a recurring reminder
        const repeatType = (reminder.repeatType || 'none') as 'none' | 'daily' | 'weekly' | 'monthly';
        
        if (repeatType !== 'none' && reminder.reminderMinutesBefore) {
          // Calculate next reminder time
          const nextReminderTime = calculateNextReminderTime(
            repeatType,
            reminder.repeatDays || null,
            reminder.remindAt,
            reminder.reminderMinutesBefore
          );
          
          // Check if we've passed the end date
          const hasEndDate = reminder.repeatEndDate !== null;
          const isPastEndDate = hasEndDate && nextReminderTime && nextReminderTime > new Date(reminder.repeatEndDate!);
          
          if (nextReminderTime && !isPastEndDate) {
            // Update the reminder with the next time
            await updateReminder(reminder.id, { 
              remindAt: nextReminderTime,
              status: 'pending'
            });
            
            const nextTimeStr = nextReminderTime.toLocaleString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Tokyo'
            });
            
            console.log(`[Reminder Scheduler] Recurring reminder #${reminder.id} rescheduled to ${nextTimeStr}`);
          } else {
            // No more occurrences, mark as sent
            await updateReminder(reminder.id, { status: 'sent' });
            console.log(`[Reminder Scheduler] Recurring reminder #${reminder.id} completed (no more occurrences)`);
          }
        } else {
          // One-time reminder, mark as sent
          await updateReminder(reminder.id, { status: 'sent' });
        }
        
        console.log(`[Reminder Scheduler] Sent reminder #${reminder.id} to chat ${reminder.chatId}`);
      } catch (error) {
        console.error(`[Reminder Scheduler] Failed to send reminder #${reminder.id}:`, error);
        // Don't mark as sent so it will be retried
      }
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error processing reminders:', error);
  }
}

/**
 * Calculate next send time for recurring tasks
 */
function calculateNextRecurringTaskTime(
  frequency: 'daily' | 'weekly' | 'monthly',
  hour: number,
  minute: number,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  excludeDays: string | null,
  currentSendAt: Date
): Date {
  // Use Philippines timezone (UTC+8)
  const phOffset = 8 * 60; // UTC+8 in minutes
  const localOffset = currentSendAt.getTimezoneOffset();
  const phCurrent = new Date(currentSendAt.getTime() + (phOffset + localOffset) * 60 * 1000);
  
  let nextSend = new Date(phCurrent);
  nextSend.setHours(hour, minute, 0, 0);
  
  switch (frequency) {
    case 'daily':
      // Move to next valid day (skip excluded days)
      const excludedDaysList = excludeDays ? excludeDays.split(',').map(d => parseInt(d)) : [];
      do {
        nextSend.setDate(nextSend.getDate() + 1);
      } while (excludedDaysList.includes(nextSend.getDay()));
      break;
      
    case 'weekly':
      if (dayOfWeek !== null) {
        // Move to next week same day
        nextSend.setDate(nextSend.getDate() + 7);
      }
      break;
      
    case 'monthly':
      if (dayOfMonth !== null) {
        // Move to next month same day
        nextSend.setMonth(nextSend.getMonth() + 1);
        nextSend.setDate(dayOfMonth);
      }
      break;
  }
  
  // Convert back to UTC for storage
  return new Date(nextSend.getTime() - (phOffset + localOffset) * 60 * 1000);
}

/**
 * Process due recurring tasks and send reminders
 */
async function processRecurringTasks() {
  try {
    const dueTasks = await getDueRecurringTasks();
    
    if (dueTasks.length > 0) {
      console.log(`[Recurring Task Scheduler] Found ${dueTasks.length} due recurring tasks`);
    }
    
    for (const task of dueTasks) {
      try {
        // Build reminder message
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        let scheduleText = '';
        
        if (task.frequency === 'daily') {
          const excludeInfo = task.excludeDays 
            ? `（${task.excludeDays.split(',').map((d: string) => dayNames[parseInt(d)]).join('、')}曜日除く）`
            : '';
          scheduleText = `毎日 ${task.hour}:${String(task.minute).padStart(2, '0')}${excludeInfo}`;
        } else if (task.frequency === 'weekly' && task.dayOfWeek !== null) {
          scheduleText = `毎週${dayNames[task.dayOfWeek]}曜日 ${task.hour}:${String(task.minute).padStart(2, '0')}`;
        } else if (task.frequency === 'monthly' && task.dayOfMonth !== null) {
          scheduleText = `毎月${task.dayOfMonth}日 ${task.hour}:${String(task.minute).padStart(2, '0')}`;
        }
        
        let message = `🔔 定期タスクのリマインダー\n\n`;
        message += `📝 ${task.taskTitle}\n`;
        if (task.assigneeMention) {
          message += `👤 担当: ${task.assigneeMention}\n`;
        }
        message += `📅 ${scheduleText}`;
        
        // Send reminder message with completion button
        const scheduledAt = task.nextSendAt ? task.nextSendAt.getTime() : Date.now();
        await sendMessageWithButtons(task.chatId, message, [
          [{ text: '✅ 完了報告', callback_data: `rt_complete:${task.id}:${scheduledAt}` }]
        ]);
        
        // Calculate next send time
        const nextSendAt = calculateNextRecurringTaskTime(
          task.frequency as 'daily' | 'weekly' | 'monthly',
          task.hour,
          task.minute,
          task.dayOfWeek,
          task.dayOfMonth,
          task.excludeDays || null,
          task.nextSendAt || new Date()
        );
        
        // Update task with last sent time and next send time
        await updateRecurringTask(task.id, {
          lastSentAt: new Date(),
          nextSendAt,
        });
        
        console.log(`[Recurring Task Scheduler] Sent reminder for task #${task.id}, next: ${nextSendAt.toISOString()}`);
      } catch (error) {
        console.error(`[Recurring Task Scheduler] Failed to process task #${task.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Recurring Task Scheduler] Error processing recurring tasks:', error);
  }
}

/**
 * Start the reminder scheduler
 */
export function startReminderScheduler() {
  if (schedulerInterval) {
    console.log('[Reminder Scheduler] Scheduler already running');
    return;
  }
  
  console.log(`[Reminder Scheduler] Starting scheduler (checking every ${CHECK_INTERVAL_MS / 1000}s)`);
  
  // Run immediately on start
  processReminders();
  processRecurringTasks();
  
  // Then run periodically
  schedulerInterval = setInterval(() => {
    processReminders();
    processRecurringTasks();
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Reminder Scheduler] Scheduler stopped');
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}
