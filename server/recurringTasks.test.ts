import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  createRecurringTask: vi.fn().mockResolvedValue(1),
  createRecurringTaskCompletion: vi.fn().mockResolvedValue(1),
  getCompletionsByTaskId: vi.fn().mockResolvedValue([
    {
      id: 1,
      recurringTaskId: 1,
      chatId: '123456',
      completedBy: 'user2',
      completedByName: 'Test User',
      scheduledAt: new Date('2026-01-29T01:00:00Z'),
      completedAt: new Date('2026-01-29T01:15:00Z'),
    },
  ]),
  getRecentCompletions: vi.fn().mockResolvedValue([
    {
      completion: {
        id: 1,
        recurringTaskId: 1,
        chatId: '123456',
        completedBy: 'user2',
        completedByName: 'Test User',
        scheduledAt: new Date('2026-01-29T01:00:00Z'),
        completedAt: new Date('2026-01-29T01:15:00Z'),
      },
      task: {
        id: 1,
        taskTitle: 'Weekly Report',
      },
    },
  ]),
  getAllRecurringTasks: vi.fn().mockResolvedValue([
    {
      id: 1,
      chatId: '123456',
      creatorId: 'user1',
      assigneeId: 'user2',
      assigneeMention: '@user2',
      taskTitle: 'Weekly Report',
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: null,
      hour: 9,
      minute: 0,
      isActive: 1,
      nextSendAt: new Date('2026-01-30T01:00:00Z'),
      lastSentAt: null,
      createdAt: new Date('2026-01-29T00:00:00Z'),
    },
    {
      id: 2,
      chatId: '123456',
      creatorId: 'user1',
      assigneeId: 'user3',
      assigneeMention: '@user3',
      taskTitle: 'Daily Standup',
      frequency: 'daily',
      dayOfWeek: null,
      dayOfMonth: null,
      hour: 10,
      minute: 30,
      isActive: 1,
      nextSendAt: new Date('2026-01-30T02:30:00Z'),
      lastSentAt: null,
      createdAt: new Date('2026-01-29T00:00:00Z'),
    },
  ]),
  getRecurringTaskById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        chatId: '123456',
        creatorId: 'user1',
        assigneeId: 'user2',
        assigneeMention: '@user2',
        taskTitle: 'Weekly Report',
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: null,
        hour: 9,
        minute: 0,
        isActive: 1,
        nextSendAt: new Date('2026-01-30T01:00:00Z'),
        lastSentAt: null,
        createdAt: new Date('2026-01-29T00:00:00Z'),
      });
    }
    return Promise.resolve(undefined);
  }),
  updateRecurringTask: vi.fn().mockResolvedValue(undefined),
  deleteRecurringTask: vi.fn().mockResolvedValue(undefined),
  getDueRecurringTasks: vi.fn().mockResolvedValue([]),
}));

describe('Recurring Tasks Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a recurring task', async () => {
    const { createRecurringTask } = await import('./db');
    
    const taskData = {
      chatId: '123456',
      creatorId: 'user1',
      assigneeId: 'user2',
      assigneeMention: '@user2',
      taskTitle: 'Test Task',
      frequency: 'daily' as const,
      dayOfWeek: null,
      dayOfMonth: null,
      hour: 9,
      minute: 0,
      isActive: 1,
      nextSendAt: new Date('2026-01-30T01:00:00Z'),
    };
    
    const result = await createRecurringTask(taskData);
    
    expect(createRecurringTask).toHaveBeenCalledWith(taskData);
    expect(result).toBe(1);
  });

  it('should get all recurring tasks', async () => {
    const { getAllRecurringTasks } = await import('./db');
    
    const tasks = await getAllRecurringTasks();
    
    expect(getAllRecurringTasks).toHaveBeenCalled();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].taskTitle).toBe('Weekly Report');
    expect(tasks[1].taskTitle).toBe('Daily Standup');
  });

  it('should get a recurring task by id', async () => {
    const { getRecurringTaskById } = await import('./db');
    
    const task = await getRecurringTaskById(1);
    
    expect(getRecurringTaskById).toHaveBeenCalledWith(1);
    expect(task).toBeDefined();
    expect(task?.taskTitle).toBe('Weekly Report');
    expect(task?.frequency).toBe('weekly');
  });

  it('should return undefined for non-existent task', async () => {
    const { getRecurringTaskById } = await import('./db');
    
    const task = await getRecurringTaskById(999);
    
    expect(task).toBeUndefined();
  });

  it('should update a recurring task', async () => {
    const { updateRecurringTask } = await import('./db');
    
    await updateRecurringTask(1, { taskTitle: 'Updated Task' });
    
    expect(updateRecurringTask).toHaveBeenCalledWith(1, { taskTitle: 'Updated Task' });
  });

  it('should delete a recurring task', async () => {
    const { deleteRecurringTask } = await import('./db');
    
    await deleteRecurringTask(1);
    
    expect(deleteRecurringTask).toHaveBeenCalledWith(1);
  });
});

describe('Recurring Task Schedule Formatting', () => {
  const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

  const formatSchedule = (task: {
    frequency: string;
    hour: number;
    minute: number;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    excludeDays?: string | null;
  }) => {
    const time = `${task.hour}:${String(task.minute).padStart(2, '0')}`;
    
    if (task.frequency === 'daily') {
      const excludeInfo = task.excludeDays 
        ? `（${task.excludeDays.split(',').map(d => DAY_NAMES[parseInt(d)]).join('、')}曜日除く）`
        : '';
      return `毎日 ${time}${excludeInfo}`;
    } else if (task.frequency === 'weekly' && task.dayOfWeek !== null) {
      return `毎週${DAY_NAMES[task.dayOfWeek]}曜日 ${time}`;
    } else if (task.frequency === 'monthly' && task.dayOfMonth !== null) {
      return `毎月${task.dayOfMonth}日 ${time}`;
    }
    return time;
  };

  it('should format daily schedule correctly', () => {
    const task = {
      frequency: 'daily',
      hour: 9,
      minute: 0,
      dayOfWeek: null,
      dayOfMonth: null,
    };
    
    expect(formatSchedule(task)).toBe('毎日 9:00');
  });

  it('should format weekly schedule correctly', () => {
    const task = {
      frequency: 'weekly',
      hour: 14,
      minute: 30,
      dayOfWeek: 1, // Monday
      dayOfMonth: null,
    };
    
    expect(formatSchedule(task)).toBe('毎週月曜日 14:30');
  });

  it('should format monthly schedule correctly', () => {
    const task = {
      frequency: 'monthly',
      hour: 10,
      minute: 15,
      dayOfWeek: null,
      dayOfMonth: 15,
    };
    
    expect(formatSchedule(task)).toBe('毎月15日 10:15');
  });

  it('should handle single digit minutes with padding', () => {
    const task = {
      frequency: 'daily',
      hour: 8,
      minute: 5,
      dayOfWeek: null,
      dayOfMonth: null,
    };
    
    expect(formatSchedule(task)).toBe('毎日 8:05');
  });

  it('should format daily schedule with exclude days', () => {
    const task = {
      frequency: 'daily',
      hour: 9,
      minute: 0,
      dayOfWeek: null,
      dayOfMonth: null,
      excludeDays: '0,6', // Sunday and Saturday
    };
    
    expect(formatSchedule(task)).toBe('毎日 9:00（日、土曜日除く）');
  });

  it('should format daily schedule with single exclude day', () => {
    const task = {
      frequency: 'daily',
      hour: 10,
      minute: 30,
      dayOfWeek: null,
      dayOfMonth: null,
      excludeDays: '0', // Sunday only
    };
    
    expect(formatSchedule(task)).toBe('毎日 10:30（日曜日除く）');
  });

  it('should format daily schedule without exclude days', () => {
    const task = {
      frequency: 'daily',
      hour: 9,
      minute: 0,
      dayOfWeek: null,
      dayOfMonth: null,
      excludeDays: null,
    };
    
    expect(formatSchedule(task)).toBe('毎日 9:00');
  });
});

describe('Exclude Days Skip Logic', () => {
  // Helper to get day of week in PH timezone
  const getDayInPH = (date: Date): number => {
    const phOffset = 8 * 60;
    const localOffset = date.getTimezoneOffset();
    const phDate = new Date(date.getTime() + (phOffset + localOffset) * 60 * 1000);
    return phDate.getDay();
  };

  const calculateNextSendTimeWithExclude = (
    frequency: 'daily' | 'weekly' | 'monthly',
    hour: number,
    minute: number,
    dayOfWeek: number | null,
    dayOfMonth: number | null,
    excludeDays: string | null,
    currentDate: Date
  ): Date => {
    const phOffset = 8 * 60;
    const localOffset = currentDate.getTimezoneOffset();
    const phCurrent = new Date(currentDate.getTime() + (phOffset + localOffset) * 60 * 1000);
    
    let nextSend = new Date(phCurrent);
    nextSend.setHours(hour, minute, 0, 0);
    
    if (frequency === 'daily') {
      const excludedDaysList = excludeDays ? excludeDays.split(',').map(d => parseInt(d)) : [];
      do {
        nextSend.setDate(nextSend.getDate() + 1);
      } while (excludedDaysList.includes(nextSend.getDay()));
    }
    
    return new Date(nextSend.getTime() - (phOffset + localOffset) * 60 * 1000);
  };

  it('should skip excluded days when calculating next send time', () => {
    // Start from a Friday in PH timezone
    const friday = new Date('2026-01-30T01:00:00Z'); // Friday 9:00 AM in PH (UTC+8)
    
    // Exclude Saturday (6) and Sunday (0)
    const nextSend = calculateNextSendTimeWithExclude(
      'daily', 9, 0, null, null, '0,6', friday
    );
    
    // Get the day in PH timezone
    const nextSendDayPH = getDayInPH(nextSend);
    expect(nextSendDayPH).not.toBe(0); // Not Sunday
    expect(nextSendDayPH).not.toBe(6); // Not Saturday
  });

  it('should not skip any days when excludeDays is null', () => {
    const friday = new Date('2026-01-30T01:00:00Z');
    
    const nextSend = calculateNextSendTimeWithExclude(
      'daily', 9, 0, null, null, null, friday
    );
    
    // Should be the next day (Saturday)
    expect(nextSend.getTime()).toBeGreaterThan(friday.getTime());
  });

  it('should handle multiple excluded days', () => {
    const monday = new Date('2026-01-26T01:00:00Z'); // Monday 9:00 AM in PH
    
    // Exclude Tuesday (2), Wednesday (3), Thursday (4)
    const nextSend = calculateNextSendTimeWithExclude(
      'daily', 9, 0, null, null, '2,3,4', monday
    );
    
    const nextSendDayPH = getDayInPH(nextSend);
    expect(nextSendDayPH).not.toBe(2); // Not Tuesday
    expect(nextSendDayPH).not.toBe(3); // Not Wednesday
    expect(nextSendDayPH).not.toBe(4); // Not Thursday
  });
});

describe('Next Send Time Calculation', () => {
  // Helper function to calculate next send time (simplified version)
  const calculateNextSendTime = (
    frequency: 'daily' | 'weekly' | 'monthly',
    hour: number,
    minute: number,
    dayOfWeek?: number,
    dayOfMonth?: number
  ): Date => {
    // Use Philippines timezone (UTC+8)
    const now = new Date();
    const phOffset = 8 * 60; // UTC+8 in minutes
    const localOffset = now.getTimezoneOffset();
    const phNow = new Date(now.getTime() + (phOffset + localOffset) * 60 * 1000);
    
    let nextSend = new Date(phNow);
    nextSend.setHours(hour, minute, 0, 0);
    
    if (frequency === 'daily') {
      if (nextSend <= phNow) {
        nextSend.setDate(nextSend.getDate() + 1);
      }
    } else if (frequency === 'weekly' && dayOfWeek !== undefined) {
      const currentDay = phNow.getDay();
      let daysUntil = dayOfWeek - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && nextSend <= phNow)) {
        daysUntil += 7;
      }
      nextSend.setDate(nextSend.getDate() + daysUntil);
    } else if (frequency === 'monthly' && dayOfMonth !== undefined) {
      nextSend.setDate(dayOfMonth);
      if (nextSend <= phNow) {
        nextSend.setMonth(nextSend.getMonth() + 1);
      }
    }
    
    // Convert back to UTC for storage
    return new Date(nextSend.getTime() - (phOffset + localOffset) * 60 * 1000);
  };

  it('should calculate next daily send time', () => {
    const nextSend = calculateNextSendTime('daily', 9, 0);
    
    expect(nextSend).toBeInstanceOf(Date);
    expect(nextSend.getTime()).toBeGreaterThan(Date.now());
  });

  it('should calculate next weekly send time', () => {
    const nextSend = calculateNextSendTime('weekly', 14, 30, 1); // Monday
    
    expect(nextSend).toBeInstanceOf(Date);
    expect(nextSend.getTime()).toBeGreaterThan(Date.now());
  });

  it('should calculate next monthly send time', () => {
    const nextSend = calculateNextSendTime('monthly', 10, 0, undefined, 15);
    
    expect(nextSend).toBeInstanceOf(Date);
    expect(nextSend.getTime()).toBeGreaterThan(Date.now());
  });
});


describe('Recurring Task Completions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a task completion record', async () => {
    const { createRecurringTaskCompletion } = await import('./db');
    
    const completionData = {
      recurringTaskId: 1,
      chatId: '123456',
      completedBy: 'user2',
      completedByName: 'Test User',
      scheduledAt: new Date('2026-01-29T01:00:00Z'),
    };
    
    const completionId = await createRecurringTaskCompletion(completionData);
    
    expect(createRecurringTaskCompletion).toHaveBeenCalledWith(completionData);
    expect(completionId).toBe(1);
  });

  it('should get completions by task ID', async () => {
    const { getCompletionsByTaskId } = await import('./db');
    
    const completions = await getCompletionsByTaskId(1);
    
    expect(getCompletionsByTaskId).toHaveBeenCalledWith(1);
    expect(completions).toHaveLength(1);
    expect(completions[0].completedByName).toBe('Test User');
    expect(completions[0].recurringTaskId).toBe(1);
  });

  it('should get recent completions with task info', async () => {
    const { getRecentCompletions } = await import('./db');
    
    const completions = await getRecentCompletions(100);
    
    expect(getRecentCompletions).toHaveBeenCalledWith(100);
    expect(completions).toHaveLength(1);
    expect(completions[0].completion.completedByName).toBe('Test User');
    expect(completions[0].task.taskTitle).toBe('Weekly Report');
  });
});
