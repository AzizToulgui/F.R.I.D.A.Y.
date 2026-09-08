import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { NotesService } from '../../notes/notes.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class DeleteNoteTool implements ToolDefinition<Params> {
  readonly name = 'delete_note';
  readonly description =
    'Permanently deletes a note. Call list_notes first to find the id, and confirm with the user which one they mean before deleting.';
  // See DeleteReminderTool for why this doesn't set requiresConfirmation -
  // there's no confirmation UI to gate on yet, so the tool description is
  // the only current safeguard.
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The note id, from list_notes.' },
    },
    required: ['id'],
  };

  constructor(private readonly notesService: NotesService) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ deleted: true; id: string }> {
    await this.notesService.remove(ctx.userId, args.id);
    return { deleted: true, id: args.id };
  }
}
