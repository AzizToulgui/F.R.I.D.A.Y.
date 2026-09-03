import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { Memory } from './entities/memory.entity';
import { MemoriesController } from './memories.controller';
import { MemoriesService } from './memories.service';
import { MEMORY_EXTRACTION_QUEUE } from './memory-extraction.queue';
import { MemoryExtractionProcessor } from './memory-extraction.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Memory]),
    BullModule.registerQueue({ name: MEMORY_EXTRACTION_QUEUE }),
    ConversationsModule,
    MessagesModule,
    AIProviderModule,
  ],
  controllers: [MemoriesController],
  providers: [MemoriesService, MemoryExtractionProcessor],
  exports: [MemoriesService],
})
export class MemoryModule {}
