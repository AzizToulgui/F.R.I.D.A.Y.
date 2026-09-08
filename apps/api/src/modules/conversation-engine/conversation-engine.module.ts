import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { DocumentsModule } from '../documents/documents.module';
import { MemoryModule } from '../memory/memory.module';
import { MessagesModule } from '../messages/messages.module';
import { ToolsModule } from '../tools/tools.module';
import { UsersModule } from '../users/users.module';
import { ConversationEngineService } from './conversation-engine.service';
import { CONVERSATION_TITLING_QUEUE } from './conversation-titling.queue';
import { ConversationTitlingProcessor } from './conversation-titling.processor';
import { TurnsController } from './turns.controller';

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    AIProviderModule,
    MemoryModule,
    ToolsModule,
    DocumentsModule,
    UsersModule,
    BullModule.registerQueue({ name: CONVERSATION_TITLING_QUEUE }),
  ],
  controllers: [TurnsController],
  providers: [ConversationEngineService, ConversationTitlingProcessor],
})
export class ConversationEngineModule {}
