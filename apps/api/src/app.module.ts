import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import {
  appConfig,
  conversationConfig,
  databaseConfig,
  geminiConfig,
  jwtConfig,
  redisConfig,
  throttleConfig,
  validationSchema,
} from './config';
import { AppConfig } from './config/app.config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, throttleConfig, geminiConfig, conversationConfig],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.get<AppConfig>('app')!;
        const isProduction = app.environment === 'production';
        return {
          pinoHttp: {
            level: app.logLevel,
            genReqId: (req: { id?: string; headers: Record<string, unknown> }) =>
              (req.headers['x-correlation-id'] as string) ?? randomUUID(),
            // Never let request/response bodies or auth material hit the logs -
            // conversation/message content especially must not leak into log aggregation.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                'req.body',
                'res.body',
              ],
              censor: '[redacted]',
            },
            transport: isProduction ? undefined : { target: 'pino-pretty' },
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const throttle = config.get<ThrottleConfig>('throttle')!;
        return [{ ttl: throttle.ttlMs, limit: throttle.limit }];
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
