import { registerAs } from '@nestjs/config';

export interface GeminiConfig {
  apiKey: string;
  textModel: string;
  liveModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

// Model IDs are configuration, never literals in provider code (see ARCHITECTURE.md
// Section 5) so a model deprecation is an env change, not a deploy.
export const geminiConfig = registerAs(
  'gemini',
  (): GeminiConfig => ({
    apiKey: process.env.GEMINI_API_KEY ?? '',
    // gemini-2.5-flash is no longer available to new API keys - Gemini's API
    // itself points new callers at gemini-3.6-flash instead (see the
    // identical deprecation note in memory.config.ts / conversation.config.ts).
    textModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.6-flash',
    liveModel: process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-latest',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
    // Gemini's embedding model supports Matryoshka truncation down to smaller
    // sizes via outputDimensionality - fixed here (not left at the model's
    // native size) because the pgvector column width is fixed at migration
    // time and every stored embedding must match it exactly.
    embeddingDimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || 768,
  }),
);
