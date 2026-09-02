import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationConfig } from '../../config/conversation.config';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { ChatMessage, GenerateTextResult, TokenUsage } from '../ai-provider/ai-provider.types';
import { JARVIS_TEXT_SYSTEM_PROMPT } from '../ai-provider/jarvis-persona';
import { ConversationsService } from '../conversations/conversations.service';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message, MessageRole } from '../messages/entities/message.entity';
import { MessagesService } from '../messages/messages.service';

export interface TurnContext {
  systemInstruction: string;
  messages: ChatMessage[];
}

export interface TurnResult {
  messageId: string;
  content: string;
  usage: TokenUsage;
}

const SUMMARY_INSTRUCTION = `Summarize the following older portion of an ongoing conversation between a user and JARVIS, an AI assistant. Preserve names, facts, decisions, and unresolved questions the user cares about. Write the summary in the same language the conversation is in - do not translate it. Be concise - a few sentences to a short paragraph. Reply with the summary itself only, no preamble.`;

@Injectable()
export class ConversationEngineService {
  private readonly logger = new Logger(ConversationEngineService.name);
  private readonly maxHistoryTokens: number;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly aiProvider: AIProvider,
    configService: ConfigService,
  ) {
    this.maxHistoryTokens = configService.get<ConversationConfig>('conversation')!.maxHistoryTokens;
  }

  /** Resolves and ownership-checks the conversation before any SSE headers are written. */
  async getOwnedConversation(userId: string, conversationId: string): Promise<Conversation> {
    return this.conversationsService.findOneOwned(userId, conversationId);
  }

  /**
   * Records the user's message, builds a context-managed prompt, streams the
   * model's reply, and persists it. `yield*`-delegates to the provider's
   * stream so callers get both the text deltas and (via the generator's
   * return value) the final TurnResult without buffering the whole reply.
   */
  async *streamTurn(conversation: Conversation, content: string): AsyncGenerator<string, TurnResult, void> {
    await this.recordUserMessage(conversation.id, content);
    const context = await this.buildTurnContext(conversation);

    const result: GenerateTextResult = yield* this.aiProvider.generateTextStream({
      systemInstruction: context.systemInstruction,
      messages: context.messages,
    });

    const assistantMessage = await this.recordAssistantMessage(conversation.id, result.content, result.usage);
    return { messageId: assistantMessage.id, content: result.content, usage: result.usage };
  }

  private async recordUserMessage(conversationId: string, content: string): Promise<Message> {
    const tokenCount = await this.safeCountTokens(content);
    return this.messagesService.createInternal(conversationId, MessageRole.USER, content, { tokenCount });
  }

  private async recordAssistantMessage(
    conversationId: string,
    content: string,
    usage: TokenUsage,
  ): Promise<Message> {
    return this.messagesService.createInternal(conversationId, MessageRole.ASSISTANT, content, {
      tokenCount: usage.completionTokens,
      metadata: { promptTokens: usage.promptTokens, totalTokens: usage.totalTokens },
    });
  }

  /**
   * Decides what actually gets sent to Gemini this turn: the newest message
   * always goes in verbatim, then as many earlier messages as fit the token
   * budget (newest first); anything older gets folded into the rolling
   * summary instead of being resent, so cost and prompt size stay bounded on
   * long conversations instead of growing without limit.
   */
  private async buildTurnContext(conversation: Conversation): Promise<TurnContext> {
    const allMessages = await this.messagesService.findAllForConversation(conversation.userId, conversation.id);
    const cutoffIndex = conversation.summaryUpToMessageId
      ? allMessages.findIndex((m) => m.id === conversation.summaryUpToMessageId) + 1
      : 0;
    const candidates = allMessages.slice(cutoffIndex);
    if (candidates.length === 0) {
      return {
        systemInstruction: this.buildSystemInstruction(conversation.summary, conversation.customInstructions),
        messages: [],
      };
    }

    const last = candidates[candidates.length - 1];
    const rest = candidates.slice(0, -1);

    let budget = this.maxHistoryTokens - (await this.tokenCountOf(last));
    let cutFrom = rest.length;
    for (let i = rest.length - 1; i >= 0; i--) {
      const cost = await this.tokenCountOf(rest[i]);
      if (cost > budget) break;
      budget -= cost;
      cutFrom = i;
    }

    const toSummarize = rest.slice(0, cutFrom);
    const recent = [...rest.slice(cutFrom), last];

    let summary = conversation.summary;
    if (toSummarize.length > 0) {
      const extended = await this.extendSummary(summary, toSummarize);
      // Only advance the pointer on a successful summarization call - if it
      // failed, these messages stay un-summarized and just get retried (and
      // omitted from this turn's context) on the next turn, rather than
      // being silently marked "summarized" while never actually folded in.
      if (extended !== null) {
        summary = extended;
        conversation.summary = summary;
        conversation.summaryUpToMessageId = toSummarize[toSummarize.length - 1].id;
        await this.conversationsService.saveInternal(conversation);
      }
    }

    return {
      systemInstruction: this.buildSystemInstruction(summary, conversation.customInstructions),
      messages: recent
        .filter((m) => m.role === MessageRole.USER || m.role === MessageRole.ASSISTANT)
        .map((m) => ({ role: m.role === MessageRole.ASSISTANT ? 'model' : 'user', content: m.content })),
    };
  }

  private buildSystemInstruction(summary: string | null, customInstructions: string | null): string {
    const parts = [JARVIS_TEXT_SYSTEM_PROMPT];
    if (summary) {
      parts.push(
        `Summary of earlier parts of this conversation (for your context only - do not repeat it verbatim):\n${summary}`,
      );
    }
    if (customInstructions) {
      parts.push(`The user has asked you to follow these instructions for this conversation:\n${customInstructions}`);
    }
    return parts.join('\n\n');
  }

  /** Returns the new summary text, or null if the summarization call itself failed. */
  private async extendSummary(existing: string | null, toSummarize: Message[]): Promise<string | null> {
    const transcript = toSummarize
      .map((m) => `${m.role === MessageRole.ASSISTANT ? 'JARVIS' : 'User'}: ${m.content}`)
      .join('\n');
    const prompt = existing
      ? `${SUMMARY_INSTRUCTION}\n\nExisting summary of even earlier context:\n${existing}\n\nNew messages to fold in:\n${transcript}`
      : `${SUMMARY_INSTRUCTION}\n\n${transcript}`;

    try {
      const result = await this.aiProvider.generateText({ messages: [{ role: 'user', content: prompt }] });
      return result.content.trim();
    } catch (error) {
      this.logger.warn(
        'Summarization call failed; these messages will be omitted from context and retried next turn',
        error instanceof Error ? error.stack : error,
      );
      return null;
    }
  }

  private async tokenCountOf(message: Message): Promise<number> {
    if (message.tokenCount !== null) return message.tokenCount;
    const count = await this.safeCountTokens(message.content);
    await this.messagesService.updateTokenCount(message.id, count);
    message.tokenCount = count;
    return count;
  }

  private async safeCountTokens(content: string): Promise<number> {
    try {
      return await this.aiProvider.countTokens({ messages: [{ role: 'user', content }] });
    } catch (error) {
      this.logger.warn(
        'countTokens failed; falling back to a rough character-based estimate',
        error instanceof Error ? error.stack : error,
      );
      return Math.ceil(content.length / 4);
    }
  }
}
