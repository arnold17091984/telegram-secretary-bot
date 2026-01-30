import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database functions
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getGoogleCredentials: vi.fn(),
  updateGoogleTokens: vi.fn(),
}));

describe('Google Calendar Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('isGoogleCalendarConnected', () => {
    it('should return true when credentials exist and are connected', async () => {
      const { getGoogleCredentials } = await import('./db');
      
      vi.mocked(getGoogleCredentials).mockResolvedValue({
        id: 1,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
        accessToken: 'test-access-token',
        tokenExpiry: new Date(Date.now() + 3600000),
        isConnected: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { isGoogleCalendarConnected } = await import('./integrations/googleCalendar');
      const result = await isGoogleCalendarConnected();

      expect(result).toBe(true);
    });

    it('should return false when credentials do not exist', async () => {
      const { getGoogleCredentials } = await import('./db');
      
      vi.mocked(getGoogleCredentials).mockResolvedValue(null);

      const { isGoogleCalendarConnected } = await import('./integrations/googleCalendar');
      const result = await isGoogleCalendarConnected();

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      const { getGoogleCredentials } = await import('./db');
      
      vi.mocked(getGoogleCredentials).mockResolvedValue({
        id: 1,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: null,
        accessToken: null,
        tokenExpiry: null,
        isConnected: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { isGoogleCalendarConnected } = await import('./integrations/googleCalendar');
      const result = await isGoogleCalendarConnected();

      expect(result).toBe(false);
    });
  });

  describe('createQuickMeetLink', () => {
    it('should return error when Google is not connected', async () => {
      const { getGoogleCredentials } = await import('./db');
      
      vi.mocked(getGoogleCredentials).mockResolvedValue(null);

      const { createQuickMeetLink } = await import('./integrations/googleCalendar');
      const result = await createQuickMeetLink('Test Meeting');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Google認証が必要です');
    });

    it('should accept optional start and end time parameters', async () => {
      const { getGoogleCredentials } = await import('./db');
      
      vi.mocked(getGoogleCredentials).mockResolvedValue(null);

      const { createQuickMeetLink } = await import('./integrations/googleCalendar');
      
      // Test that the function accepts options without throwing
      const startTime = new Date('2026-01-29T15:00:00Z');
      const endTime = new Date('2026-01-29T16:00:00Z');
      
      const result = await createQuickMeetLink('Scheduled Meeting', {
        startTime,
        endTime,
        description: '参加者: @user1, @user2',
      });

      // Should fail due to no credentials, but function should accept the options
      expect(result.success).toBe(false);
    });
  });

  describe('listCalendarEvents', () => {
    it('should return error when Google is not connected', async () => {
      const { getGoogleCredentials } = await import('./db');
      
      vi.mocked(getGoogleCredentials).mockResolvedValue(null);

      const { listCalendarEvents } = await import('./integrations/googleCalendar');
      const result = await listCalendarEvents({
        timeMin: new Date('2026-01-29T00:00:00Z'),
        timeMax: new Date('2026-01-30T00:00:00Z'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Google認証が必要です');
    });
  });

  describe('CalendarEventItem interface', () => {
    it('should have correct structure', async () => {
      // Import the type to ensure it exists
      const googleCalendar = await import('./integrations/googleCalendar');
      
      // Verify the module exports the expected functions
      expect(typeof googleCalendar.createQuickMeetLink).toBe('function');
      expect(typeof googleCalendar.isGoogleCalendarConnected).toBe('function');
      expect(typeof googleCalendar.listCalendarEvents).toBe('function');
      expect(typeof googleCalendar.createCalendarEventWithMeet).toBe('function');
    });
  });
});
