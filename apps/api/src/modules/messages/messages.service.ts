import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationsService } from '../conversations/conversations.service';
import { Message, MessageRole } from './entities/message.entity';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly conversationsService: ConversationsService,
  ) {}

  async findAllForConversation(userId: string, conversationId: string): Promise<Message[]> {
    await this.conversationsService.assertOwned(userId, conversationId);
    return this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    userId: string,
    conversationId: string,
    dto: CreateMessageDto,
  ): Promise<Message> {
    await this.conversationsService.assertOwned(userId, conversationId);
    const message = this.messagesRepository.create({
      conversationId,
      role: dto.role,
      content: dto.content,
    });
    return this.messagesRepository.save(message);
  }

  // Used by the conversation engine, which computes tokenCount/metadata
  // itself (via the AI provider's tokenizer and generation usage) rather
  // than accepting them from a client - ownership is the caller's
  // responsibility, since the engine has always already resolved the owned
  // Conversation before calling this.
  async createInternal(
    conversationId: string,
    role: MessageRole,
    content: string,
    options?: { tokenCount?: number; metadata?: Record<string, unknown> },
  ): Promise<Message> {
    const message = this.messagesRepository.create({
      conversationId,
      role,
      content,
      tokenCount: options?.tokenCount ?? null,
      metadata: options?.metadata ?? null,
    });
    return this.messagesRepository.save(message);
  }

  async updateTokenCount(messageId: string, tokenCount: number): Promise<void> {
    await this.messagesRepository.update(messageId, { tokenCount });
  }
}
