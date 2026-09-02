'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { ChatMessage } from '@/types';

interface ConversationResponse {
  id: string;
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
  const conversationIdRef = useRef<string | null>(null);
  // Mirrors `streaming` for the synchronous re-entrancy guard in send() -
  // state itself can't be read synchronously right after being set.
  const streamingRef = useRef(false);

  const reset = useCallback(() => {
    conversationIdRef.current = null;
    setMsgs([]);
    setError(null);
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

      try {
        if (!conversationIdRef.current) {
          const conversation = await authFetch<ConversationResponse>('/conversations', {
            method: 'POST',
            body: JSON.stringify({}),
          });
          conversationIdRef.current = conversation.id;
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
      }
    },
    [authFetch, authFetchStream, appendDelta],
  );

  return { msgs, streaming, error, send, reset };
}
