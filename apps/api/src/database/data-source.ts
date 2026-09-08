import 'dotenv/config';
import { DataSource } from 'typeorm';
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

// Used only by the TypeORM CLI (migration:generate/run/revert). The running
// application gets its connection through TypeOrmModule.forRootAsync in
// database.module.ts instead, which goes through the validated ConfigService.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
