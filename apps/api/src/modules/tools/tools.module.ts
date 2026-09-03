import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../messages/entities/message.entity';
import { RemindersModule } from '../reminders/reminders.module';
import { ToolInvocation } from './entities/tool-invocation.entity';
import { ToolExecutionService } from './tool-execution.service';
import { ToolRegistryService } from './tool-registry.service';
import { TOOL_DEFINITIONS } from './tool.interface';
import { ToolsController } from './tools.controller';
import { CreateReminderTool } from './tools/create-reminder.tool';
import { GetCurrentTimeTool } from './tools/get-current-time.tool';
import { SearchApplicationDataTool } from './tools/search-application-data.tool';

@Module({
  imports: [TypeOrmModule.forFeature([ToolInvocation, Message]), RemindersModule],
  controllers: [ToolsController],
  providers: [
    ToolRegistryService,
    ToolExecutionService,
    GetCurrentTimeTool,
    SearchApplicationDataTool,
    CreateReminderTool,
    // The starting tool set (ARCHITECTURE.md Section 10) - add a new tool by
    // providing it above and listing it here, nothing else needs to change.
    {
      provide: TOOL_DEFINITIONS,
      useFactory: (
        getCurrentTime: GetCurrentTimeTool,
        searchApplicationData: SearchApplicationDataTool,
        createReminder: CreateReminderTool,
      ) => [getCurrentTime, searchApplicationData, createReminder],
      inject: [GetCurrentTimeTool, SearchApplicationDataTool, CreateReminderTool],
    },
  ],
  exports: [ToolRegistryService, ToolExecutionService],
})
export class ToolsModule {}
