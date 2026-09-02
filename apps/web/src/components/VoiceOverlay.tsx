'use client';

import { useEffect, useState } from 'react';
import { Orb } from './Orb';
import { useLiveSession } from '@/lib/live/useLiveSession';
import type { OrbMode, Theme } from '@/types';

interface VoiceOverlayProps {
  theme: Theme;
  onClose: () => void;
}

const LABELS: Record<OrbMode, [string, string]> = {
  idle: ['Ready when you are', 'IDLE'],
  listening: ['Listening…', 'MIC LIVE · INTERRUPT ANY TIME'],
  thinking: ['Connecting…', 'ESTABLISHING SESSION'],
  speaking: ['Speaking', 'STREAMING RESPONSE AUDIO'],
  interrupted: ['Go ahead', 'STOPPED · LISTENING'],
  error: ["Connection lost", 'SEE STATUS BELOW'],
};

export function VoiceOverlay({ theme, onClose }: VoiceOverlayProps) {
  const {
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
  } = useLiveSession();
  const [transcriptOn, setTranscriptOn] = useState(true);

  useEffect(() => {
    void start();
    return () => stop();
    // Connect exactly once when the overlay mounts, disconnect on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbMode: OrbMode =
    state === 'error'
      ? 'error'
      : state === 'connecting' || state === 'reconnecting'
        ? 'thinking'
        : state === 'connected'
          ? wasInterrupted
            ? 'interrupted'
            : isModelSpeaking
              ? 'speaking'
              : 'listening'
          : 'idle';

  const [label, defaultSub] = LABELS[orbMode];
  const sub =
    state === 'reconnecting' && statusMessage
      ? statusMessage.toUpperCase()
      : state === 'connected' && latencyMs !== null
        ? `${defaultSub} · ~${Math.round(latencyMs)}MS`
        : defaultSub;

  return (
    <div className="absolute inset-0 z-50 flex animate-[jv-rise_0.2s_ease-out] flex-col [background:radial-gradient(900px_620px_at_50%_42%,var(--ac-xs),transparent_70%),var(--bg-voice)]">
      <div className="relative flex h-14 flex-none items-center justify-center">
        <div className="font-mono text-[10.5px] tracking-[0.34em] text-tx4">JARVIS</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit voice mode"
          className="absolute right-[18px] flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] border border-line2 bg-transparent text-tx2 hover:border-line3 hover:text-tx"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden p-2.5">
        <div className="grid min-h-0 w-full flex-1 place-items-center">
          <Orb mode={orbMode} isLight={theme === 'light'} size="voice" />
        </div>
        <div role="status" aria-live="polite" className="flex-none text-[17px] tracking-[0.01em] text-tx">
          {label}
        </div>
        <div className="flex-none font-mono text-[10.5px] tracking-[0.2em] text-tx4">{sub}</div>
        {errorMessage && (
          <div className="flex-none text-[12.5px] text-danger">
            {errorMessage}{' '}
            <button type="button" onClick={() => void start()} className="cursor-pointer underline">
              Retry
            </button>
          </div>
        )}
      </div>

      {transcriptOn && (transcript || interimCaption) && (
        <div className="mx-auto flex w-[min(680px,92vw)] flex-none flex-col gap-2.5 px-4 pb-1.5">
          {interimCaption && (
            <div
              dir="auto"
              className="self-end max-w-[80%] rounded-[14px] rounded-br-[4px] border border-line bg-line px-3.5 py-2.5 text-[13.5px] text-tx2 italic opacity-80"
            >
              {interimCaption}
            </div>
          )}
          {transcript && (
            <div dir="auto" className="max-w-[88%] text-[14.5px] leading-relaxed text-tx2">
              {transcript}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-none items-center justify-center gap-3 px-4 pt-5 pb-[30px]">
        <button
          type="button"
          onClick={() => setTranscriptOn((v) => !v)}
          className="h-10 cursor-pointer rounded-xl border border-line2 bg-transparent px-[15px] text-[12.5px] text-tx2 hover:border-line3 hover:text-tx"
        >
          Transcript
        </button>
        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border text-[19px] hover:brightness-115 ${
            muted ? 'border-danger-line bg-danger-bg text-danger' : 'border-ac-m bg-ac-s text-ac-tx'
          }`}
        >
          {muted ? '🔇' : '🎙'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 cursor-pointer rounded-xl border border-danger-line bg-transparent px-[15px] text-[12.5px] text-danger hover:bg-danger-bg"
        >
          End
        </button>
      </div>
    </div>
  );
}
