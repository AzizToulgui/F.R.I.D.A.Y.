'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { ChatMessage } from '@/types';

// Persisted so refreshing the page (or reopening the tab) resumes the same
// conversation instead of silently starting a new one - see the "why aren't
// conversations being saved" gap: messages were always saved server-side,
// but nothing remembered *which* conversation to come back to.
const ACTIVE_CONVERSATION_KEY = 'jarvis:activeConversationId';
// The backend auto-titles a new conversation in the background (see
// ConversationTitlingProcessor) once it has enough of the first exchange to
// work with - it isn't done by the time send()'s own refreshConversations()
// runs right after the turn, so a second, delayed refresh gives it a
// realistic window to land before the sidebar settles on "New conversation".
const TITLE_REFRESH_DELAY_MS = 2500;

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

// Server-Sent Events over a fetch() body reader (not EventSource, which
// can't send the Authorization header or a POST body) - buffers partial
// frames across chunk boundaries and yields one parsed {event, data} per
// blank-line-terminated block.
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

// Drives real text turns against the Step 7 conversation engine
// (POST /conversations/:id/turns, streamed as SSE) - creates the backing
// conversation lazily on the first message, then keeps sending into it so
// context/summary state accumulates on the backend across the session.
export function useChat(): UseChatResult {
  const { authFetch, authFetchStream } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  // Mirrors `streaming` for the synchronous re-entrancy guard in send() -
  // state itself can't be read synchronously right after being set.
  const streamingRef = useRef(false);
  // Bumped by every switchTo()/reset() - the same pattern LiveClient uses
  // (connectSeq) to drop a stale async result: without this, clicking "New
  // conversation" while the mount-time auto-resume fetch is still in flight
  // lets that fetch's response land afterward and silently repopulate the
  // conversation the user just backed out of.
  const requestSeqRef = useRef(0);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await authFetch<ConversationResponse[]>('/conversations');
      setConversations(list.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })));
    } catch {
      // Best-effort - the sidebar just keeps showing whatever it last had.
    }
  }, [authFetch]);

  const setActive = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setActiveConversationId(id);
    if (id) localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    else localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }, []);

  const switchTo = useCallback(
    async (id: string) => {
      if (streamingRef.current || id === conversationIdRef.current) return;
      const seq = ++requestSeqRef.current;
      setError(null);
      setActive(id);
      try {
        const history = await authFetch<MessageResponse[]>(`/conversations/${id}/messages`);
        if (seq !== requestSeqRef.current) return; // superseded by a newer switchTo/reset
        setMsgs(
          history
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role === 'assistant' ? 'jarvis' : 'user', text: m.content }) as ChatMessage),
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
    requestSeqRef.current++; // invalidates any in-flight switchTo
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
        setConversations(previous); // out of sync with the server - restore and surface the failure
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

  // Resume whatever conversation was active last (if any) and populate the
  // sidebar's list - runs once, on mount.
  useEffect(() => {
    void refreshConversations();
    const savedId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    if (savedId) void switchTo(savedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendDelta = useCallback((delta: string) => {
    setMsgs((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const last = next[next.length - 1];
      next[next.length - 1] = { role: 'jarvis', text: last.text + delta };
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
      setMsgs((prev) => [...prev, { role: 'user', text: trimmed }, { role: 'jarvis', text: '' }]);

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
          body: JSON.stringify({ content: trimmed }),
        });
        if (!response.body) throw new Error('Streaming is not supported in this browser.');

        const reader = response.body.getReader();
        for await (const frame of parseSseStream(reader)) {
          if (frame.event === 'delta') {
            const { text: delta } = JSON.parse(frame.data) as { text: string };
            appendDelta(delta);
          } else if (frame.event === 'error') {
            const { message } = JSON.parse(frame.data) as { message: string };
            setError(message);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        void refreshConversations();
        if (isNewConversation) {
          // The backend's auto-title job (ConversationTitlingProcessor)
          // typically isn't finished yet by the time the refresh above
          // runs - one more, after it's had a realistic chance to land.
          setTimeout(() => void refreshConversations(), TITLE_REFRESH_DELAY_MS);
        }
      }
    },
    [authFetch, authFetchStream, appendDelta, setActive, refreshConversations],
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
