import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
  ) {}

  async create(userId: string, dto: CreateConversationDto): Promise<Conversation> {
    const conversation = this.conversationsRepository.create({
      userId,
      title: dto.title ?? 'New conversation',
    });
    return this.conversationsRepository.save(conversation);
  }

  async findAllForUser(userId: string): Promise<Conversation[]> {
    return this.conversationsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  // Throws NotFound rather than Forbidden when the conversation belongs to
  // someone else, so an authenticated user can't distinguish "doesn't exist"
  // from "exists but isn't yours" by probing ids.
  async findOneOwned(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.userId !== userId) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async update(
    userId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ): Promise<Conversation> {
    const conversation = await this.findOneOwned(userId, conversationId);
    if (dto.title !== undefined) {
      conversation.title = dto.title;
    }
    if (dto.archived !== undefined) {
      conversation.archivedAt = dto.archived ? new Date() : null;
    }
    if (dto.customInstructions !== undefined) {
      conversation.customInstructions = dto.customInstructions.trim() || null;
    }
    return this.conversationsRepository.save(conversation);
  }

  async remove(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.findOneOwned(userId, conversationId);
    await this.conversationsRepository.remove(conversation);
  }

  async assertOwned(userId: string, conversationId: string): Promise<void> {
    await this.findOneOwned(userId, conversationId);
  }

  // Persists engine-computed state (rolling summary, summary pointer) -
  // distinct from `update`, which only applies user-supplied DTO fields.
  async saveInternal(conversation: Conversation): Promise<Conversation> {
    return this.conversationsRepository.save(conversation);
  }
}
