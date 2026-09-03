export type ChatRole = 'user' | 'model' | 'system';

// A function call the model requested (echoed back as part of the model's
// turn on the next round) - `id` (when the provider gives one) ties a later
// FunctionCallResponse back to this specific call.
export interface FunctionCallRequest {
  name: string;
  args: Record<string, unknown>;
  id?: string;
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

export interface LiveSessionToken {
  token: string;
  expiresAt: Date;
  newSessionExpiresAt: Date;
  model: string;
}
