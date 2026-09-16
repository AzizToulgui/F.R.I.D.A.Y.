import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { ChatMessage } from '../../types';

// Ported from apps/web/src/lib/chat/useChat.ts - see that file's comments for the reasoning
// behind the title-poll timing and the request-sequence guards, unchanged here.
const DEFAULT_CONVERSATION_TITLE = 'New conversation';
const TITLE_POLL_INTERVAL_MS = 4000;
const TITLE_POLL_TIMEOUT_MS = 150000;

interface ConversationResponse {
  id: string;
  title: string;
  updatedAt: string;
}

interface MessageResponse {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface SseFrame {
  event: string;
  data: string;
}

// Server-Sent Events over expo/fetch's streaming body reader (plain RN `fetch` has no
// working response.body - see AuthProvider) - buffers partial frames across chunk
// boundaries and yields one parsed {event, data} per blank-line-terminated block.
async function* parseSseStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<SseFrame> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) yield { event, data };
      boundary = buffer.indexOf('\n\n');
    }
  }
}

export interface UseChatResult {
  msgs: ChatMessage[];
  streaming: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  /** Starts a fresh conversation - the next send() creates a new one on the backend. */
  reset: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  /** Loads an existing conversation's real history and makes it the active one. */
  switchTo: (conversationId: string) => Promise<void>;
  removeConversation: (conversationId: string) => Promise<void>;
  /** Manually renames a conversation - also stops the backend from ever auto-titling it. */
  renameConversation: (conversationId: string, title: string) => Promise<void>;
}

export function useChat(): UseChatResult {
  const { authFetch, authFetchStream } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const requestSeqRef = useRef(0);

  const fetchConversationsList = useCallback(async () => {
    const list = await authFetch<ConversationResponse[]>('/conversations');
    return list.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }));
  }, [authFetch]);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await fetchConversationsList());
    } catch {
      // Best-effort - the drawer just keeps showing whatever it last had.
    }
  }, [fetchConversationsList]);

  const pollForTitle = useCallback(
    (conversationId: string) => {
      const deadline = Date.now() + TITLE_POLL_TIMEOUT_MS;
      const tick = async () => {
        let list: ConversationSummary[];
        try {
          list = await fetchConversationsList();
        } catch {
          return;
        }
        setConversations(list);
        const current = list.find((c) => c.id === conversationId);
        const stillDefault = !current || current.title === DEFAULT_CONVERSATION_TITLE;
        if (stillDefault && Date.now() < deadline) {
          setTimeout(() => void tick(), TITLE_POLL_INTERVAL_MS);
        }
      };
      setTimeout(() => void tick(), TITLE_POLL_INTERVAL_MS);
    },
    [fetchConversationsList],
  );

  const setActive = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setActiveConversationId(id);
  }, []);

  const switchTo = useCallback(
    async (id: string) => {
      if (streamingRef.current || id === conversationIdRef.current) return;
      const seq = ++requestSeqRef.current;
      setError(null);
      setActive(id);
      try {
        const history = await authFetch<MessageResponse[]>(`/conversations/${id}/messages`);
        if (seq !== requestSeqRef.current) return;
        setMsgs(
          history
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role === 'assistant' ? 'friday' : 'user', text: m.content }) as ChatMessage),
        );
      } catch (e) {
        if (seq !== requestSeqRef.current) return;
        setError(e instanceof Error ? e.message : 'Could not load that conversation.');
        setMsgs([]);
      }
    },
    [authFetch, setActive],
  );

  const reset = useCallback(() => {
    requestSeqRef.current++;
    setActive(null);
    setMsgs([]);
    setError(null);
  }, [setActive]);

  const removeConversation = useCallback(
    async (id: string) => {
      const wasActive = conversationIdRef.current === id;
      const previous = conversations;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      try {
        await authFetch(`/conversations/${id}`, { method: 'DELETE' });
      } catch (e) {
        setConversations(previous);
        setError(e instanceof Error ? e.message : 'Could not delete that conversation.');
        return;
      }
      if (wasActive) reset();
    },
    [authFetch, conversations, reset],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const previous = conversations;
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
      try {
        await authFetch(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title: trimmed }) });
      } catch (e) {
        setConversations(previous);
        setError(e instanceof Error ? e.message : 'Could not rename that conversation.');
      }
    },
    [authFetch, conversations],
  );

  useEffect(() => {
    void refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendDelta = useCallback((delta: string) => {
    setMsgs((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const last = next[next.length - 1];
      next[next.length - 1] = { role: 'friday', text: last.text + delta };
      return next;
    });
  }, []);

  const setLastMessageError = useCallback((message: string) => {
    setMsgs((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const last = next[next.length - 1];
      if (last.role === 'friday') next[next.length - 1] = { ...last, errorMessage: message };
      return next;
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streamingRef.current) return;
      streamingRef.current = true;
      setError(null);
      setStreaming(true);
      setMsgs((prev) => [...prev, { role: 'user', text: trimmed }, { role: 'friday', text: '' }]);

      const isNewConversation = !conversationIdRef.current;
      try {
        if (isNewConversation) {
          const conversation = await authFetch<ConversationResponse>('/conversations', {
            method: 'POST',
            body: JSON.stringify({}),
          });
          setActive(conversation.id);
        }

        const response = await authFetchStream(`/conversations/${conversationIdRef.current}/turns`, {
          method: 'POST',
          // Lets the model resolve times the user gives without a timezone (e.g. "remind
          // me at 11:30") against the user's actual local time instead of drifting toward
          // UTC - mirrors web's Intl.DateTimeFormat().resolvedOptions().timeZone.
          body: JSON.stringify({ content: trimmed, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        });
        if (!response.body) throw new Error('Streaming is not supported on this device.');

        const reader = response.body.getReader();
        for await (const frame of parseSseStream(reader)) {
          if (frame.event === 'delta') {
            const { text: delta } = JSON.parse(frame.data) as { text: string };
            appendDelta(delta);
          } else if (frame.event === 'error') {
            const { message } = JSON.parse(frame.data) as { message: string };
            setLastMessageError(message);
          }
        }
      } catch (e) {
        setLastMessageError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        void refreshConversations();
        if (isNewConversation && conversationIdRef.current) {
          pollForTitle(conversationIdRef.current);
        }
      }
    },
    [authFetch, authFetchStream, appendDelta, setLastMessageError, setActive, refreshConversations, pollForTitle],
  );

  return {
    msgs,
    streaming,
    error,
    send,
    reset,
    conversations,
    activeConversationId,
    switchTo,
    removeConversation,
    renameConversation,
  };
}
