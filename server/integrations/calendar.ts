import { google } from "googleapis";
import { getBotSetting } from "../db";

let calendarClient: any = null;

export async function getCalendarClient() {
  if (calendarClient) {
    return calendarClient;
  }

  const credentialsSetting = await getBotSetting("google_calendar_credentials");
  if (!credentialsSetting?.settingValue) {
    console.warn("[Google Calendar] Credentials not configured");
    return null;
  }

  try {
    const credentials = JSON.parse(credentialsSetting.settingValue);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    calendarClient = google.calendar({ version: "v3", auth });
    console.log("[Google Calendar] Client initialized successfully");
    return calendarClient;
  } catch (error) {
    console.error("[Google Calendar] Failed to initialize client:", error);
    return null;
  }
}

export async function createCalendarEvent(
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    attendees?: Array<{ email: string }>;
    conferenceData?: any;
  }
) {
  const calendar = await getCalendarClient();
  if (!calendar) {
    throw new Error("Google Calendar not configured");
  }

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
      conferenceDataVersion: 1,
    });

    return response.data;
  } catch (error) {
    console.error("[Google Calendar] Failed to create event:", error);
    throw error;
  }
}

export async function createMeetingWithGoogleMeet(
  calendarId: string,
  summary: string,
  description: string,
  startTime: Date,
  endTime: Date,
  attendeeEmails: string[]
) {
  const event = {
    summary,
    description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: "Asia/Tokyo",
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: "Asia/Tokyo",
    },
    attendees: attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  return await createCalendarEvent(calendarId, event);
}

export function resetCalendarClient() {
  calendarClient = null;
}
