import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { GmailService } from '../../google/gmail.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  maxResults: z.number().int().min(1).max(25).optional(),
});

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class ListUnreadEmailsTool implements ToolDefinition<Params> {
  readonly name = 'list_unread_emails';
  readonly description =
    "Lists the user's unread Gmail messages (sender, subject, snippet, received date). Requires the user's Google account to be connected - if it isn't, tell the user to connect it in Settings.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      maxResults: {
        type: 'number',
        description: 'Maximum number of unread emails to return. Defaults to 10, capped at 25.',
      },
    },
  };

  constructor(private readonly gmailService: GmailService) {}

  async execute(ctx: ToolContext, args: Params) {
    const emails = await this.gmailService.listUnread(ctx.userId, args.maxResults ?? 10);
    return { emails };
  }
}
