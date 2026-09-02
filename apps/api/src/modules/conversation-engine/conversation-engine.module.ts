import { Module } from '@nestjs/common';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationEngineService } from './conversation-engine.service';
import { TurnsController } from './turns.controller';

@Module({
  imports: [ConversationsModule, MessagesModule, AIProviderModule],
  controllers: [TurnsController],
  providers: [ConversationEngineService],
})
export class ConversationEngineModule {}
