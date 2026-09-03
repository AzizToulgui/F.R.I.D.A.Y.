'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AudioCapture } from './AudioCapture';
import { AudioPlayback } from './AudioPlayback';
import { LiveClient } from './LiveClient';
import type { LiveConnectionState, LiveFunctionCall, LiveFunctionResponse, LiveSessionTokenResponse } from './types';

interface InvokeToolResponse {
  output?: unknown;
}

// getUserMedia rejects with a named DOMException - the generic
// "Permission denied" message it carries doesn't tell the user what to do
// about it, so map the cases worth distinguishing to actionable copy.
function describeMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : null;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone access was denied. Allow it for this site in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect one and try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The microphone is already in use by another app or tab.';
  }
  return error instanceof Error ? error.message : 'Microphone access was denied or unavailable.';
}

export interface UseLiveSessionResult {
  state: LiveConnectionState;
  statusMessage: string | null;
  errorMessage: string | null;
  isModelSpeaking: boolean;
  /** True for a brief moment right after the user has barged in on the model. */
  wasInterrupted: boolean;
  transcript: string;
  /** What the user is saying right now - low latency, still-changing, replaced on every update. */
  interimCaption: string;
  /** Approximate ms from recognized end of user speech to first byte of the model's reply. */
  latencyMs: number | null;
  muted: boolean;
  toggleMuted: () => void;
  start: () => Promise<void>;
  stop: () => void;
  /** Current mic input level, 0-1 - polled from an animation loop (e.g. the orb), not reactive state. */
  getMicLevel: () => number;
  /** Current model output level, 0-1 - polled from an animation loop, not reactive state. */
  getOutputLevel: () => number;
}

export function useLiveSession(): UseLiveSessionResult {
  const { authFetch } = useAuth();
  const [state, setState] = useState<LiveConnectionState>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimCaption, setInterimCaption] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  const clientRef = useRef<LiveClient | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);
  const interruptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;
    playbackRef.current = new AudioPlayback();

    // Relays a Gemini tool_call to the authenticated backend and turns the
    // result (or any failure - network, validation, unknown tool) into a
    // FunctionResponse - see ARCHITECTURE.md Section 3's tool calling relay.
    // This hook never decides whether a call is allowed; ToolExecutionService does.
    const executeToolCalls = async (calls: LiveFunctionCall[]): Promise<LiveFunctionResponse[]> => {
      return Promise.all(
        calls.map(async (call): Promise<LiveFunctionResponse> => {
          try {
            const result = await authFetch<InvokeToolResponse>(`/tools/${encodeURIComponent(call.name)}/invoke`, {
              method: 'POST',
              body: JSON.stringify({ arguments: call.args }),
            });
            return { name: call.name, id: call.id, response: { output: result.output } };
          } catch (e) {
            return {
              name: call.name,
              id: call.id,
              response: { error: e instanceof Error ? e.message : 'Tool execution failed.' },
            };
          }
        }),
      );
    };

    const client = new LiveClient({
      getToken: () => authFetch<LiveSessionTokenResponse>('/live/session', { method: 'POST' }),
      executeToolCalls,
      callbacks: {
        onStateChange: (next) => {
          setState(next);
          if (next === 'connecting') {
            setErrorMessage(null);
            setTranscript('');
            setInterimCaption('');
            setLatencyMs(null);
            setWasInterrupted(false);
          }
        },
        onStatus: (message) => setStatusMessage(message),
        onFatalError: (message) => setErrorMessage(message),
        onLatency: (ms) => setLatencyMs(ms),
        onTurn: (event) => {
          if (event.interrupted) {
            // Barge-in: stop the audio immediately and drop the now-stale
            // partial transcript so it can't blend into the next response -
            // both the sound and the text should cut off together.
            playbackRef.current?.clear();
            setIsModelSpeaking(false);
            setTranscript('');
            setInterimCaption('');
            setWasInterrupted(true);
            if (interruptedTimerRef.current) clearTimeout(interruptedTimerRef.current);
            interruptedTimerRef.current = setTimeout(() => setWasInterrupted(false), 1200);
          }
          if (event.isNewTurn) {
            // A fresh model turn starting - clear any leftover text from
            // whatever came before so turns never run together.
            setTranscript('');
            setWasInterrupted(false);
          }
          if (event.audioBase64) {
            playbackRef.current?.enqueue(event.audioBase64);
            setIsModelSpeaking(true);
            setInterimCaption('');
          }
          if (event.interimInputText) {
            setInterimCaption(event.interimInputText);
          }
          if (event.outputText) {
            setTranscript((prev) => prev + event.outputText);
          }
          if (event.turnComplete) {
            setIsModelSpeaking(false);
          }
        },
      },
    });
    clientRef.current = client;
    return client;
  }, [authFetch]);

  const start = useCallback(async () => {
    setErrorMessage(null);
    const client = ensureClient();
    // Resume the playback AudioContext right now, as close to the user's
    // click as possible - not when the first audio chunk actually arrives
    // seconds later, by which point the browser's autoplay window has
    // usually closed and the context would silently stay suspended.
    const playbackReady = playbackRef.current?.init();
    await Promise.all([client.connect(), playbackReady]);
    if (playbackRef.current && !playbackRef.current.isRunning()) {
      setErrorMessage(
        'Your browser is blocking audio playback for this tab. Click anywhere on the page, then try again.',
      );
    }
    try {
      if (!captureRef.current) {
        captureRef.current = new AudioCapture();
        // Route through the ref, not the `client` local: under React Strict
        // Mode's double-invoked mount effect, two overlapping start() calls
        // can race on the `captureRef.current` check above, and whichever
        // one wins could be resolving after its own `client` was already
        // superseded/disconnected by the other. Reading clientRef.current
        // here always sends to whichever client is actually live right now.
        await captureRef.current.start((chunk) => clientRef.current?.sendAudioChunk(chunk));
        captureRef.current.setMuted(muted);
      }
    } catch (e) {
      setErrorMessage(describeMicError(e));
    }
    // `muted` is read, not depended on, at start time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureClient]);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    clientRef.current?.disconnect();
    clientRef.current = null;
    playbackRef.current?.stop();
    playbackRef.current = null;
    if (interruptedTimerRef.current) {
      clearTimeout(interruptedTimerRef.current);
      interruptedTimerRef.current = null;
    }
    setIsModelSpeaking(false);
    setWasInterrupted(false);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      captureRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const getMicLevel = useCallback(() => captureRef.current?.getLevel() ?? 0, []);
  const getOutputLevel = useCallback(() => playbackRef.current?.getLevel() ?? 0, []);

  // Session cleanup: tear the connection and hardware streams down if the
  // component holding this hook unmounts without calling stop() itself.
  useEffect(() => stop, [stop]);

  return {
    state,
    statusMessage,
    errorMessage,
    isModelSpeaking,
    wasInterrupted,
    transcript,
    interimCaption,
    latencyMs,
    muted,
    toggleMuted,
    start,
    stop,
    getMicLevel,
    getOutputLevel,
  };
}
