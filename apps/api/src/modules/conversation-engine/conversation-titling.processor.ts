import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { ConversationConfig } from '../../config/conversation.config';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { ConversationsService } from '../conversations/conversations.service';
import { DEFAULT_CONVERSATION_TITLE } from '../conversations/entities/conversation.entity';
import { MessageRole } from '../messages/entities/message.entity';
import { MessagesService } from '../messages/messages.service';
import { CONVERSATION_TITLING_QUEUE, ConversationTitlingJob } from './conversation-titling.queue';

const MAX_MESSAGES_FOR_TITLE = 3;
const MAX_TITLE_LENGTH = 80;

const TITLE_INSTRUCTION = `Generate a short, specific title for this conversation between a user and JARVIS, an AI assistant, based on the excerpt below. The title should be 3-6 words, written in the same language as the conversation. Reply with the title only - no surrounding quotes, no trailing punctuation, nothing else.`;

// Runs off the request path (see ConversationEngineService.streamTurn) -
// only ever generates/overwrites a title while it's still exactly
// DEFAULT_CONVERSATION_TITLE, so a user's manual rename is never clobbered
// and a conversation is never auto-titled more than once.
@Injectable()
@Processor(CONVERSATION_TITLING_QUEUE)
export class ConversationTitlingProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversationTitlingProcessor.name);
  private readonly titlingModel: string;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly aiProvider: AIProvider,
    configService: ConfigService,
  ) {
    super();
    this.titlingModel = configService.get<ConversationConfig>('conversation')!.titlingModel;
  }

  async process(job: Job<ConversationTitlingJob>): Promise<void> {
    const { conversationId, userId } = job.data;

    const conversation = await this.conversationsService.findOneOwned(userId, conversationId).catch(() => null);
    if (!conversation || conversation.title !== DEFAULT_CONVERSATION_TITLE) return;

    const messages = (await this.messagesService.findAllForConversation(userId, conversationId))
      .filter((m) => m.role === MessageRole.USER || m.role === MessageRole.ASSISTANT)
      .slice(0, MAX_MESSAGES_FOR_TITLE);
    if (messages.length === 0) return;

    const transcript = messages
      .map((m) => `${m.role === MessageRole.ASSISTANT ? 'JARVIS' : 'User'}: ${m.content}`)
      .join('\n');

    let title: string;
    try {
      const result = await this.aiProvider.generateText({
        model: this.titlingModel,
        messages: [{ role: 'user', content: `${TITLE_INSTRUCTION}\n\n${transcript}` }],
      });
      title = this.sanitize(result.content);
    } catch (error) {
      this.logger.warn(
        `Title generation failed for conversation ${conversationId} - will retry via BullMQ`,
        error instanceof Error ? error.stack : error,
      );
      // Rethrow (rather than swallow) so BullMQ's own retry/backoff picks this
      // up - a transient Gemini error otherwise went silent forever unless the
      // user happened to send another message in this same conversation.
      throw error;
    }
    if (!title) return;

    // Re-check right before writing - the conversation may have been
    // manually renamed (or already auto-titled by an earlier-enqueued job
    // for this same conversation) while this generation call was in flight.
    const fresh = await this.conversationsService.findOneOwned(userId, conversationId).catch(() => null);
    if (!fresh || fresh.title !== DEFAULT_CONVERSATION_TITLE) return;
    await this.conversationsService.updateTitleInternal(conversationId, title);
    this.logger.log(`Titled conversation ${conversationId}: "${title}"`);
  }

  private sanitize(raw: string): string {
    const cleaned = raw
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .replace(/[.!?]+$/, '')
      .trim();
    return cleaned.slice(0, MAX_TITLE_LENGTH);
  }
}
