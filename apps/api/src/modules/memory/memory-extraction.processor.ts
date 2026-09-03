import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { MemoryConfig } from '../../config/memory.config';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { ConversationsService } from '../conversations/conversations.service';
import { MessageRole } from '../messages/entities/message.entity';
import { MessagesService } from '../messages/messages.service';
import { MEMORY_EXTRACTION_QUEUE, MemoryExtractionJob } from './memory-extraction.queue';
import { MemoriesService } from './memories.service';

const EXTRACTION_INSTRUCTION = `You are extracting durable, cross-conversation facts about a user from a snippet of their conversation with JARVIS, an AI assistant.

Identify only facts worth remembering long-term: stable preferences, identity details, ongoing projects, relationships, recurring context. Do NOT extract: raw credentials or secrets, health specifics, financial specifics, or anything that clearly only applies to this one conversation.

Reply with a JSON array of short, self-contained fact strings, each written in third person (e.g. "Prefers TypeScript with strict mode"). If there is nothing worth remembering, reply with exactly: []
Reply with the JSON array only - no other text, no markdown code fences.`;

// Runs off the request path (see MemoriesService.enqueueExtraction) - a
// failed or slow run never delays a conversation turn. Only ever advances
// `memoryExtractedUpToMessageId` on success, so a failure just gets retried
// (with any newer messages folded in) the next time this conversation enqueues a job.
@Injectable()
@Processor(MEMORY_EXTRACTION_QUEUE)
export class MemoryExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(MemoryExtractionProcessor.name);
  private readonly config: MemoryConfig;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly memoriesService: MemoriesService,
    private readonly aiProvider: AIProvider,
    configService: ConfigService,
  ) {
    super();
    this.config = configService.get<MemoryConfig>('memory')!;
  }

  async process(job: Job<MemoryExtractionJob>): Promise<void> {
    const { userId, conversationId } = job.data;
    const conversation = await this.conversationsService.findOneOwned(userId, conversationId);
    const allMessages = await this.messagesService.findAllForConversation(userId, conversationId);

    const cutoffIndex = conversation.memoryExtractedUpToMessageId
      ? allMessages.findIndex((m) => m.id === conversation.memoryExtractedUpToMessageId) + 1
      : 0;
    const candidates = allMessages
      .slice(cutoffIndex)
      .filter((m) => m.role === MessageRole.USER || m.role === MessageRole.ASSISTANT);
    if (candidates.length === 0) return;

    const transcript = candidates
      .map((m) => `${m.role === MessageRole.ASSISTANT ? 'JARVIS' : 'User'}: ${m.content}`)
      .join('\n');

    let raw: string;
    try {
      const result = await this.aiProvider.generateText({
        model: this.config.extractionModel,
        messages: [{ role: 'user', content: `${EXTRACTION_INSTRUCTION}\n\n${transcript}` }],
      });
      raw = result.content;
    } catch (error) {
      this.logger.warn(
        'Memory extraction call failed; will retry on this conversation\'s next turn',
        error instanceof Error ? error.stack : error,
      );
      return;
    }

    const facts = this.parseFacts(raw);
    if (facts.length > 0) {
      const stored = await this.memoriesService.proposeAndStore(userId, conversationId, facts);
      this.logger.log(`Extracted ${stored}/${facts.length} new memories from conversation ${conversationId}`);
    }

    conversation.memoryExtractedUpToMessageId = candidates[candidates.length - 1].id;
    await this.conversationsService.saveInternal(conversation);
  }

  private parseFacts(raw: string): string[] {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    try {
      const parsed: unknown = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter((fact): fact is string => typeof fact === 'string');
      }
    } catch {
      // Model didn't return valid JSON - treat as "nothing extracted" rather than failing the job.
    }
    return [];
  }
}
