import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Task Title Extraction", () => {
  // Test the task title extraction logic that removes duplicate mentions
  function extractTaskTitle(
    text: string,
    entities: Array<{ type: string; offset: number; length: number }>
  ): { taskTitle: string; assigneeId: string; assigneeMention: string } {
    // Extract assignee from mentions first
    const mentions = entities.filter((e) => e.type === "mention");
    let assigneeId = "defaultUser";
    let assigneeMention = "";

    if (mentions.length > 0) {
      const mentionText = text.substring(mentions[0].offset, mentions[0].offset + mentions[0].length);
      assigneeId = mentionText.replace("@", "");
      assigneeMention = mentionText;
    }

    // Extract task title (text after 【タスク】, removing the assignee mention to avoid duplication)
    let taskTitle = text.replace("【タスク】", "").trim();
    if (assigneeMention) {
      taskTitle = taskTitle.replace(assigneeMention, "").trim();
    }

    return { taskTitle, assigneeId, assigneeMention };
  }

  it("extracts task title without duplicate mention", () => {
    const text = "@rrr89012 バナナ買う【タスク】";
    const entities = [{ type: "mention", offset: 0, length: 9 }]; // @rrr89012 is 9 chars
    
    const result = extractTaskTitle(text, entities);
    
    expect(result.assigneeId).toBe("rrr89012");
    expect(result.assigneeMention).toBe("@rrr89012");
    expect(result.taskTitle).toBe("バナナ買う");
    expect(result.taskTitle).not.toContain("@rrr89012");
  });

  it("handles task with mention at the end", () => {
    const text = "【タスク】レポート作成 @user123";
    const entities = [{ type: "mention", offset: 12, length: 8 }]; // @user123 is 8 chars, offset after 【タスク】レポート作成 (5+5+1=11, +1 space=12)
    
    const result = extractTaskTitle(text, entities);
    
    expect(result.assigneeId).toBe("user123");
    expect(result.taskTitle).toBe("レポート作成");
  });

  it("handles task without mention", () => {
    const text = "【タスク】買い物する";
    const entities: Array<{ type: string; offset: number; length: number }> = [];
    
    const result = extractTaskTitle(text, entities);
    
    expect(result.assigneeId).toBe("defaultUser");
    expect(result.taskTitle).toBe("買い物する");
  });

  it("handles task with mention in the middle", () => {
    const text = "【タスク】@testuser 会議資料準備";
    const entities = [{ type: "mention", offset: 5, length: 9 }]; // @testuser is 9 chars, offset after 【タスク】 (5 chars)
    
    const result = extractTaskTitle(text, entities);
    
    expect(result.assigneeId).toBe("testuser");
    expect(result.taskTitle).toBe("会議資料準備");
  });
});

describe("Task Completion Logic", () => {
  it("extracts task message ID from callback data", () => {
    const callbackData = "task_complete_12345";
    const taskMessageId = callbackData.replace("task_complete_", "");
    
    expect(taskMessageId).toBe("12345");
  });

  it("handles empty task message ID", () => {
    const callbackData = "task_complete_";
    const taskMessageId = callbackData.replace("task_complete_", "");
    
    expect(taskMessageId).toBe("");
    expect(taskMessageId.length).toBe(0);
  });
});

describe("Custom Date Input Parsing", () => {
  // Test the date parsing logic for custom date input
  function parseCustomDate(text: string, now: Date): Date | null {
    let dueDate: Date | null = null;
    
    // Try full date format: YYYY/M/D or YYYY-M-D
    const fullDateMatch = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (fullDateMatch) {
      const [, year, month, day] = fullDateMatch;
      dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
    }
    
    // Try short date format: M/D or M-D
    if (!dueDate) {
      const shortDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
      if (shortDateMatch) {
        const [, month, day] = shortDateMatch;
        let year = now.getFullYear();
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
    
    return dueDate;
  }

  it("parses full date format YYYY/M/D", () => {
    const now = new Date("2026-01-29T10:00:00");
    const result = parseCustomDate("2026/2/15", now);
    
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(1); // February (0-indexed)
    expect(result!.getDate()).toBe(15);
  });

  it("parses short date format M/D", () => {
    const now = new Date("2026-01-29T10:00:00");
    const result = parseCustomDate("2/15", now);
    
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(1);
    expect(result!.getDate()).toBe(15);
  });

  it("parses Japanese date format M月D日", () => {
    const now = new Date("2026-01-29T10:00:00");
    const result = parseCustomDate("2月15日", now);
    
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(1);
    expect(result!.getDate()).toBe(15);
  });

  it("assumes next year for past dates", () => {
    const now = new Date("2026-01-29T10:00:00");
    const result = parseCustomDate("1/15", now); // January 15 is in the past
    
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2027); // Should be next year
    expect(result!.getMonth()).toBe(0); // January
    expect(result!.getDate()).toBe(15);
  });

  it("parses date with hyphen separator", () => {
    const now = new Date("2026-01-29T10:00:00");
    const result = parseCustomDate("2026-3-20", now);
    
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2); // March
    expect(result!.getDate()).toBe(20);
  });

  it("returns null for invalid input", () => {
    const now = new Date("2026-01-29T10:00:00");
    const result = parseCustomDate("明日お願いします", now);
    
    expect(result).toBeNull();
  });
});

describe("Overdue Task Reminder Logic", () => {
  // Test the overdue reminder logic
  function shouldSendOverdueReminder(
    dueAt: Date,
    now: Date,
    nudgeLevel: number,
    lastNudgeAt: Date | null
  ): { shouldNudge: boolean; newNudgeLevel: number } {
    const dueDate = new Date(dueAt);
    
    if (dueDate >= now) {
      return { shouldNudge: false, newNudgeLevel: nudgeLevel };
    }

    const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    const currentNudgeLevel = nudgeLevel || 0;
    
    let shouldNudge = false;
    let newNudgeLevel = currentNudgeLevel;
    
    if (currentNudgeLevel === 0 && daysSinceDue >= 0) {
      shouldNudge = true;
      newNudgeLevel = 1;
    } else if (currentNudgeLevel === 1 && daysSinceDue >= 1) {
      shouldNudge = true;
      newNudgeLevel = 2;
    } else if (currentNudgeLevel >= 2 && daysSinceDue >= (currentNudgeLevel - 1) * 3) {
      shouldNudge = true;
      newNudgeLevel = currentNudgeLevel + 1;
    }
    
    // Check lastNudgeAt to prevent duplicate notifications
    // Changed to 3 hours interval as per user request
    if (shouldNudge && lastNudgeAt) {
      const hoursSinceLastNudge = (now.getTime() - lastNudgeAt.getTime()) / (60 * 60 * 1000);
      if (hoursSinceLastNudge < 3) {
        shouldNudge = false;
      }
    }
    
    return { shouldNudge, newNudgeLevel };
  }

  it("sends first overdue notification when task just became overdue", () => {
    const dueAt = new Date("2026-01-28T17:00:00");
    const now = new Date("2026-01-29T10:00:00");
    
    const result = shouldSendOverdueReminder(dueAt, now, 0, null);
    
    expect(result.shouldNudge).toBe(true);
    expect(result.newNudgeLevel).toBe(1);
  });

  it("does not send reminder for task not yet due", () => {
    const dueAt = new Date("2026-01-30T17:00:00");
    const now = new Date("2026-01-29T10:00:00");
    
    const result = shouldSendOverdueReminder(dueAt, now, 0, null);
    
    expect(result.shouldNudge).toBe(false);
  });

  it("sends second reminder after 1 day overdue", () => {
    const dueAt = new Date("2026-01-27T17:00:00");
    const now = new Date("2026-01-29T10:00:00"); // 2 days after due
    
    const result = shouldSendOverdueReminder(dueAt, now, 1, null);
    
    expect(result.shouldNudge).toBe(true);
    expect(result.newNudgeLevel).toBe(2);
  });

  it("does not spam if nudged recently", () => {
    const dueAt = new Date("2026-01-28T17:00:00");
    const now = new Date("2026-01-29T10:00:00");
    const lastNudgeAt = new Date("2026-01-29T08:00:00"); // 2 hours ago
    
    const result = shouldSendOverdueReminder(dueAt, now, 0, lastNudgeAt);
    
    expect(result.shouldNudge).toBe(false);
  });

  it("allows nudge if last nudge was over 3 hours ago", () => {
    const dueAt = new Date("2026-01-28T17:00:00");
    const now = new Date("2026-01-29T14:00:00");
    const lastNudgeAt = new Date("2026-01-29T10:00:00"); // 4 hours ago
    
    const result = shouldSendOverdueReminder(dueAt, now, 0, lastNudgeAt);
    
    expect(result.shouldNudge).toBe(true);
  });

  it("does not nudge if last nudge was less than 3 hours ago", () => {
    const dueAt = new Date("2026-01-28T17:00:00");
    const now = new Date("2026-01-29T12:00:00");
    const lastNudgeAt = new Date("2026-01-29T10:00:00"); // 2 hours ago
    
    const result = shouldSendOverdueReminder(dueAt, now, 0, lastNudgeAt);
    
    expect(result.shouldNudge).toBe(false);
  });
});
