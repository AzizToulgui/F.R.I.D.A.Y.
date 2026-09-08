import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RemindersService } from '../../reminders/reminders.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  includeCompleted: z.boolean().optional(),
});

type Params = z.infer<typeof paramsSchema>;

interface ReminderSummary {
  id: string;
  text: string;
  dueAt: string | null;
  completed: boolean;
}

// Read-only lookup so update_reminder/delete_reminder (which both need an
// id) have a way to find one - neither the model nor a fresh voice session
// has any other way to know what reminders already exist.
@Injectable()
export class ListRemindersTool implements ToolDefinition<Params> {
  readonly name = 'list_reminders';
  readonly description =
    "Lists the user's reminders (id, text, due date/time, completed status). Call this before update_reminder or delete_reminder to find the right id - never guess one.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      includeCompleted: {
        type: 'boolean',
        description: 'Include already-completed reminders. Defaults to false (pending only).',
      },
    },
  };

  constructor(private readonly remindersService: RemindersService) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ reminders: ReminderSummary[] }> {
    const all = await this.remindersService.findAllForUser(ctx.userId);
    const filtered = args.includeCompleted ? all : all.filter((r) => !r.completedAt);
    return {
      reminders: filtered.map((r) => ({
        id: r.id,
        text: r.text,
        dueAt: r.dueAt?.toISOString() ?? null,
        completed: Boolean(r.completedAt),
      })),
    };
  }
}
