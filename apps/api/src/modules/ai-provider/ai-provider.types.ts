export type ChatRole = 'user' | 'model' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateTextParams {
  messages: ChatMessage[];
  systemInstruction?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateTextResult {
  content: string;
  usage: TokenUsage;
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
