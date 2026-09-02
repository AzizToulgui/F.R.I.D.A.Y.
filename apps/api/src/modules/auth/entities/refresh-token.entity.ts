import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

// Stores only a hash of the refresh token (argon2), never the token itself -
// possession of a DB row is not enough to authenticate; the raw token issued
// to the client is the only thing that can pass the hash check.
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Refresh tokens are issued as `${selector}.${validator}`. The selector is a
  // public, indexed lookup key (avoids scanning + argon2-verifying every row);
  // only the validator's hash is stored, so a leaked DB row alone can't authenticate.
  @Index({ unique: true })
  @Column({ name: 'selector', type: 'varchar', length: 32 })
  selector!: string;

  @Exclude()
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'replaced_by_token_id', type: 'uuid', nullable: true })
  replacedByTokenId!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;
}
