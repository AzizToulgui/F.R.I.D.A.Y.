import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Message } from '../../messages/entities/message.entity';

// The sentinel a conversation's title starts as - doubles as the trigger
// condition for auto-titling (ConversationTitlingProcessor only ever
// generates/overwrites a title while it's still exactly this), so a user's
// manual rename is never clobbered and a conversation is never re-titled twice.
export const DEFAULT_CONVERSATION_TITLE = 'New conversation';

@Entity('conversations')
export class Conversation extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 200, default: DEFAULT_CONVERSATION_TITLE })
  title!: string;

  // Rolling summary of older turns, extended in place by ConversationEngineService
  // whenever the raw history exceeds the context token budget.
  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  // The newest message already folded into `summary` - messages after this
  // one are still sent to Gemini verbatim; everything at or before it is
  // represented only by the summary text, so it's never re-summarized or
  // re-sent on a later turn. Not a FK (the referenced message is never
  // deleted out from under it in practice, and this is a read-time pointer,
  // not a relation the app ever joins through).
  @Column({ name: 'summary_up_to_message_id', type: 'uuid', nullable: true })
  summaryUpToMessageId!: string | null;

  // Same pointer pattern as summaryUpToMessageId, but for the memory
  // extraction background job (MemoryExtractionProcessor) - advanced only on
  // a successful extraction pass, so a failed job's messages are retried
  // (and not resent alongside an ever-growing history) on the next turn.
  @Column({ name: 'memory_extracted_up_to_message_id', type: 'uuid', nullable: true })
  memoryExtractedUpToMessageId!: string | null;

  // User-supplied instructions scoped to this conversation (e.g. "reply in
  // French", "keep answers under two sentences") - folded into the system
  // instruction alongside the fixed JARVIS persona on every turn.
  @Column({ name: 'custom_instructions', type: 'text', nullable: true })
  customInstructions!: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @OneToMany(() => Message, (message) => message.conversation)
  messages?: Message[];
}
