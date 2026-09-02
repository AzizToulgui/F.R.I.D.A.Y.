import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

@Entity('messages')
export class Message extends BaseEntity {
  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ type: 'enum', enum: MessageRole })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'token_count', type: 'int', nullable: true })
  tokenCount!: number | null;

  // Free-form metadata (e.g. interrupted: true, tool call id, source model) -
  // kept as jsonb rather than new columns since its shape grows with later steps.
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
