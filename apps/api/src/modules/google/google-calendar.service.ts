import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAccountService } from './google-account.service';

export interface CalendarEventSummary {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
}

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly googleAccountService: GoogleAccountService) {}

  private toSummary(event: { id?: string | null; summary?: string | null; description?: string | null; location?: string | null; start?: { dateTime?: string | null; date?: string | null } | null; end?: { dateTime?: string | null; date?: string | null } | null }): CalendarEventSummary {
    return {
      id: event.id ?? '',
      summary: event.summary ?? '(no title)',
      description: event.description ?? null,
      location: event.location ?? null,
      start: event.start?.dateTime ?? event.start?.date ?? null,
      end: event.end?.dateTime ?? event.end?.date ?? null,
    };
  }

  async listEvents(
    userId: string,
    params: { timeMin?: string; timeMax?: string; maxResults?: number },
  ): Promise<CalendarEventSummary[]> {
    const auth = await this.googleAccountService.getAuthorizedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: params.timeMin ?? new Date().toISOString(),
      timeMax: params.timeMax,
      maxResults: params.maxResults ?? 20,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return (data.items ?? []).map((event) => this.toSummary(event));
  }

  async createEvent(userId: string, input: CalendarEventInput): Promise<CalendarEventSummary> {
    const auth = await this.googleAccountService.getAuthorizedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: input.startAt },
        end: { dateTime: input.endAt },
      },
    });
    return this.toSummary(data);
  }

  async updateEvent(
    userId: string,
    eventId: string,
    patch: Partial<CalendarEventInput>,
  ): Promise<CalendarEventSummary> {
    const auth = await this.googleAccountService.getAuthorizedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary: patch.summary,
        description: patch.description,
        location: patch.location,
        start: patch.startAt ? { dateTime: patch.startAt } : undefined,
        end: patch.endAt ? { dateTime: patch.endAt } : undefined,
      },
    });
    return this.toSummary(data);
  }
}
