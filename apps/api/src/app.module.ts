import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import {
  appConfig,
  conversationConfig,
  databaseConfig,
  encryptionConfig,
  geminiConfig,
  googleConfig,
  jwtConfig,
  memoryConfig,
  ragConfig,
  redisConfig,
  throttleConfig,
  validationSchema,
} from './config';
import { RedisConfig } from './config/redis.config';
import { ThrottleConfig } from './config/throttle.config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { AIProviderModule } from './modules/ai-provider/ai-provider.module';
import { HealthModule } from './modules/health/health.module';
import { LiveModule } from './modules/live/live.module';
import { ConversationEngineModule } from './modules/conversation-engine/conversation-engine.module';
import { MemoryModule } from './modules/memory/memory.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotesModule } from './modules/notes/notes.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { ToolsModule } from './modules/tools/tools.module';
import { GoogleModule } from './modules/google/google.module';
import { VoiceMemosModule } from './modules/voice-memos/voice-memos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        throttleConfig,
        geminiConfig,
        conversationConfig,
        memoryConfig,
        ragConfig,
        googleConfig,
        encryptionConfig,
      ],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const throttle = config.get<ThrottleConfig>('throttle')!;
        return [{ ttl: throttle.ttlMs, limit: throttle.limit }];
      },
    }),

    // A dedicated ioredis connection, not the shared REDIS_CLIENT from
    // RedisModule - BullMQ requires maxRetriesPerRequest: null on whatever
    // connection it's given, which isn't a setting rate-limit/health-check
    // usage of REDIS_CLIENT should also have to carry.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.get<RedisConfig>('redis')!;
        return { connection: new Redis(redis.url, { maxRetriesPerRequest: null }) };
      },
    }),

    DatabaseModule,
    RedisModule,
    AIProviderModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ConversationsModule,
    MessagesModule,
    LiveModule,
    ConversationEngineModule,
    MemoryModule,
    RemindersModule,
    NotesModule,
    ToolsModule,
    DocumentsModule,
    GoogleModule,
    VoiceMemosModule,
  ],
  providers: [
    // Order matters: rate limiting rejects abusive traffic before it ever
    // reaches auth, and auth then guards everything unless @Public().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
