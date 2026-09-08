import { registerAs } from '@nestjs/config';

export interface EncryptionConfig {
  /** Hex-encoded 32-byte (64 hex char) key for AES-256-GCM token-at-rest encryption. */
  tokenEncryptionKey: string;
}

export const encryptionConfig = registerAs(
  'encryption',
  (): EncryptionConfig => ({
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',
  }),
);
