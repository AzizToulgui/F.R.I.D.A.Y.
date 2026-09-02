import {
  CountTokensParams,
  EmbeddingResult,
  GenerateTextParams,
  GenerateTextResult,
  LiveSessionToken,
} from './ai-provider.types';

// Abstract class (not a TS `interface`) so it survives to runtime and can be
// injected without a separate string/symbol token (see di-use-interfaces-tokens).
// Nothing outside this module may depend on GeminiProvider directly - every
// consumer (conversations, memory, tools, RAG) depends on this seam instead,
// so a second provider can be added later without touching them.
export abstract class AIProvider {
  abstract generateText(params: GenerateTextParams): Promise<GenerateTextResult>;

  // Same contract as generateText, but yields text deltas as they arrive and
  // returns the final GenerateTextResult (with usage) once the stream ends -
  // callers can `yield*` this directly to forward both without buffering.
  abstract generateTextStream(
    params: GenerateTextParams,
  ): AsyncGenerator<string, GenerateTextResult, void>;

  // Exact token count for a set of messages, via the provider's own
  // tokenizer - used to budget conversation context instead of guessing
  // from character counts (see ConversationEngineService).
  abstract countTokens(params: CountTokensParams): Promise<number>;

  abstract generateEmbedding(text: string): Promise<EmbeddingResult>;

  // Mints a short-lived credential the browser can use to open a Gemini Live
  // WebSocket directly (see ARCHITECTURE.md Section 3) - the permanent API
  // key never leaves this method's implementation.
  abstract mintLiveSessionToken(): Promise<LiveSessionToken>;
}
