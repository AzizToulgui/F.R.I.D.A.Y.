import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from '../config/database.config';
import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { Conversation } from '../modules/conversations/entities/conversation.entity';
import { Message } from '../modules/messages/entities/message.entity';
import { Memory } from '../modules/memory/entities/memory.entity';
import { DocumentChunk } from '../modules/documents/entities/document-chunk.entity';
import { Document } from '../modules/documents/entities/document.entity';
import { Note } from '../modules/notes/entities/note.entity';
import { Reminder } from '../modules/reminders/entities/reminder.entity';
import { ToolInvocation } from '../modules/tools/entities/tool-invocation.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get<DatabaseConfig>('database')!;
        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          entities: [
            User,
            RefreshToken,
            Conversation,
            Message,
            Memory,
            Reminder,
            Note,
            ToolInvocation,
            Document,
            DocumentChunk,
          ],
          // Schema changes always go through migrations (see database/migrations),
          // never through sync - even in dev, so local schema drift can't hide bugs
          // that only surface once a real migration runs in production.
          synchronize: db.synchronize,
          logging: db.logging,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
