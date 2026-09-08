import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { NotesService } from '../../notes/notes.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().max(200).optional(),
    content: z.string().min(1).max(10000).optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: 'Provide at least one of title or content to update.',
  });

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class UpdateNoteTool implements ToolDefinition<Params> {
  readonly name = 'update_note';
  readonly description = 'Edits an existing note - its title and/or content. Call list_notes first to find the id.';
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The note id, from list_notes.' },
      title: { type: 'string', description: 'New title, if changing it.' },
      content: { type: 'string', description: 'New content, if changing it.' },
    },
    required: ['id'],
  };

  constructor(private readonly notesService: NotesService) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ id: string; title: string | null; content: string }> {
    const note = await this.notesService.update(ctx.userId, args.id, { title: args.title, content: args.content });
    return { id: note.id, title: note.title, content: note.content };
  }
}
