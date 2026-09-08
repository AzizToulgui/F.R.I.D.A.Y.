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

interface VoiceMemoRecord {
  id: string;
  label: string | null;
  durationMs: number;
  createdAt?: string;
}

// Safety net for record_voice_memo: auto-stops (and saves) a forgotten
// recording rather than letting it grow unbounded - see the manual Stop
// Recording control (stopRecordingMemo) for the primary, dependable path.
const MAX_MEMO_DURATION_MS = 120_000;

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
  /** True while a personal voice memo (record_voice_memo) is being recorded. */
  recordingMemo: boolean;
  /** Manually stops and saves the in-progress voice memo - the dependable path, independent of the model hearing a spoken cue. */
  stopRecordingMemo: () => void;
}

export function useLiveSession(): UseLiveSessionResult {
  const { authFetch, authFetchStream } = useAuth();
  const [state, setState] = useState<LiveConnectionState>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimCaption, setInterimCaption] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [recordingMemo, setRecordingMemo] = useState(false);

  const clientRef = useRef<LiveClient | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);
  const interruptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoLabelRef = useRef<string | undefined>(undefined);

  // Stops teeing mic chunks (see AudioCapture.stopMemoRecording), uploads the
  // resulting WAV, and clears the safety-net timeout - shared by both the
  // model-invoked stop_recording_voice_memo tool call and the manual Stop
  // Recording button (stopRecordingMemo).
  const uploadMemo = useCallback(
    async (label: string | undefined): Promise<VoiceMemoRecord | null> => {
      if (memoTimeoutRef.current) {
        clearTimeout(memoTimeoutRef.current);
        memoTimeoutRef.current = null;
      }
      const recording = captureRef.current?.stopMemoRecording() ?? null;
      setRecordingMemo(false);
      if (!recording) return null;

      const formData = new FormData();
      formData.append('file', recording.blob, 'memo.wav');
      formData.append('durationMs', String(recording.durationMs));
      formData.append('sampleRateHz', String(recording.sampleRateHz));
      if (label) formData.append('label', label);

      return authFetch<VoiceMemoRecord>('/voice-memos', { method: 'POST', body: formData });
    },
    [authFetch],
  );

  const playMemo = useCallback(
    async (args: { id?: string; label?: string }): Promise<{ status: string; id: string; label: string | null }> => {
      let id = args.id;
      let label: string | null = null;

      if (!id) {
        const memos = await authFetch<VoiceMemoRecord[]>('/voice-memos');
        if (memos.length === 0) throw new Error('No voice memos are saved yet.');
        const wanted = args.label?.toLowerCase();
        const match = wanted ? memos.find((m) => m.label?.toLowerCase().includes(wanted)) : undefined;
        const chosen = match ?? memos[0];
        id = chosen.id;
        label = chosen.label;
      }

      const response = await authFetchStream(`/voice-memos/${encodeURIComponent(id)}/audio`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
      return { status: 'playing', id, label };
    },
    [authFetch, authFetchStream],
  );

  // Manual stop (primary path, per the record/stop UX design): independent
  // of the model correctly hearing a spoken "stop" cue.
  const stopRecordingMemo = useCallback(() => {
    void uploadMemo(memoLabelRef.current);
  }, [uploadMemo]);

  const ensureClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;
    playbackRef.current = new AudioPlayback();

    // Relays a Gemini tool_call to the authenticated backend and turns the
    // result (or any failure - network, validation, unknown tool) into a
    // FunctionResponse - see ARCHITECTURE.md Section 3's tool calling relay.
    // This hook never decides whether a call is allowed; ToolExecutionService does.
    // The three voice-memo tool names are intercepted here instead: the
    // backend never sees Live audio at all (see LiveController), so
    // recording/playback has to happen in the browser.
    const executeToolCalls = async (calls: LiveFunctionCall[]): Promise<LiveFunctionResponse[]> => {
      return Promise.all(
        calls.map(async (call): Promise<LiveFunctionResponse> => {
          if (call.name === 'record_voice_memo') {
            try {
              captureRef.current?.startMemoRecording();
              memoLabelRef.current = typeof call.args.label === 'string' ? call.args.label : undefined;
              setRecordingMemo(true);
              if (memoTimeoutRef.current) clearTimeout(memoTimeoutRef.current);
              memoTimeoutRef.current = setTimeout(() => {
                void uploadMemo(memoLabelRef.current);
              }, MAX_MEMO_DURATION_MS);
              return { name: call.name, id: call.id, response: { output: { status: 'recording_started' } } };
            } catch (e) {
              return {
                name: call.name,
                id: call.id,
                response: { error: e instanceof Error ? e.message : 'Could not start recording.' },
              };
            }
          }

          if (call.name === 'stop_recording_voice_memo') {
            try {
              const memo = await uploadMemo(memoLabelRef.current);
              if (!memo) {
                return { name: call.name, id: call.id, response: { error: 'No recording was in progress.' } };
              }
              return { name: call.name, id: call.id, response: { output: memo } };
            } catch (e) {
              return {
                name: call.name,
                id: call.id,
                response: { error: e instanceof Error ? e.message : 'Could not save the recording.' },
              };
            }
          }

          if (call.name === 'play_voice_memo') {
            try {
              const id = typeof call.args.id === 'string' ? call.args.id : undefined;
              const label = typeof call.args.label === 'string' ? call.args.label : undefined;
              const played = await playMemo({ id, label });
              return { name: call.name, id: call.id, response: { output: played } };
            } catch (e) {
              return {
                name: call.name,
                id: call.id,
                response: { error: e instanceof Error ? e.message : 'Could not play the memo.' },
              };
            }
          }

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
  }, [authFetch, uploadMemo, playMemo]);

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
    if (memoTimeoutRef.current) {
      clearTimeout(memoTimeoutRef.current);
      memoTimeoutRef.current = null;
    }
    setRecordingMemo(false);
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
    recordingMemo,
    stopRecordingMemo,
  };
}
