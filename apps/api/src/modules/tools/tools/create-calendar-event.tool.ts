import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { GoogleCalendarService } from '../../google/google-calendar.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  summary: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  startAt: z.string(),
  endAt: z.string(),
});

type Params = z.infer<typeof paramsSchema>;

// Additive, easily-undone write (like create_reminder) - does not set
// requiresConfirmation.
@Injectable()
export class CreateCalendarEventTool implements ToolDefinition<Params> {
  readonly name = 'create_calendar_event';
  readonly description =
    "Creates an event on the user's primary Google Calendar. Requires the user's Google account to be connected - if it isn't, tell the user to connect it in Settings.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'The event title.' },
      description: { type: 'string', description: 'Optional longer description/notes for the event.' },
      location: { type: 'string', description: 'Optional location text.' },
      startAt: {
        type: 'string',
        description:
          "ISO 8601 date-time the event starts. Must include an explicit UTC offset (e.g. '2026-09-04T15:00:00+01:00') or 'Z' for UTC - never emit a timezone-less date-time. If the user didn't specify a timezone, use the one given in your system instructions, not UTC.",
      },
      endAt: {
        type: 'string',
        description: 'ISO 8601 date-time the event ends, same timezone rules as startAt.',
      },
    },
    required: ['summary', 'startAt', 'endAt'],
  };

  constructor(private readonly calendarService: GoogleCalendarService) {}

  async execute(ctx: ToolContext, args: Params) {
    const event = await this.calendarService.createEvent(ctx.userId, args);
    return { event };
  }
}
