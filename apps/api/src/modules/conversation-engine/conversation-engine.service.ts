import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ConversationConfig } from '../../config/conversation.config';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { ChatMessage, GenerateTextResult, TokenUsage } from '../ai-provider/ai-provider.types';
import { JARVIS_TEXT_SYSTEM_PROMPT } from '../ai-provider/jarvis-persona';
import { ConversationsService } from '../conversations/conversations.service';
import { Conversation, DEFAULT_CONVERSATION_TITLE } from '../conversations/entities/conversation.entity';
import { DocumentsService, RetrievedChunk } from '../documents/documents.service';
import { MemoriesService } from '../memory/memories.service';
import { Message, MessageRole } from '../messages/entities/message.entity';
import { MessagesService } from '../messages/messages.service';
import { ToolExecutionService } from '../tools/tool-execution.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { CONVERSATION_TITLING_QUEUE, ConversationTitlingJob } from './conversation-titling.queue';

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

// Safety cap on Gemini <-> tool round trips within a single turn - a
// well-behaved model resolves in 1-2, this only guards against a runaway
// loop (e.g. a tool the model keeps re-calling with the same bad arguments).
const MAX_TOOL_ROUNDS = 4;

@Injectable()
export class ConversationEngineService {
  private readonly logger = new Logger(ConversationEngineService.name);
  private readonly maxHistoryTokens: number;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly memoriesService: MemoriesService,
    private readonly documentsService: DocumentsService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly toolExecutionService: ToolExecutionService,
    private readonly aiProvider: AIProvider,
    @InjectQueue(CONVERSATION_TITLING_QUEUE)
    private readonly titlingQueue: Queue<ConversationTitlingJob>,
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
    const context = await this.buildTurnContext(conversation, content);
    const tools = this.toolRegistry.getDeclarations();

    let messages = context.messages;
    let result: GenerateTextResult | undefined;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      result = yield* this.aiProvider.generateTextStream({
        systemInstruction: context.systemInstruction,
        messages,
        tools,
      });
      if (!result.functionCalls?.length || round === MAX_TOOL_ROUNDS) break;

      // Never auto-confirms (see ToolExecutionService.invoke) - a future
      // requiresConfirmation tool would just come back as a blocked result
      // here, which the model then has to explain to the user itself.
      const toolResponses = await this.toolExecutionService.invokeAll(
        { userId: conversation.userId, conversationId: conversation.id },
        result.functionCalls,
      );
      messages = [
        ...messages,
        { role: 'model', content: result.content, functionCalls: result.functionCalls },
        { role: 'user', content: '', functionResponses: toolResponses },
      ];
    }

    const assistantMessage = await this.recordAssistantMessage(conversation.id, result!.content, result!.usage);

    // Touches updated_at even when nothing else about the row changed, so a
    // conversation list ordered by it (the sidebar navigator) reflects real
    // recent activity - otherwise a short conversation's updated_at would
    // stay stuck at creation time (summarization is the only other thing
    // that saves this entity, and that only fires once history grows).
    await this.conversationsService.saveInternal(conversation);

    // Background/best-effort: this turn's reply must never be delayed or
    // failed by memory bookkeeping - see MemoriesService.enqueueExtraction.
    try {
      await this.memoriesService.enqueueExtraction(conversation.userId, conversation.id);
    } catch (error) {
      this.logger.warn('Failed to enqueue memory extraction job', error instanceof Error ? error.stack : error);
    }

    // Same best-effort treatment - only enqueued while still untitled, so
    // this naturally stops firing after the first turn that succeeds (or
    // after a manual rename beats it to the punch).
    if (conversation.title === DEFAULT_CONVERSATION_TITLE) {
      try {
        await this.titlingQueue.add('title', { conversationId: conversation.id, userId: conversation.userId });
      } catch (error) {
        this.logger.warn('Failed to enqueue conversation titling job', error instanceof Error ? error.stack : error);
      }
    }

    return { messageId: assistantMessage.id, content: result!.content, usage: result!.usage };
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
  private async buildTurnContext(conversation: Conversation, latestUserContent: string): Promise<TurnContext> {
    const relevantMemories = await this.retrieveRelevantMemories(conversation.userId, latestUserContent);
    const relevantChunks = await this.retrieveRelevantDocumentChunks(conversation.userId, latestUserContent);
    const allMessages = await this.messagesService.findAllForConversation(conversation.userId, conversation.id);
    const cutoffIndex = conversation.summaryUpToMessageId
      ? allMessages.findIndex((m) => m.id === conversation.summaryUpToMessageId) + 1
      : 0;
    const candidates = allMessages.slice(cutoffIndex);
    if (candidates.length === 0) {
      return {
        systemInstruction: this.buildSystemInstruction(
          conversation.summary,
          conversation.customInstructions,
          relevantMemories,
          relevantChunks,
        ),
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
      systemInstruction: this.buildSystemInstruction(
        summary,
        conversation.customInstructions,
        relevantMemories,
        relevantChunks,
      ),
      messages: recent
        .filter((m) => m.role === MessageRole.USER || m.role === MessageRole.ASSISTANT)
        .map((m) => ({ role: m.role === MessageRole.ASSISTANT ? 'model' : 'user', content: m.content })),
    };
  }

  private buildSystemInstruction(
    summary: string | null,
    customInstructions: string | null,
    relevantMemories: string[],
    relevantChunks: RetrievedChunk[],
  ): string {
    const parts = [JARVIS_TEXT_SYSTEM_PROMPT];
    if (relevantMemories.length > 0) {
      parts.push(
        `Things you remember about this user from past conversations (for your context only - do not repeat them verbatim unless relevant):\n${relevantMemories.map((m) => `- ${m}`).join('\n')}`,
      );
    }
    if (relevantChunks.length > 0) {
      const excerpts = relevantChunks
        .map((chunk) => {
          const source = chunk.headingPath ? `${chunk.documentTitle} > ${chunk.headingPath}` : chunk.documentTitle;
          return `[Source: ${source}]\n${chunk.content}`;
        })
        .join('\n\n');
      parts.push(
        `Relevant excerpts from documents the user has uploaded to their knowledge base. When you use one, cite it by the document title (and section, if given) shown in its [Source: ...] line - do not fabricate a citation for anything not shown here:\n\n${excerpts}`,
      );
    }
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

  // Best-effort: a slow/failed retrieval degrades to "no memories this turn"
  // rather than failing or delaying the user's reply.
  private async retrieveRelevantMemories(userId: string, queryText: string): Promise<string[]> {
    try {
      const memories = await this.memoriesService.retrieveRelevant(userId, queryText);
      return memories.map((m) => m.content);
    } catch (error) {
      this.logger.warn('Memory retrieval failed; continuing without it', error instanceof Error ? error.stack : error);
      return [];
    }
  }

  // Best-effort: a slow/failed retrieval degrades to "no document context
  // this turn" rather than failing or delaying the user's reply.
  private async retrieveRelevantDocumentChunks(userId: string, queryText: string): Promise<RetrievedChunk[]> {
    try {
      return await this.documentsService.retrieveRelevantChunks(userId, queryText);
    } catch (error) {
      this.logger.warn('Document retrieval failed; continuing without it', error instanceof Error ? error.stack : error);
      return [];
    }
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
