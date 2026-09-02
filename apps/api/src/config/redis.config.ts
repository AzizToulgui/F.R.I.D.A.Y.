import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
}

export const redisConfig = registerAs(
  'redis',
  (): RedisConfig => ({
    url: process.env.REDIS_URL as string,
  }),
);
