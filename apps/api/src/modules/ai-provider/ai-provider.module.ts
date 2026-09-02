import { Module } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface';
import { GeminiProvider } from './gemini/gemini.provider';

@Module({
  providers: [{ provide: AIProvider, useClass: GeminiProvider }],
  exports: [AIProvider],
})
export class AIProviderModule {}
