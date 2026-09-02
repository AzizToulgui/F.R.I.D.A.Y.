import { registerAs } from '@nestjs/config';

export interface ThrottleConfig {
  ttlMs: number;
  limit: number;
}

export const throttleConfig = registerAs(
  'throttle',
  (): ThrottleConfig => ({
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  }),
);
