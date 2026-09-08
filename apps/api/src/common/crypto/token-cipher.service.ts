import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { EncryptionConfig } from '../../config/encryption.config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

// Encrypts OAuth tokens at rest (GoogleAccount.accessTokenEncrypted /
// refreshTokenEncrypted). Ciphertext format: base64(iv || authTag || data) -
// self-contained so decrypt() needs nothing but the stored string and the key.
@Injectable()
export class TokenCipherService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const key = this.getKey();
    const raw = Buffer.from(ciphertext, 'base64');
    const iv = raw.subarray(0, IV_BYTES);
    const authTag = raw.subarray(IV_BYTES, IV_BYTES + 16);
    const encrypted = raw.subarray(IV_BYTES + 16);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  // Validated on first actual use, not at construction (which NestJS runs
  // eagerly at app bootstrap regardless of whether the provider is ever
  // called) - keeps the app startable before Google OAuth is configured,
  // same "optional until configured" precedent as GEMINI_API_KEY.
  private getKey(): Buffer {
    const config = this.configService.get<EncryptionConfig>('encryption')!;
    if (config.tokenEncryptionKey.length !== 64) {
      throw new InternalServerErrorException(
        'TOKEN_ENCRYPTION_KEY is not configured (expected 64 hex characters / 32 bytes).',
      );
    }
    return Buffer.from(config.tokenEncryptionKey, 'hex');
  }
}
