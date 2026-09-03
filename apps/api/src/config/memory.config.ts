import { registerAs } from '@nestjs/config';

export interface MemoryConfig {
  retrievalTopK: number;
  dedupSimilarityThreshold: number;
  extractionModel: string;
}

// Retrieval/dedup knobs for the long-term memory system (ARCHITECTURE.md
// Section 9) - kept env-configurable rather than hardcoded per the
// cost-control discipline in Section 18.
export const memoryConfig = registerAs(
  'memory',
  (): MemoryConfig => ({
    retrievalTopK: Number(process.env.MEMORY_RETRIEVAL_TOP_K) || 5,
    dedupSimilarityThreshold: Number(process.env.MEMORY_DEDUP_SIMILARITY_THRESHOLD) || 0.92,
    // Extraction is a background, high-frequency, low-complexity task - the
    // cheapest available Flash/Lite-tier model, deliberately separate from
    // GEMINI_TEXT_MODEL (the conversational model) so it can be downgraded
    // independently for cost. gemini-2.5-flash-lite was the original
    // default but is no longer available to new API keys (Gemini's API
    // itself points new callers at gemini-3.5-flash-lite instead).
    extractionModel: process.env.MEMORY_EXTRACTION_MODEL ?? 'gemini-3.5-flash-lite',
  }),
);
