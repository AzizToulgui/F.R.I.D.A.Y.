import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleModule } from '../google/google.module';
import { Message } from '../messages/entities/message.entity';
import { NotesModule } from '../notes/notes.module';
import { RemindersModule } from '../reminders/reminders.module';
import { UsersModule } from '../users/users.module';
import { VoiceMemosModule } from '../voice-memos/voice-memos.module';
import { WeatherModule } from '../weather/weather.module';
import { ToolInvocation } from './entities/tool-invocation.entity';
import { ToolExecutionService } from './tool-execution.service';
import { ToolRegistryService } from './tool-registry.service';
import { TOOL_DEFINITIONS } from './tool.interface';
import { ToolsController } from './tools.controller';
import { CreateCalendarEventTool } from './tools/create-calendar-event.tool';
import { CreateNoteTool } from './tools/create-note.tool';
import { CreateReminderTool } from './tools/create-reminder.tool';
import { DeleteNoteTool } from './tools/delete-note.tool';
import { DeleteReminderTool } from './tools/delete-reminder.tool';
import { GetCurrentTimeTool } from './tools/get-current-time.tool';
import { ListCalendarEventsTool } from './tools/list-calendar-events.tool';
import { ListNotesTool } from './tools/list-notes.tool';
import { ListRemindersTool } from './tools/list-reminders.tool';
import { ListUnreadEmailsTool } from './tools/list-unread-emails.tool';
import { ListVoiceMemosTool } from './tools/list-voice-memos.tool';
import { PlayVoiceMemoTool } from './tools/play-voice-memo.tool';
import { RecordVoiceMemoTool } from './tools/record-voice-memo.tool';
import { SearchApplicationDataTool } from './tools/search-application-data.tool';
import { StopRecordingVoiceMemoTool } from './tools/stop-recording-voice-memo.tool';
import { UpdateCalendarEventTool } from './tools/update-calendar-event.tool';
import { UpdateNoteTool } from './tools/update-note.tool';
import { UpdateReminderTool } from './tools/update-reminder.tool';
import { GetWeatherTool } from './tools/get-weather.tool';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToolInvocation, Message]),
    RemindersModule,
    NotesModule,
    GoogleModule,
    VoiceMemosModule,
    UsersModule,
    WeatherModule,
  ],
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
    ListUnreadEmailsTool,
    ListCalendarEventsTool,
    CreateCalendarEventTool,
    UpdateCalendarEventTool,
    ListVoiceMemosTool,
    RecordVoiceMemoTool,
    StopRecordingVoiceMemoTool,
    PlayVoiceMemoTool,
    GetWeatherTool,
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
        listUnreadEmails: ListUnreadEmailsTool,
        listCalendarEvents: ListCalendarEventsTool,
        createCalendarEvent: CreateCalendarEventTool,
        updateCalendarEvent: UpdateCalendarEventTool,
        listVoiceMemos: ListVoiceMemosTool,
        recordVoiceMemo: RecordVoiceMemoTool,
        stopRecordingVoiceMemo: StopRecordingVoiceMemoTool,
        playVoiceMemo: PlayVoiceMemoTool,
        getWeather: GetWeatherTool,
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
        listUnreadEmails,
        listCalendarEvents,
        createCalendarEvent,
        updateCalendarEvent,
        listVoiceMemos,
        recordVoiceMemo,
        stopRecordingVoiceMemo,
        playVoiceMemo,
        getWeather,
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
        ListUnreadEmailsTool,
        ListCalendarEventsTool,
        CreateCalendarEventTool,
        UpdateCalendarEventTool,
        ListVoiceMemosTool,
        RecordVoiceMemoTool,
        StopRecordingVoiceMemoTool,
        PlayVoiceMemoTool,
        GetWeatherTool,
      ],
    },
  ],
  exports: [ToolRegistryService, ToolExecutionService],
})
export class ToolsModule {}
