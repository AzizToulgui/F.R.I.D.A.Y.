import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { MemoryConfig } from '../../config/memory.config';
import { toVectorLiteral } from '../../database/pgvector.util';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { Memory } from './entities/memory.entity';
import { MEMORY_EXTRACTION_QUEUE, MemoryExtractionJob } from './memory-extraction.queue';

export interface RetrievedMemory {
  id: string;
  content: string;
}

// Everything that touches the `embedding` column goes through raw SQL here
// (see Memory entity) - plain repository find/save calls elsewhere in this
// service never see or need to know about that column.
@Injectable()
export class MemoriesService {
  private readonly logger = new Logger(MemoriesService.name);
  private readonly config: MemoryConfig;

  constructor(
    @InjectRepository(Memory)
    private readonly memoriesRepository: Repository<Memory>,
    private readonly aiProvider: AIProvider,
    configService: ConfigService,
    @InjectQueue(MEMORY_EXTRACTION_QUEUE)
    private readonly extractionQueue: Queue<MemoryExtractionJob>,
  ) {
    this.config = configService.get<MemoryConfig>('memory')!;
  }

  async findAllForUser(userId: string): Promise<Memory[]> {
    return this.memoriesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // Throws NotFound (not Forbidden) for someone else's memory, matching
  // ConversationsService.findOneOwned - an id probe can't distinguish
  // "doesn't exist" from "isn't yours".
  async findOneOwned(userId: string, id: string): Promise<Memory> {
    const memory = await this.memoriesRepository.findOne({ where: { id } });
    if (!memory || memory.userId !== userId) {
      throw new NotFoundException('Memory not found');
    }
    return memory;
  }

  async update(userId: string, id: string, dto: UpdateMemoryDto): Promise<Memory> {
    await this.findOneOwned(userId, id);
    const embedding = await this.aiProvider.generateEmbedding(dto.content);
    await this.memoriesRepository.manager.query(
      `UPDATE "memories" SET "content" = $1, "embedding" = $2::vector, "updated_at" = now() WHERE "id" = $3`,
      [dto.content, toVectorLiteral(embedding.vector), id],
    );
    return this.findOneOwned(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const memory = await this.findOneOwned(userId, id);
    await this.memoriesRepository.remove(memory);
  }

  async removeAllForUser(userId: string): Promise<void> {
    await this.memoriesRepository.delete({ userId });
  }

  /**
   * Embeds each candidate and deduplicates against the user's existing
   * memories via cosine-similarity threshold before inserting - called by
   * MemoryExtractionProcessor, never on the live request path.
   */
  async proposeAndStore(userId: string, sourceConversationId: string, candidates: string[]): Promise<number> {
    let stored = 0;
    for (const content of candidates) {
      const trimmed = content.trim();
      if (!trimmed) continue;

      let vector: number[];
      try {
        vector = (await this.aiProvider.generateEmbedding(trimmed)).vector;
      } catch (error) {
        this.logger.warn('Skipping candidate memory - embedding failed', error instanceof Error ? error.stack : error);
        continue;
      }
      const literal = toVectorLiteral(vector);

      const nearest = await this.memoriesRepository.manager.query<{ similarity: number }[]>(
        `SELECT 1 - (embedding <=> $1::vector) AS similarity FROM "memories" WHERE "user_id" = $2 ORDER BY embedding <=> $1::vector LIMIT 1`,
        [literal, userId],
      );
      if (nearest[0] && nearest[0].similarity >= this.config.dedupSimilarityThreshold) {
        continue;
      }

      await this.memoriesRepository.manager.query(
        `INSERT INTO "memories" ("id", "created_at", "updated_at", "user_id", "content", "embedding", "source_conversation_id", "confidence")
         VALUES (gen_random_uuid(), now(), now(), $1, $2, $3::vector, $4, 1)`,
        [userId, trimmed, literal, sourceConversationId],
      );
      stored++;
    }
    return stored;
  }

  /**
   * Top-K memories relevant to `queryText`, scoped to `userId`. Marks the
   * returned memories' `last_used_at` so retrieval recency is observable
   * (Section 9) - best-effort, never blocks the caller on failure.
   */
  async retrieveRelevant(userId: string, queryText: string, topK?: number): Promise<RetrievedMemory[]> {
    let vector: number[];
    try {
      vector = (await this.aiProvider.generateEmbedding(queryText)).vector;
    } catch (error) {
      this.logger.warn('Memory retrieval skipped - embedding failed', error instanceof Error ? error.stack : error);
      return [];
    }
    const literal = toVectorLiteral(vector);
    const limit = topK ?? this.config.retrievalTopK;

    const rows = await this.memoriesRepository.manager.query<{ id: string; content: string }[]>(
      `SELECT "id", "content" FROM "memories" WHERE "user_id" = $1 ORDER BY embedding <=> $2::vector LIMIT $3`,
      [userId, literal, limit],
    );
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      await this.memoriesRepository.manager.query(
        `UPDATE "memories" SET "last_used_at" = now() WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
    }
    return rows;
  }

  /** Enqueues a background extraction pass for this turn - never runs inline on the request path. */
  async enqueueExtraction(userId: string, conversationId: string): Promise<void> {
    await this.extractionQueue.add('extract', { userId, conversationId });
  }
}
