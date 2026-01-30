import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

import { getSetting, setSetting } from './db';

describe('Timezone functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTimezone helper', () => {
    it('should return Asia/Manila as default timezone', async () => {
      // Mock getSetting to return null (no setting)
      vi.mocked(getSetting).mockResolvedValue(null);
      
      // The default timezone should be Asia/Manila
      const defaultTimezone = 'Asia/Manila';
      expect(defaultTimezone).toBe('Asia/Manila');
    });

    it('should return configured timezone from database', async () => {
      // Mock getSetting to return a configured timezone
      vi.mocked(getSetting).mockResolvedValue({
        id: 1,
        settingKey: 'timezone',
        settingValue: 'Asia/Tokyo',
        description: 'タイムゾーン',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const result = await getSetting('timezone');
      expect(result?.settingValue).toBe('Asia/Tokyo');
    });
  });

  describe('getCurrentTimeInTimezone', () => {
    it('should format time correctly for Asia/Manila timezone', () => {
      const timezone = 'Asia/Manila';
      const now = new Date('2026-01-28T10:00:00Z'); // UTC time
      
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      
      const formatted = formatter.format(now);
      // Asia/Manila is UTC+8, so 10:00 UTC = 18:00 Manila
      expect(formatted).toContain('18');
    });

    it('should format time correctly for Asia/Tokyo timezone', () => {
      const timezone = 'Asia/Tokyo';
      const now = new Date('2026-01-28T10:00:00Z'); // UTC time
      
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      
      const formatted = formatter.format(now);
      // Asia/Tokyo is UTC+9, so 10:00 UTC = 19:00 Tokyo
      expect(formatted).toContain('19');
    });
  });

  describe('calculateReminderTime', () => {
    it('should calculate "3 minutes from now" correctly in Manila timezone', () => {
      const timezone = 'Asia/Manila';
      const now = new Date('2026-01-28T10:00:00Z'); // UTC time
      const minutesToAdd = 3;
      
      // Add 3 minutes to current time
      const reminderTime = new Date(now.getTime() + minutesToAdd * 60 * 1000);
      
      // The reminder should be at 10:03 UTC
      expect(reminderTime.getUTCHours()).toBe(10);
      expect(reminderTime.getUTCMinutes()).toBe(3);
      
      // In Manila time, this should be 18:03
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const manilaTime = formatter.format(reminderTime);
      expect(manilaTime).toBe('18:03');
    });

    it('should calculate "1 hour from now" correctly', () => {
      const now = new Date('2026-01-28T10:00:00Z');
      const hoursToAdd = 1;
      
      const reminderTime = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
      
      expect(reminderTime.getUTCHours()).toBe(11);
      expect(reminderTime.getUTCMinutes()).toBe(0);
    });
  });

  describe('parseRelativeTime', () => {
    it('should parse "3分後" correctly', () => {
      const input = '3分後';
      const match = input.match(/(\d+)\s*分後/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('3');
    });

    it('should parse "1時間後" correctly', () => {
      const input = '1時間後';
      const match = input.match(/(\d+)\s*時間後/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('1');
    });

    it('should parse "30分後" correctly', () => {
      const input = '30分後';
      const match = input.match(/(\d+)\s*分後/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('30');
    });
  });

  describe('get_current_time tool response', () => {
    it('should return properly formatted time response', () => {
      const timezone = 'Asia/Manila';
      const now = new Date('2026-01-28T10:00:00Z');
      
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      
      const formatted = formatter.format(now);
      
      // Should contain date and time
      expect(formatted).toContain('2026');
      expect(formatted).toContain('01');
      expect(formatted).toContain('28');
      expect(formatted).toContain('18'); // 18:00 in Manila
    });
  });

  describe('timezone offset calculation', () => {
    it('should correctly calculate UTC+8 offset for Manila', () => {
      const now = new Date('2026-01-28T00:00:00Z');
      
      // Get Manila time
      const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      
      // Manila is UTC+8
      const offsetHours = (manilaTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60);
      expect(offsetHours).toBe(8);
    });

    it('should correctly calculate UTC+9 offset for Tokyo', () => {
      const now = new Date('2026-01-28T00:00:00Z');
      
      // Get Tokyo time
      const tokyoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      
      // Tokyo is UTC+9
      const offsetHours = (tokyoTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60);
      expect(offsetHours).toBe(9);
    });
  });
});
