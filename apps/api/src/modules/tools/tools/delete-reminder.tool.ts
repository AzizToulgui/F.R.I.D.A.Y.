import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RemindersService } from '../../reminders/reminders.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class DeleteReminderTool implements ToolDefinition<Params> {
  readonly name = 'delete_reminder';
  readonly description =
    'Permanently deletes a reminder. Call list_reminders first to find the id, and confirm with the user which one they mean before deleting.';
  // Deletion here has no confirmation UI to gate on yet (see
  // ToolExecutionService.invoke - both the text and voice paths always call
  // invoke() with confirmed=false, so a requiresConfirmation:true tool would
  // simply never run). Until that exists, the description above is the only
  // safeguard: the model is instructed to double-check with the user first.
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The reminder id, from list_reminders.' },
    },
    required: ['id'],
  };

  constructor(private readonly remindersService: RemindersService) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ deleted: true; id: string }> {
    await this.remindersService.remove(ctx.userId, args.id);
    return { deleted: true, id: args.id };
  }
}
