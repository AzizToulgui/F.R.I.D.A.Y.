import { Module } from '@nestjs/common';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { ToolsModule } from '../tools/tools.module';
import { LiveController } from './live.controller';

@Module({
  imports: [AIProviderModule, ToolsModule],
  controllers: [LiveController],
})
export class LiveModule {}
