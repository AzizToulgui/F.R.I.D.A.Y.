import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RemindersService } from '../../reminders/reminders.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string().min(1).max(500).optional(),
    // Same "not .datetime()" reasoning as create_reminder's dueAt.
    dueAt: z.string().optional(),
    completed: z.boolean().optional(),
  })
  .refine((v) => v.text !== undefined || v.dueAt !== undefined || v.completed !== undefined, {
    message: 'Provide at least one of text, dueAt, or completed to update.',
  });

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class UpdateReminderTool implements ToolDefinition<Params> {
  readonly name = 'update_reminder';
  readonly description =
    'Edits an existing reminder - its text, due date/time, and/or completed status. Call list_reminders first to find the id.';
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The reminder id, from list_reminders.' },
      text: { type: 'string', description: 'New reminder text, if changing it.' },
      dueAt: {
        type: 'string',
        description:
          "New ISO 8601 due date-time, if changing it. Must include an explicit UTC offset (e.g. '+01:00') or 'Z' - use the timezone given in your system instructions if the user didn't specify one.",
      },
      completed: { type: 'boolean', description: 'Mark the reminder done (true) or not done (false).' },
    },
    required: ['id'],
  };

  constructor(private readonly remindersService: RemindersService) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ id: string; text: string; dueAt: string | null; completed: boolean }> {
    let dueAt: Date | undefined;
    if (args.dueAt !== undefined) {
      dueAt = new Date(args.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        throw new Error(`"${args.dueAt}" is not a valid date/time.`);
      }
    }
    const reminder = await this.remindersService.update(ctx.userId, args.id, {
      text: args.text,
      dueAt,
      completed: args.completed,
    });
    return {
      id: reminder.id,
      text: reminder.text,
      dueAt: reminder.dueAt?.toISOString() ?? null,
      completed: Boolean(reminder.completedAt),
    };
  }
}
