import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RemindersService } from '../../reminders/reminders.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  text: z.string().min(1).max(500),
  // Not `.datetime()` - the model is free to pass whatever ISO-ish string it
  // resolved from natural language ("tomorrow at 5pm"); `new Date(...)`
  // parses it and an unparseable value fails loudly in execute() instead of
  // silently rejecting a slightly-off-spec but still valid instant.
  dueAt: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

// A reminder is an additive, easily-undone write (unlike "send a message" or
// "delete a reminder", ARCHITECTURE.md Section 10's own examples of
// sensitive actions) - so this does not set requiresConfirmation.
@Injectable()
export class CreateReminderTool implements ToolDefinition<Params> {
  readonly name = 'create_reminder';
  readonly description =
    'Creates a reminder for the user. Use this whenever the user asks to be reminded about something, with an optional due date/time.';
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'What to remind the user about.' },
      dueAt: {
        type: 'string',
        description: 'ISO 8601 date-time the reminder is due, if the user gave or implied one.',
      },
    },
    required: ['text'],
  };

  constructor(private readonly remindersService: RemindersService) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ id: string; text: string; dueAt: string | null }> {
    let dueAt: Date | null = null;
    if (args.dueAt) {
      dueAt = new Date(args.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        throw new Error(`"${args.dueAt}" is not a valid date/time.`);
      }
    }
    const reminder = await this.remindersService.create(ctx.userId, args.text, dueAt);
    return { id: reminder.id, text: reminder.text, dueAt: reminder.dueAt?.toISOString() ?? null };
  }
}
