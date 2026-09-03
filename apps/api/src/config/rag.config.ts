import { registerAs } from '@nestjs/config';

export interface RagConfig {
  chunkTargetTokens: number;
  chunkOverlapRatio: number;
  retrievalTopK: number;
  maxUploadBytes: number;
}

// Knowledge base (Step 11) chunking/retrieval knobs - env-configurable per
// the cost-control discipline in ARCHITECTURE.md Section 18.
export const ragConfig = registerAs(
  'rag',
  (): RagConfig => ({
    // ~500-800 tokens per Section 11 - 650 sits in the middle of that range.
    chunkTargetTokens: Number(process.env.RAG_CHUNK_TARGET_TOKENS) || 650,
    chunkOverlapRatio: Number(process.env.RAG_CHUNK_OVERLAP_RATIO) || 0.12,
    retrievalTopK: Number(process.env.RAG_RETRIEVAL_TOP_K) || 5,
    maxUploadBytes: Number(process.env.RAG_MAX_UPLOAD_BYTES) || 20 * 1024 * 1024,
  }),
);
