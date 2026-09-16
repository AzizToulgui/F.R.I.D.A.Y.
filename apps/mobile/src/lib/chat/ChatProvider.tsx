import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useChat } from './useChat';
import type { UseChatResult } from './useChat';

// One useChat() instance shared by Home, Chat, and the drawer's conversation history list
// (Section 6) - all three need the same live state (active conversation, streaming flag,
// conversations list), not independent copies.
const ChatContext = createContext<UseChatResult | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChat();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext(): UseChatResult {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within a ChatProvider');
  return ctx;
}
