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

  // Null for accounts created via "Continue with Google" that never set a
  // password - see AuthService.validateCredentials for the login-side guard.
  @Exclude()
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  // Both null until the user picks something in Settings > Voice - see
  // voice-options.ts for the fixed roster/preset keys these are validated
  // against, and LiveController for where they get resolved into an actual
  // Live session config.
  @Column({ name: 'voice_name', type: 'varchar', length: 64, nullable: true })
  voiceName!: string | null;

  @Column({ name: 'voice_delivery_style', type: 'varchar', length: 64, nullable: true })
  voiceDeliveryStyle!: string | null;

  // Tool names the user has switched off in Settings/Tools (see ToolsView) -
  // filtered out of ToolRegistryService.getDeclarations before either
  // ConversationEngineService or LiveController offers tools to Gemini, and
  // re-checked in ToolExecutionService.invoke as defense in depth.
  @Column({ name: 'disabled_tools', type: 'text', array: true, default: () => "'{}'" })
  disabledTools!: string[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: RefreshToken[];

  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations?: Conversation[];

  @OneToMany(() => Memory, (memory) => memory.user)
  memories?: Memory[];
}
