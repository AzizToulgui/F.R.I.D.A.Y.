import { Module } from '@nestjs/common';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { ToolsModule } from '../tools/tools.module';
import { UsersModule } from '../users/users.module';
import { LiveController } from './live.controller';

@Module({
  imports: [AIProviderModule, ToolsModule, UsersModule],
  controllers: [LiveController],
})
export class LiveModule {}
