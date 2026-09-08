import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { GoogleCalendarService } from '../../google/google-calendar.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  eventId: z.string().min(1),
  summary: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class UpdateCalendarEventTool implements ToolDefinition<Params> {
  readonly name = 'update_calendar_event';
  readonly description =
    "Updates an existing event on the user's primary Google Calendar. Call list_calendar_events first to find the right eventId - never guess one. Only the fields provided are changed.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      eventId: { type: 'string', description: 'The id of the event to update, from list_calendar_events.' },
      summary: { type: 'string', description: 'New event title, if changing it.' },
      description: { type: 'string', description: 'New description, if changing it.' },
      location: { type: 'string', description: 'New location text, if changing it.' },
      startAt: {
        type: 'string',
        description:
          "New start date-time, if changing it. Must include an explicit UTC offset or 'Z' - never a timezone-less date-time.",
      },
      endAt: { type: 'string', description: 'New end date-time, if changing it, same timezone rules as startAt.' },
    },
    required: ['eventId'],
  };

  constructor(private readonly calendarService: GoogleCalendarService) {}

  async execute(ctx: ToolContext, args: Params) {
    const { eventId, ...patch } = args;
    const event = await this.calendarService.updateEvent(ctx.userId, eventId, patch);
    return { event };
  }
}
