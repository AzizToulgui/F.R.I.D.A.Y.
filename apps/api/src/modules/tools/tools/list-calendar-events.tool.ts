import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { GoogleCalendarService } from '../../google/google-calendar.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
});

type Params = z.infer<typeof paramsSchema>;

// Read-only lookup so update_calendar_event has a way to find an eventId -
// same list-before-mutate pattern as list_reminders/list_notes.
@Injectable()
export class ListCalendarEventsTool implements ToolDefinition<Params> {
  readonly name = 'list_calendar_events';
  readonly description =
    "Lists the user's upcoming Google Calendar events (id, title, description, location, start/end). Defaults to events from now onward. Call this before update_calendar_event to find the right eventId - never guess one. Requires the user's Google account to be connected.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      timeMin: {
        type: 'string',
        description:
          "ISO 8601 date-time to start listing from. Must include an explicit UTC offset or 'Z'. Defaults to now.",
      },
      timeMax: {
        type: 'string',
        description: "ISO 8601 date-time to stop listing at. Must include an explicit UTC offset or 'Z'.",
      },
      maxResults: { type: 'number', description: 'Maximum number of events to return. Defaults to 20, capped at 50.' },
    },
  };

  constructor(private readonly calendarService: GoogleCalendarService) {}

  async execute(ctx: ToolContext, args: Params) {
    const events = await this.calendarService.listEvents(ctx.userId, args);
    return { events };
  }
}
