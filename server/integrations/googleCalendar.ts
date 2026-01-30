import { getGoogleCredentials, updateGoogleTokens } from "../db";

interface CalendarEvent {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
}

interface CreateEventResult {
  success: boolean;
  eventId?: string;
  meetLink?: string;
  htmlLink?: string;
  error?: string;
}

// Refresh access token if expired
async function refreshAccessToken(): Promise<string | null> {
  const credentials = await getGoogleCredentials();
  if (!credentials || !credentials.refreshToken) {
    console.error("[Google Calendar] No refresh token available");
    return null;
  }

  // Check if token is still valid (with 5 minute buffer)
  if (credentials.tokenExpiry && credentials.accessToken) {
    const expiryTime = new Date(credentials.tokenExpiry).getTime();
    const now = Date.now();
    if (expiryTime > now + 5 * 60 * 1000) {
      return credentials.accessToken;
    }
  }

  // Refresh the token
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("[Google Calendar] Token refresh error:", data);
      return null;
    }

    const { access_token, expires_in } = data;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    await updateGoogleTokens(access_token, null, tokenExpiry);
    return access_token;
  } catch (error) {
    console.error("[Google Calendar] Token refresh failed:", error);
    return null;
  }
}

// Create a calendar event with Google Meet link
export async function createCalendarEventWithMeet(event: CalendarEvent): Promise<CreateEventResult> {
  const accessToken = await refreshAccessToken();
  if (!accessToken) {
    return { success: false, error: "Google認証が必要です。管理画面でGoogleアカウントを連携してください。" };
  }

  try {
    const eventBody = {
      summary: event.title,
      description: event.description || "",
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: "Asia/Tokyo",
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: "Asia/Tokyo",
      },
      attendees: event.attendees?.map(email => ({ email })) || [],
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    };

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Google Calendar] Create event error:", data);
      return { success: false, error: data.error.message || "イベント作成に失敗しました" };
    }

    const meetLink = data.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === "video"
    )?.uri;

    console.log("[Google Calendar] Event created:", {
      eventId: data.id,
      meetLink,
      htmlLink: data.htmlLink,
    });

    return {
      success: true,
      eventId: data.id,
      meetLink,
      htmlLink: data.htmlLink,
    };
  } catch (error) {
    console.error("[Google Calendar] Create event failed:", error);
    return { success: false, error: "カレンダーイベントの作成に失敗しました" };
  }
}

// Check if Google Calendar is connected
export async function isGoogleCalendarConnected(): Promise<boolean> {
  const credentials = await getGoogleCredentials();
  return !!(credentials && credentials.isConnected === 1 && credentials.refreshToken);
}

// Create a quick Meet link (1 hour meeting starting now or at specified time)
export async function createQuickMeetLink(
  title: string,
  options?: {
    startTime?: Date;
    endTime?: Date;
    description?: string;
    attendees?: string[];
  }
): Promise<CreateEventResult> {
  const startTime = options?.startTime || new Date();
  const endTime = options?.endTime || new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration by default

  return createCalendarEventWithMeet({
    title,
    description: options?.description,
    startTime,
    endTime,
    attendees: options?.attendees,
  });
}

// Calendar event type for listing
export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  hangoutLink?: string;
  status?: string;
  created?: string;
  updated?: string;
  colorId?: string;
}

// List calendar events
export async function listCalendarEvents(options: {
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
  calendarId?: string;
} = {}): Promise<{ success: boolean; events?: CalendarEventItem[]; error?: string }> {
  const accessToken = await refreshAccessToken();
  if (!accessToken) {
    return { success: false, error: "Google認証が必要です。管理画面でGoogleアカウントを連携してください。" };
  }

  const {
    timeMin = new Date(),
    timeMax,
    maxResults = 100,
    calendarId = 'primary',
  } = options;

  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (timeMax) {
      params.append('timeMax', timeMax.toISOString());
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Google Calendar] List events error:", data);
      return { success: false, error: data.error.message || "イベント取得に失敗しました" };
    }

    const events: CalendarEventItem[] = (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || '(タイトルなし)',
      description: item.description,
      location: item.location,
      start: item.start || {},
      end: item.end || {},
      htmlLink: item.htmlLink,
      hangoutLink: item.hangoutLink,
      status: item.status,
      created: item.created,
      updated: item.updated,
      colorId: item.colorId,
    }));

    return { success: true, events };
  } catch (error) {
    console.error("[Google Calendar] List events failed:", error);
    return { success: false, error: "カレンダーイベントの取得に失敗しました" };
  }
}

// Update a calendar event
export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEvent>,
  calendarId: string = 'primary'
): Promise<{ success: boolean; event?: CalendarEventItem; error?: string }> {
  const accessToken = await refreshAccessToken();
  if (!accessToken) {
    return { success: false, error: "Google認証が必要です。" };
  }

  try {
    const eventBody: any = {};
    if (updates.title) eventBody.summary = updates.title;
    if (updates.description !== undefined) eventBody.description = updates.description;
    if (updates.startTime) {
      eventBody.start = {
        dateTime: updates.startTime.toISOString(),
        timeZone: "Asia/Tokyo",
      };
    }
    if (updates.endTime) {
      eventBody.end = {
        dateTime: updates.endTime.toISOString(),
        timeZone: "Asia/Tokyo",
      };
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Google Calendar] Update event error:", data);
      return { success: false, error: data.error.message || "イベント更新に失敗しました" };
    }

    return {
      success: true,
      event: {
        id: data.id,
        summary: data.summary || '(タイトルなし)',
        description: data.description,
        location: data.location,
        start: data.start || {},
        end: data.end || {},
        htmlLink: data.htmlLink,
        hangoutLink: data.hangoutLink,
        status: data.status,
        created: data.created,
        updated: data.updated,
      },
    };
  } catch (error) {
    console.error("[Google Calendar] Update event failed:", error);
    return { success: false, error: "イベントの更新に失敗しました" };
  }
}

// Delete a calendar event
export async function deleteCalendarEvent(
  eventId: string,
  calendarId: string = 'primary'
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await refreshAccessToken();
  if (!accessToken) {
    return { success: false, error: "Google認証が必要です。" };
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 204 || response.status === 200) {
      return { success: true };
    }

    const data = await response.json();
    if (data.error) {
      console.error("[Google Calendar] Delete event error:", data);
      return { success: false, error: data.error.message || "イベント削除に失敗しました" };
    }

    return { success: true };
  } catch (error) {
    console.error("[Google Calendar] Delete event failed:", error);
    return { success: false, error: "イベントの削除に失敗しました" };
  }
}
