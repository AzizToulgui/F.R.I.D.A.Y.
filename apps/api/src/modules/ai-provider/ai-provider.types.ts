export type ChatRole = 'user' | 'model' | 'system';

// A function call the model requested (echoed back as part of the model's
// turn on the next round) - `id` (when the provider gives one) ties a later
// FunctionCallResponse back to this specific call.
export interface FunctionCallRequest {
  name: string;
  args: Record<string, unknown>;
  id?: string;
  // Gemini-specific: an opaque token tied to the model's reasoning for this
  // call. Thinking-enabled models (see GeminiProvider.thinkingConfigFor)
  // reject a replayed functionCall part that doesn't carry back the same
  // signature it was originally issued with (400 INVALID_ARGUMENT) - so this
  // has to survive the round-trip from provider response to the next
  // request's history, not just get dropped as provider-specific noise.
  thoughtSignature?: string;
}

// The result of executing a FunctionCallRequest, sent back to the model as
// its own turn - see ToolExecutionService.
export interface FunctionCallResponse {
  name: string;
  response: Record<string, unknown>;
  id?: string;
}

// Provider-agnostic shape for advertising a callable tool - deliberately not
// the @google/genai `FunctionDeclaration` type, so nothing outside
// ai-provider/gemini needs to import that SDK (see Section 5).
export interface ToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // Present on a 'model' turn that requested one or more tool calls.
  functionCalls?: FunctionCallRequest[];
  // Present on the turn that answers a prior functionCalls turn.
  functionResponses?: FunctionCallResponse[];
}

export interface GenerateTextParams {
  messages: ChatMessage[];
  systemInstruction?: string;
  // Overrides the provider's default text model for this call - used by
  // background/low-complexity tasks (e.g. memory extraction) that should run
  // on a cheaper model than live conversation turns (see MemoryConfig.extractionModel).
  model?: string;
  // Tools the model may call this turn (see ToolRegistryService) - omitted
  // entirely (not just empty) when the caller has no tools to offer.
  tools?: ToolDeclaration[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateTextResult {
  content: string;
  usage: TokenUsage;
  // Populated instead of (or alongside) `content` when the model wants to
  // call one or more tools before it can finish this turn.
  functionCalls?: FunctionCallRequest[];
}

export interface CountTokensParams {
  messages: ChatMessage[];
}

export interface EmbeddingResult {
  vector: number[];
}

// The user's saved voice preferences (see users.entity.ts), already resolved
// to what the provider needs - LiveController passes the raw voiceName
// through and looks up deliveryStyleInstruction via
// voice-options.deliveryStyleInstructionFor before calling mintLiveSessionToken,
// so GeminiProvider doesn't need to know about the preset key scheme at all.
export interface LiveVoiceOptions {
  voiceName?: string;
  deliveryStyleInstruction?: string;
}

// A single synthesized audio clip (see AIProvider.synthesizeSpeech) - raw
// PCM, not yet wrapped in a container format. `sampleRateHz` is parsed from
// whatever the provider's response actually reports rather than assumed, so
// a future model returning a different rate doesn't silently mis-decode.
export interface SpeechSample {
  audioBase64: string;
  sampleRateHz: number;
}

export interface LiveSessionToken {
  token: string;
  expiresAt: Date;
  newSessionExpiresAt: Date;
  model: string;
}
