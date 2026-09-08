import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { NotesService } from '../../notes/notes.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({});

type Params = z.infer<typeof paramsSchema>;

interface NoteSummary {
  id: string;
  title: string | null;
  content: string;
}

// Read-only lookup so update_note/delete_note (which both need an id) have
// a way to find one - same reasoning as list_reminders.
@Injectable()
export class ListNotesTool implements ToolDefinition<Params> {
  readonly name = 'list_notes';
  readonly description =
    "Lists the user's saved notes (id, title, content). Call this before update_note or delete_note to find the right id - never guess one.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = { type: 'object', properties: {} };

  constructor(private readonly notesService: NotesService) {}

  async execute(ctx: ToolContext): Promise<{ notes: NoteSummary[] }> {
    const notes = await this.notesService.findAllForUser(ctx.userId);
    return { notes: notes.map((n) => ({ id: n.id, title: n.title, content: n.content })) };
  }
}
