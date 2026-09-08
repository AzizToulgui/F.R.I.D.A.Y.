import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../messages/entities/message.entity';
import { NotesModule } from '../notes/notes.module';
import { RemindersModule } from '../reminders/reminders.module';
import { ToolInvocation } from './entities/tool-invocation.entity';
import { ToolExecutionService } from './tool-execution.service';
import { ToolRegistryService } from './tool-registry.service';
import { TOOL_DEFINITIONS } from './tool.interface';
import { ToolsController } from './tools.controller';
import { CreateNoteTool } from './tools/create-note.tool';
import { CreateReminderTool } from './tools/create-reminder.tool';
import { DeleteNoteTool } from './tools/delete-note.tool';
import { DeleteReminderTool } from './tools/delete-reminder.tool';
import { GetCurrentTimeTool } from './tools/get-current-time.tool';
import { ListNotesTool } from './tools/list-notes.tool';
import { ListRemindersTool } from './tools/list-reminders.tool';
import { SearchApplicationDataTool } from './tools/search-application-data.tool';
import { UpdateNoteTool } from './tools/update-note.tool';
import { UpdateReminderTool } from './tools/update-reminder.tool';

@Module({
  imports: [TypeOrmModule.forFeature([ToolInvocation, Message]), RemindersModule, NotesModule],
  controllers: [ToolsController],
  providers: [
    ToolRegistryService,
    ToolExecutionService,
    GetCurrentTimeTool,
    SearchApplicationDataTool,
    CreateReminderTool,
    ListRemindersTool,
    UpdateReminderTool,
    DeleteReminderTool,
    CreateNoteTool,
    ListNotesTool,
    UpdateNoteTool,
    DeleteNoteTool,
    // The registered tool set (ARCHITECTURE.md Section 10) - add a new tool
    // by providing it above and listing it here, nothing else needs to change.
    {
      provide: TOOL_DEFINITIONS,
      useFactory: (
        getCurrentTime: GetCurrentTimeTool,
        searchApplicationData: SearchApplicationDataTool,
        createReminder: CreateReminderTool,
        listReminders: ListRemindersTool,
        updateReminder: UpdateReminderTool,
        deleteReminder: DeleteReminderTool,
        createNote: CreateNoteTool,
        listNotes: ListNotesTool,
        updateNote: UpdateNoteTool,
        deleteNote: DeleteNoteTool,
      ) => [
        getCurrentTime,
        searchApplicationData,
        createReminder,
        listReminders,
        updateReminder,
        deleteReminder,
        createNote,
        listNotes,
        updateNote,
        deleteNote,
      ],
      inject: [
        GetCurrentTimeTool,
        SearchApplicationDataTool,
        CreateReminderTool,
        ListRemindersTool,
        UpdateReminderTool,
        DeleteReminderTool,
        CreateNoteTool,
        ListNotesTool,
        UpdateNoteTool,
        DeleteNoteTool,
      ],
    },
  ],
  exports: [ToolRegistryService, ToolExecutionService],
})
export class ToolsModule {}
