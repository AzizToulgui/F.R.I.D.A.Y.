import { registerAs } from '@nestjs/config';

export interface ConversationConfig {
  maxHistoryTokens: number;
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
  }),
);
