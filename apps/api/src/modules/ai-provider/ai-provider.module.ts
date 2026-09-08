import { Module } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface';
import { GeminiProvider } from './gemini/gemini.provider';
import { VoiceSamplesService } from './voice-samples.service';

@Module({
  providers: [{ provide: AIProvider, useClass: GeminiProvider }, VoiceSamplesService],
  exports: [AIProvider, VoiceSamplesService],
})
export class AIProviderModule {}
