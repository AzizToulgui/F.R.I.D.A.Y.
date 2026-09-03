import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { Message } from '../../messages/entities/message.entity';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  query: z.string().min(1).max(200),
});

type Params = z.infer<typeof paramsSchema>;

const MAX_RESULTS = 5;
const SNIPPET_LENGTH = 300;

// Read-only, scoped to the caller's own data via the `conversation.user_id`
// join below - there is no query shape here that can reach another user's
// messages (see ARCHITECTURE.md Section 10: "search_application_data
// (read-only, scoped to the user's own data)").
@Injectable()
export class SearchApplicationDataTool implements ToolDefinition<Params> {
  readonly name = 'search_application_data';
  readonly description =
    "Searches the user's own past conversations with JARVIS for messages matching a keyword or phrase. Use this when the user references something they said in a different, earlier conversation that isn't already in view.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keyword or short phrase to search for.' },
    },
    required: ['query'],
  };

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
  ) {}

  async execute(ctx: ToolContext, args: Params): Promise<{ results: Record<string, unknown>[] }> {
    const rows = await this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .where('conversation.user_id = :userId', { userId: ctx.userId })
      .andWhere('message.content ILIKE :query', { query: `%${args.query}%` })
      .orderBy('message.created_at', 'DESC')
      .take(MAX_RESULTS)
      .getMany();

    return {
      results: rows.map((message) => ({
        conversationId: message.conversationId,
        role: message.role,
        snippet: message.content.slice(0, SNIPPET_LENGTH),
        createdAt: message.createdAt,
      })),
    };
  }
}
