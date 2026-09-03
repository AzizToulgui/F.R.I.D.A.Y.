import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { promises as fs } from 'node:fs';
import { Repository } from 'typeorm';
import { RagConfig } from '../../config/rag.config';
import { toVectorLiteral } from '../../database/pgvector.util';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { chunkText } from './chunker';
import { parseDocumentText } from './document-parser';
import { DOCUMENT_INDEXING_QUEUE, DocumentIndexingJob } from './document-indexing.queue';
import { DocumentsService } from './documents.service';
import { DocumentChunk } from './entities/document-chunk.entity';

// Runs off the request path (see DocumentsService.createFromUpload) - parses
// the uploaded file, chunks it, embeds each chunk, and stores the chunks.
// Embedding failures are per-chunk best-effort (the rest of the document
// still gets indexed); only a total failure marks the whole document 'error'.
@Injectable()
@Processor(DOCUMENT_INDEXING_QUEUE)
export class DocumentIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIndexingProcessor.name);
  private readonly ragConfig: RagConfig;

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly aiProvider: AIProvider,
    @InjectRepository(DocumentChunk)
    private readonly chunksRepository: Repository<DocumentChunk>,
    configService: ConfigService,
  ) {
    super();
    this.ragConfig = configService.get<RagConfig>('rag')!;
  }

  async process(job: Job<DocumentIndexingJob>): Promise<void> {
    const { documentId, userId, filePath, format } = job.data;
    try {
      const buffer = await fs.readFile(filePath);
      const text = await parseDocumentText(buffer, format);
      const chunks = chunkText(text, this.ragConfig.chunkTargetTokens, this.ragConfig.chunkOverlapRatio);

      if (chunks.length === 0) {
        await this.documentsService.markError(documentId, 'No extractable text was found in this document.');
        return;
      }

      let stored = 0;
      for (const [index, chunk] of chunks.entries()) {
        let vector: number[];
        try {
          vector = (await this.aiProvider.generateEmbedding(chunk.content)).vector;
        } catch (error) {
          this.logger.warn(
            `Embedding failed for chunk ${index} of document ${documentId} - skipping just this chunk`,
            error instanceof Error ? error.stack : error,
          );
          continue;
        }

        await this.chunksRepository.manager.query(
          `INSERT INTO "document_chunks"
             ("id", "created_at", "updated_at", "document_id", "user_id", "content", "embedding", "chunk_index", "heading_path")
           VALUES (gen_random_uuid(), now(), now(), $1, $2, $3, $4::vector, $5, $6)`,
          [documentId, userId, chunk.content, toVectorLiteral(vector), index, chunk.headingPath],
        );
        stored++;
      }

      if (stored === 0) {
        await this.documentsService.markError(documentId, 'Could not generate embeddings for this document.');
        return;
      }
      await this.documentsService.markIndexed(documentId, stored);
    } catch (error) {
      this.logger.error(`Indexing failed for document ${documentId}`, error instanceof Error ? error.stack : error);
      await this.documentsService.markError(documentId, 'Failed to process this document.');
    } finally {
      await fs.unlink(filePath).catch(() => {
        // Best-effort cleanup - a leftover temp file is a nuisance, not a correctness issue.
      });
    }
  }
}
