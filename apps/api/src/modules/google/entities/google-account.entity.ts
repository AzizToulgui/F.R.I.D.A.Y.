import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

// One Google account per user (unique user_id) - both "Continue with Google"
// login and Settings' "Connect Google Account" upsert into this same row
// (see GoogleAccountService.upsertFromTokens), so a user who signed in with
// Google already has Gmail/Calendar tool access with nothing further to do.
@Entity('google_accounts')
export class GoogleAccount extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'google_user_id', type: 'varchar', length: 255 })
  googleUserId!: string;

  @Column({ name: 'google_email', type: 'varchar', length: 255 })
  googleEmail!: string;

  // AES-256-GCM ciphertext (iv + authTag + data, base64) - see TokenCipherService.
  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted!: string;

  // Google only returns a refresh token on the first consent grant unless
  // prompt=consent is forced - nullable so a re-consent that omits it doesn't
  // clobber a previously-stored one (see GoogleAccountService.upsertFromTokens).
  @Column({ name: 'refresh_token_encrypted', type: 'text', nullable: true })
  refreshTokenEncrypted!: string | null;

  @Column({ name: 'access_token_expires_at', type: 'timestamptz' })
  accessTokenExpiresAt!: Date;

  // Space-delimited, as returned by Google's token endpoint.
  @Column({ type: 'text' })
  scopes!: string;
}
