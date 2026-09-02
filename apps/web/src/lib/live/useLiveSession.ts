'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AudioCapture } from './AudioCapture';
import { AudioPlayback } from './AudioPlayback';
import { LiveClient } from './LiveClient';
import type { LiveConnectionState, LiveSessionTokenResponse } from './types';

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

    const client = new LiveClient({
      getToken: () => authFetch<LiveSessionTokenResponse>('/live/session', { method: 'POST' }),
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
      setErrorMessage(e instanceof Error ? e.message : 'Microphone access was denied or unavailable.');
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
  };
}
