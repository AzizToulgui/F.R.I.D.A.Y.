import { registerAs } from '@nestjs/config';

export interface GeminiConfig {
  apiKey: string;
  textModel: string;
  liveModel: string;
  embeddingModel: string;
}

// Model IDs are configuration, never literals in provider code (see ARCHITECTURE.md
// Section 5) so a model deprecation is an env change, not a deploy.
export const geminiConfig = registerAs(
  'gemini',
  (): GeminiConfig => ({
    apiKey: process.env.GEMINI_API_KEY ?? '',
    textModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.5-flash',
    liveModel: process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-latest',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
  }),
);
