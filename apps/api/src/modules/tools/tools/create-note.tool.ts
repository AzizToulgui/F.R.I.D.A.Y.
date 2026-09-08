import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { NotesService } from '../../notes/notes.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10000),
});

type Params = z.infer<typeof paramsSchema>;

// An additive, easily-undone write (same reasoning as CreateReminderTool) -
// does not set requiresConfirmation.
@Injectable()
export class CreateNoteTool implements ToolDefinition<Params> {
  readonly name = 'create_note';
  readonly description =
    'Saves a new note for the user. Use this whenever the user asks you to save, jot down, or remember something as a note.';
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short title for the note, if the user gave or implied one.' },
      content: { type: 'string', description: 'The note content.' },
    },
    required: ['content'],
  };

  constructor(private readonly notesService: NotesService) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ id: string; title: string | null; content: string }> {
    const note = await this.notesService.create(ctx.userId, args.title ?? null, args.content);
    return { id: note.id, title: note.title, content: note.content };
  }
}
