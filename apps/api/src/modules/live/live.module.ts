import { Module } from '@nestjs/common';
import { AIProviderModule } from '../ai-provider/ai-provider.module';
import { LiveController } from './live.controller';

@Module({
  imports: [AIProviderModule],
  controllers: [LiveController],
})
export class LiveModule {}
