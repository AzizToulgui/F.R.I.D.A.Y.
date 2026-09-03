import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Repository } from 'typeorm';
import { RagConfig } from '../../config/rag.config';
import { toVectorLiteral } from '../../database/pgvector.util';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { detectFormat } from './document-parser';
import { DOCUMENT_INDEXING_QUEUE, DocumentIndexingJob } from './document-indexing.queue';
import { Document, DocumentStatus } from './entities/document.entity';

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  content: string;
  headingPath: string | null;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly ragConfig: RagConfig;

  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    private readonly aiProvider: AIProvider,
    configService: ConfigService,
    @InjectQueue(DOCUMENT_INDEXING_QUEUE)
    private readonly indexingQueue: Queue<DocumentIndexingJob>,
  ) {
    this.ragConfig = configService.get<RagConfig>('rag')!;
  }

  async findAllForUser(userId: string): Promise<Document[]> {
    return this.documentsRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  // Throws NotFound (not Forbidden) for someone else's document, matching
  // every other *Service.findOneOwned in this codebase.
  async findOneOwned(userId: string, id: string): Promise<Document> {
    const document = await this.documentsRepository.findOne({ where: { id } });
    if (!document || document.userId !== userId) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async remove(userId: string, id: string): Promise<void> {
    const document = await this.findOneOwned(userId, id);
    await this.documentsRepository.remove(document);
  }

  /**
   * Persists the Document row and hands the raw bytes to a background job
   * for parsing/chunking/embedding - the request returns immediately with an
   * `indexing` document rather than blocking on however long that takes.
   */
  async createFromUpload(userId: string, filename: string, mimetype: string, buffer: Buffer): Promise<Document> {
    const format = detectFormat(filename, mimetype);
    if (!format) {
      throw new BadRequestException('Unsupported file type - upload a PDF, DOCX, Markdown, or plain text file.');
    }

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const existing = await this.documentsRepository.findOne({ where: { userId, contentHash } });
    if (existing) {
      // Re-embedding is skipped for unchanged documents (Section 11) - the
      // identical file was already uploaded (and indexed, or is still being
      // indexed), so there is nothing new to do.
      return existing;
    }

    const document = await this.documentsRepository.save(
      this.documentsRepository.create({
        userId,
        title: filename,
        format,
        status: DocumentStatus.INDEXING,
        contentHash,
        sizeBytes: buffer.length,
        chunkCount: 0,
      }),
    );

    const filePath = path.join(os.tmpdir(), `jarvis-doc-${document.id}-${randomUUID()}`);
    try {
      await fs.writeFile(filePath, buffer);
      await this.indexingQueue.add('index', { documentId: document.id, userId, filePath, format });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue indexing for document ${document.id}`,
        error instanceof Error ? error.stack : error,
      );
      await this.markError(document.id, 'Could not start processing this document.');
    }

    return document;
  }

  async markIndexed(id: string, chunkCount: number): Promise<void> {
    await this.documentsRepository.update(id, { status: DocumentStatus.INDEXED, chunkCount, errorMessage: null });
  }

  async markError(id: string, message: string): Promise<void> {
    await this.documentsRepository.update(id, { status: DocumentStatus.ERROR, errorMessage: message });
  }

  /**
   * Top-K document chunks relevant to `queryText`, scoped to `userId` -
   * mirrors MemoriesService.retrieveRelevant. Best-effort: an embedding or
   * DB failure degrades to "no context this turn" rather than failing the caller.
   */
  async retrieveRelevantChunks(userId: string, queryText: string, topK?: number): Promise<RetrievedChunk[]> {
    let vector: number[];
    try {
      vector = (await this.aiProvider.generateEmbedding(queryText)).vector;
    } catch (error) {
      this.logger.warn('Document retrieval skipped - embedding failed', error instanceof Error ? error.stack : error);
      return [];
    }
    const literal = toVectorLiteral(vector);
    const limit = topK ?? this.ragConfig.retrievalTopK;

    return this.documentsRepository.manager.query<RetrievedChunk[]>(
      `SELECT c."document_id" AS "documentId", d."title" AS "documentTitle", c."content", c."heading_path" AS "headingPath"
       FROM "document_chunks" c
       JOIN "documents" d ON d."id" = c."document_id"
       WHERE c."user_id" = $1
       ORDER BY c."embedding" <=> $2::vector
       LIMIT $3`,
      [userId, literal, limit],
    );
  }
}
