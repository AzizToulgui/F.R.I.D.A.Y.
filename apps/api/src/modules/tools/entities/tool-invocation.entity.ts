import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum ToolInvocationStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  // Registered but not executed - e.g. a requiresConfirmation tool called
  // without confirmation, or arguments that failed Zod validation.
  BLOCKED = 'blocked',
}

// The audit trail from ARCHITECTURE.md Section 10: who, what, arguments,
// result, timestamp for every tool invocation attempt - written by
// ToolExecutionService regardless of outcome, never only on success.
@Entity('tool_invocations')
export class ToolInvocation extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Not a FK, same reasoning as Memory.sourceConversationId - the
  // conversation may be deleted later without invalidating this audit row,
  // and a voice-mode invocation may not have one at all.
  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId!: string | null;

  @Column({ name: 'tool_name', type: 'varchar', length: 128 })
  toolName!: string;

  @Column({ type: 'jsonb' })
  arguments!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  result!: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: ToolInvocationStatus })
  status!: ToolInvocationStatus;
}
