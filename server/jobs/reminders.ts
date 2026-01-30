import { Queue, Worker } from "bullmq";
import { getAllTasks, getAllMeetings, updateTask } from "../db";
import { sendMessage, sendMessageWithButtons } from "../telegram/bot";

// Redis connection (using default localhost:6379)
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

// Create queues
export const taskReminderQueue = new Queue("task-reminders", { connection });
export const meetingReminderQueue = new Queue("meeting-reminders", { connection });

// Task reminder worker
export function startTaskReminderWorker() {
  const worker = new Worker(
    "task-reminders",
    async (job) => {
      const { taskId, chatId, assigneeId, title, dueAt } = job.data;

      try {
        await sendMessage(
          chatId,
          `⏰ リマインダー: @${assigneeId} さん、タスク「${title}」の期限が近づいています（期限: ${new Date(dueAt).toLocaleString("ja-JP")}）`
        );
        console.log(`[Task Reminder] Sent reminder for task ${taskId}`);
      } catch (error) {
        console.error(`[Task Reminder] Failed to send reminder for task ${taskId}:`, error);
        throw error;
      }
    },
    { connection }
  );

  worker.on("completed", (job) => {
    console.log(`[Task Reminder] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Task Reminder] Job ${job?.id} failed:`, err);
  });

  return worker;
}

// Meeting reminder worker
export function startMeetingReminderWorker() {
  const worker = new Worker(
    "meeting-reminders",
    async (job) => {
      const { meetingId, chatId, title, startAt, meetUrl, isInPerson } = job.data;

      try {
        // Determine reminder time based on job name
        const is1hReminder = job.name === "meeting-reminder-1h";
        const timeText = is1hReminder ? "1時間後" : "10分後";
        
        let message = `⏰ ミーティングリマインダー: 「${title}」が${timeText}に開始します（${new Date(startAt).toLocaleString("ja-JP")}）`;
        
        if (isInPerson && meetUrl) {
          // For in-person meetings, show location
          const location = meetUrl.replace("場所: ", "");
          message += `\n\n📍 場所: ${location}`;
        } else if (meetUrl && !isInPerson) {
          message += `\n\n参加リンク: ${meetUrl}`;
        }

        await sendMessage(chatId, message);
        console.log(`[Meeting Reminder] Sent ${timeText} reminder for meeting ${meetingId}`);
      } catch (error) {
        console.error(`[Meeting Reminder] Failed to send reminder for meeting ${meetingId}:`, error);
        throw error;
      }
    },
    { connection }
  );

  worker.on("completed", (job) => {
    console.log(`[Meeting Reminder] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Meeting Reminder] Job ${job?.id} failed:`, err);
  });

  return worker;
}

// Schedule task reminders
export async function scheduleTaskReminders() {
  const tasks = await getAllTasks();

  for (const task of tasks) {
    if (!task.dueAt || task.status === "completed" || task.status === "rejected") {
      continue;
    }

    const dueDate = new Date(task.dueAt);
    const now = new Date();

    // Schedule 24 hours before reminder
    const reminder24h = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > now) {
      await taskReminderQueue.add(
        "task-reminder-24h",
        {
          taskId: task.id,
          chatId: task.groupChatId,
          assigneeId: task.assigneeId,
          title: task.title,
          dueAt: task.dueAt,
        },
        {
          delay: reminder24h.getTime() - now.getTime(),
          jobId: `task-${task.id}-24h`,
        }
      );
    }

    // Schedule 1 hour before reminder
    const reminder1h = new Date(dueDate.getTime() - 60 * 60 * 1000);
    if (reminder1h > now) {
      await taskReminderQueue.add(
        "task-reminder-1h",
        {
          taskId: task.id,
          chatId: task.groupChatId,
          assigneeId: task.assigneeId,
          title: task.title,
          dueAt: task.dueAt,
        },
        {
          delay: reminder1h.getTime() - now.getTime(),
          jobId: `task-${task.id}-1h`,
        }
      );
    }
  }

  console.log(`[Task Reminders] Scheduled reminders for ${tasks.length} tasks`);
}

// Check and send overdue task reminders
export async function checkOverdueTaskReminders() {
  const tasks = await getAllTasks();
  const now = new Date();
  let overdueCount = 0;

  for (const task of tasks) {
    // Skip tasks without due date, completed, or rejected tasks
    if (!task.dueAt || task.status === "completed" || task.status === "rejected") {
      continue;
    }

    const dueDate = new Date(task.dueAt);
    
    // Check if task is overdue
    if (dueDate < now) {
      // Check nudge level to avoid spamming
      // Level 0: First overdue notification (immediately after due)
      // Level 1: 1 day after due
      // Level 2: 3 days after due
      // Level 3+: Every 3 days after
      
      const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const currentNudgeLevel = task.nudgeLevel || 0;
      
      let shouldNudge = false;
      let newNudgeLevel = currentNudgeLevel;
      
      if (currentNudgeLevel === 0 && daysSinceDue >= 0) {
        // First overdue notification
        shouldNudge = true;
        newNudgeLevel = 1;
      } else if (currentNudgeLevel === 1 && daysSinceDue >= 1) {
        // 1 day after due
        shouldNudge = true;
        newNudgeLevel = 2;
      } else if (currentNudgeLevel >= 2 && daysSinceDue >= (currentNudgeLevel - 1) * 3) {
        // Every 3 days after
        shouldNudge = true;
        newNudgeLevel = currentNudgeLevel + 1;
      }
      
      // Also check lastNudgeAt to prevent duplicate notifications within same check cycle
      // Changed to 3 hours interval as per user request
      if (shouldNudge && task.lastNudgeAt) {
        const lastNudge = new Date(task.lastNudgeAt);
        const hoursSinceLastNudge = (now.getTime() - lastNudge.getTime()) / (60 * 60 * 1000);
        if (hoursSinceLastNudge < 3) {
          shouldNudge = false; // Don't nudge if we nudged within last 3 hours
        }
      }
      
      if (shouldNudge) {
        try {
          const overdueMessage = daysSinceDue === 0
            ? `⚠️ 期限切れリマインダー: @${task.assigneeId} さん、タスク「${task.title}」の期限が過ぎました（期限: ${dueDate.toLocaleString("ja-JP")}）\n\n完了したら下記のボタンを押してください。完了ボタンが押されるまで、３時間ごとにリマインダーが送られます。`
            : `⚠️ 期限切れリマインダー: @${task.assigneeId} さん、タスク「${task.title}」の期限が${daysSinceDue}日過ぎています（期限: ${dueDate.toLocaleString("ja-JP")}）\n\n完了したら下記のボタンを押してください。完了ボタンが押されるまで、３時間ごとにリマインダーが送られます。`;
          
          // Send message with task completion button
          const completeButton = [
            [{ text: "✅ タスク完了", callback_data: `task_complete_${task.messageId}` }]
          ];
          
          await sendMessageWithButtons(task.groupChatId, overdueMessage, completeButton);
          
          // Update task with new nudge level and timestamp
          await updateTask(task.id, {
            nudgeLevel: newNudgeLevel,
            lastNudgeAt: now,
          });
          
          overdueCount++;
          console.log(`[Overdue Reminder] Sent overdue reminder for task ${task.id} (level ${newNudgeLevel})`);
        } catch (error) {
          console.error(`[Overdue Reminder] Failed to send overdue reminder for task ${task.id}:`, error);
        }
      }
    }
  }

  console.log(`[Overdue Reminders] Sent ${overdueCount} overdue reminders`);
}

// Schedule meeting reminders
export async function scheduleMeetingReminders() {
  const meetings = await getAllMeetings();

  for (const meeting of meetings) {
    if (meeting.status !== "confirmed" || meeting.reminderSent) {
      continue;
    }

    const startDate = new Date(meeting.startAt);
    const now = new Date();
    const isInPerson = meeting.meetingType === "in_person";

    // For in-person meetings: 1 hour before reminder
    if (isInPerson) {
      const reminder1h = new Date(startDate.getTime() - 60 * 60 * 1000);
      if (reminder1h > now) {
        await meetingReminderQueue.add(
          "meeting-reminder-1h",
          {
            meetingId: meeting.id,
            chatId: meeting.groupChatId,
            title: meeting.title,
            startAt: meeting.startAt,
            meetUrl: meeting.meetUrl,
            isInPerson: true,
          },
          {
            delay: reminder1h.getTime() - now.getTime(),
            jobId: `meeting-${meeting.id}-1h`,
          }
        );
      }
    }

    // Schedule 10 minutes before reminder (for all meetings)
    const reminder10m = new Date(startDate.getTime() - 10 * 60 * 1000);
    if (reminder10m > now) {
      await meetingReminderQueue.add(
        "meeting-reminder-10m",
        {
          meetingId: meeting.id,
          chatId: meeting.groupChatId,
          title: meeting.title,
          startAt: meeting.startAt,
          meetUrl: meeting.meetUrl,
          isInPerson: isInPerson,
        },
        {
          delay: reminder10m.getTime() - now.getTime(),
          jobId: `meeting-${meeting.id}-10m`,
        }
      );
    }
  }

  console.log(`[Meeting Reminders] Scheduled reminders for ${meetings.length} meetings`);
}

// Initialize reminder system
export function initializeReminderSystem() {
  console.log("[Reminder System] Initializing...");

  // Start workers
  startTaskReminderWorker();
  startMeetingReminderWorker();

  // Schedule initial reminders
  scheduleTaskReminders();
  scheduleMeetingReminders();
  
  // Check for overdue tasks immediately
  checkOverdueTaskReminders();

  // Re-schedule reminders every hour
  setInterval(() => {
    scheduleTaskReminders();
    scheduleMeetingReminders();
  }, 60 * 60 * 1000);
  
  // Check for overdue tasks every 30 minutes
  setInterval(() => {
    checkOverdueTaskReminders();
  }, 30 * 60 * 1000);

  console.log("[Reminder System] Initialized successfully");
}
