import { Column, Entity, Index, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../database/entities/base.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { Memory } from '../../memory/entities/memory.entity';

@Entity('users')
export class User extends BaseEntity {
  // Normalized to lowercase by the service layer before persisting/querying,
  // so uniqueness/lookups stay case-insensitive without a citext extension dependency.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: RefreshToken[];

  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations?: Conversation[];

  @OneToMany(() => Memory, (memory) => memory.user)
  memories?: Memory[];
}
