import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../config/redis.config';
import { REDIS_CLIENT } from './redis.constants';

// Global: used today only for rate-limit/health-check plumbing, but every
// future consumer (BullMQ job queues in Step 9, session-token throttling in
// Step 4) shares this single connection rather than opening their own.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.get<RedisConfig>('redis')!;
        return new Redis(redis.url);
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redisClient.quit();
  }
}
