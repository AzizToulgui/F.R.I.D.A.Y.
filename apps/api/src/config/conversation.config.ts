import { registerAs } from '@nestjs/config';

export interface ConversationConfig {
  maxHistoryTokens: number;
  titlingModel: string;
}

// How many tokens of raw message history (excluding the system instruction
// and any rolling summary) are sent to Gemini per turn before older turns
// get folded into Conversation.summary instead - keeps context prioritized
// toward what's recent and cost bounded on long conversations (Section 18),
// rather than blindly resending the entire conversation every turn.
export const conversationConfig = registerAs(
  'conversation',
  (): ConversationConfig => ({
    maxHistoryTokens: Number(process.env.CONVERSATION_MAX_HISTORY_TOKENS) || 4000,
    // Auto-titling (ConversationTitlingProcessor) is a background,
    // high-frequency, low-complexity task - same reasoning as
    // MemoryConfig.extractionModel, kept as its own setting since it's a
    // conceptually separate job that happens to want the same cheap tier.
    // gemini-2.5-flash-lite is no longer available to new API keys - see
    // the identical note in memory.config.ts.
    titlingModel: process.env.CONVERSATION_TITLING_MODEL ?? 'gemini-3.5-flash-lite',
  }),
);
