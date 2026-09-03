import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

// Deliberately does NOT map the `embedding vector(n)` column (see the
// migration) - TypeORM has no native pgvector column type, and every write
// or similarity read of that column goes through raw SQL in
// MemoriesService instead, so `.find()`/`.save()` here never have to know
// about it. This is also why plain repository `find`/`save` calls are safe:
// they simply never touch the vector column.
@Entity('memories')
export class Memory extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.memories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'text' })
  content!: string;

  // The conversation this fact was extracted from, kept for provenance/UI
  // ("from this conversation") - not a FK constraint, since the source
  // conversation may later be deleted while the memory itself stays valid.
  @Column({ name: 'source_conversation_id', type: 'uuid', nullable: true })
  sourceConversationId!: string | null;

  // 0-1 confidence the extraction step assigned this fact - reserved for
  // future use in retrieval ranking/UI surfacing; always 1 for now.
  @Column({ type: 'float', default: 1 })
  confidence!: number;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;
}
