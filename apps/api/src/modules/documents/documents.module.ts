import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { DOCUMENT_INDEXING_QUEUE } from './document-indexing.queue';
import { DocumentIndexingProcessor } from './document-indexing.processor';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentChunk } from './entities/document-chunk.entity';
import { Document } from './entities/document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentChunk]),
    BullModule.registerQueue({ name: DOCUMENT_INDEXING_QUEUE }),
    AIProviderModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIndexingProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}
