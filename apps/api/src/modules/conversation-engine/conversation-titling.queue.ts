export const CONVERSATION_TITLING_QUEUE = 'conversation-titling';

export interface ConversationTitlingJob {
  conversationId: string;
  userId: string;
}
