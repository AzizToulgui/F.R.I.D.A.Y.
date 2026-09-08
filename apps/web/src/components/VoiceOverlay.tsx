'use client';

import { useEffect, useRef, useState } from 'react';
import { MicIcon, MicOffIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Persona, type PersonaState } from '@/components/ai-elements/persona';
import { useLiveSession } from '@/lib/live/useLiveSession';
import type { OrbMode } from '@/types';

interface VoiceOverlayProps {
  onClose: () => void;
}

const PERSONA_STATE_BY_ORB_MODE: Record<OrbMode, PersonaState> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
  interrupted: 'listening',
  error: 'asleep',
};

const RING_OUTER_CLASS_BY_MODE: Record<OrbMode, string> = {
  idle: 'opacity-35 animate-[jv-orbit-spin_9s_linear_infinite]',
  listening: 'opacity-55 animate-[jv-orbit-spin_6s_linear_infinite]',
  thinking: 'opacity-15 animate-[jv-orbit-spin_22s_linear_infinite]',
  speaking: 'opacity-90 animate-[jv-orbit-spin_2.6s_linear_infinite]',
  interrupted: 'opacity-55 animate-[jv-orbit-spin_6s_linear_infinite]',
  error: 'opacity-10 animate-[jv-orbit-spin_30s_linear_infinite]',
};

const RING_INNER_CLASS_BY_MODE: Record<OrbMode, string> = {
  idle: 'opacity-25 animate-[jv-orbit-spin-rev_13s_linear_infinite]',
  listening: 'opacity-40 animate-[jv-orbit-spin-rev_9s_linear_infinite]',
  thinking: 'opacity-10 animate-[jv-orbit-spin-rev_28s_linear_infinite]',
  speaking: 'opacity-75 animate-[jv-orbit-spin-rev_3.8s_linear_infinite]',
  interrupted: 'opacity-40 animate-[jv-orbit-spin-rev_9s_linear_infinite]',
  error: 'opacity-8 animate-[jv-orbit-spin-rev_36s_linear_infinite]',
};

const SMOKE_CLASS_BY_MODE: Record<OrbMode, string> = {
  idle: 'opacity-45 animate-[jv-smoke-swirl_11s_ease-in-out_infinite]',
  listening: 'opacity-60 animate-[jv-smoke-swirl_7s_ease-in-out_infinite]',
  thinking: 'opacity-25 animate-[jv-smoke-swirl_18s_ease-in-out_infinite]',
  speaking: 'opacity-90 animate-[jv-smoke-swirl_3.4s_ease-in-out_infinite]',
  interrupted: 'opacity-60 animate-[jv-smoke-swirl_7s_ease-in-out_infinite]',
  error: 'opacity-15 animate-[jv-smoke-swirl_22s_ease-in-out_infinite]',
};

const LABELS: Record<OrbMode, [string, string]> = {
  idle: ['Ready when you are', 'IDLE'],
  listening: ['Listening…', 'MIC LIVE · INTERRUPT ANY TIME'],
  thinking: ['Connecting…', 'ESTABLISHING SESSION'],
  speaking: ['Speaking', 'STREAMING RESPONSE AUDIO'],
  interrupted: ['Go ahead', 'STOPPED · LISTENING'],
  error: ["Connection lost", 'SEE STATUS BELOW'],
};

export function VoiceOverlay({ onClose }: VoiceOverlayProps) {
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
    recordingMemo,
    stopRecordingMemo,
  } = useLiveSession();
  const [transcriptOn, setTranscriptOn] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void start();
    return () => stop();
    // Connect exactly once when the overlay mounts, disconnect on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Without this, focus stays on whatever button opened the overlay (still
  // in the DOM underneath it, just visually covered) - the Space shortcut
  // below deliberately no-ops while focus sits on a button, so the very
  // first press right after opening would otherwise silently do nothing.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // Escape ends the session (same as the End button); Space toggles mute -
  // both skipped while the browser's own focus is on an interactive element
  // that would normally consume the key (e.g. the Transcript button), so a
  // stray Enter/Space activating a button doesn't also toggle the mic.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      const isInteractive = target?.tagName === 'BUTTON' || target?.tagName === 'INPUT';
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ' && !isInteractive) {
        e.preventDefault();
        toggleMuted();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, toggleMuted]);

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
    <div
      ref={rootRef}
      tabIndex={-1}
      className="absolute inset-0 z-50 flex animate-[jv-rise_0.2s_ease-out] flex-col outline-none [background:radial-gradient(900px_620px_at_50%_42%,var(--ac-xs),transparent_70%),var(--bg-voice)]"
    >
      <div className="relative flex h-14 flex-none items-center justify-center">
        <div className="font-mono text-[10.5px] tracking-[0.34em] text-muted-foreground">FRIDAY</div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onClose}
          aria-label="Exit voice mode"
          className="absolute right-[18px]"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden p-2.5">
        <div className="grid min-h-0 w-full flex-1 place-items-center">
          <div className="relative flex size-[300px] items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full border-2 border-transparent border-t-ac-hi border-r-ac-hi transition-opacity duration-500 ${RING_OUTER_CLASS_BY_MODE[orbMode]}`}
            />
            <div
              className={`absolute inset-[36px] rounded-full border-2 border-transparent border-b-ac-tx border-l-ac-tx transition-opacity duration-500 ${RING_INNER_CLASS_BY_MODE[orbMode]}`}
            />
            <Persona
              variant="opal"
              state={PERSONA_STATE_BY_ORB_MODE[orbMode]}
              className="relative size-56 pointer-events-none [filter:grayscale(1)_sepia(1)_hue-rotate(150deg)_saturate(4.5)_brightness(1.15)]"
            />
            <div className="pointer-events-none absolute inset-[38px] overflow-hidden rounded-full mix-blend-screen">
              <div
                className={`absolute inset-[-60%] bg-[conic-gradient(from_0deg,var(--ac-tx),transparent_30%,var(--ac-hi)_55%,transparent_80%,var(--ac-tx))] blur-xl ${SMOKE_CLASS_BY_MODE[orbMode]}`}
              />
            </div>
          </div>
        </div>
        <div role="status" aria-live="polite" className="flex-none text-[17px] tracking-[0.01em] text-foreground">
          {label}
        </div>
        <div className="flex-none font-mono text-[10.5px] tracking-[0.2em] text-muted-foreground">{sub}</div>
        {recordingMemo && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stopRecordingMemo}
            className="flex-none gap-2 border-destructive/40 bg-destructive/10 text-destructive"
          >
            <span className="size-2 rounded-full bg-destructive [animation:jv-eq_1.1s_ease-in-out_infinite]" />
            Stop Recording
          </Button>
        )}
        {errorMessage && (
          <div className="flex-none text-[12.5px] text-destructive">
            {errorMessage}{' '}
            <Button type="button" variant="link" size="sm" onClick={() => void start()} className="h-auto p-0 text-destructive">
              Retry
            </Button>
          </div>
        )}
      </div>

      {transcriptOn && (transcript || interimCaption) && (
        <div className="mx-auto flex w-[min(680px,92vw)] flex-none flex-col gap-2.5 px-4 pb-1.5">
          {interimCaption && (
            <div
              dir="auto"
              className="self-end max-w-[80%] rounded-[14px] rounded-br-[4px] border bg-muted px-3.5 py-2.5 text-[13.5px] text-muted-foreground italic opacity-80"
            >
              {interimCaption}
            </div>
          )}
          {transcript && (
            <div dir="auto" className="max-w-[88%] text-[14.5px] leading-relaxed text-muted-foreground">
              {transcript}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-none items-center justify-center gap-3 px-4 pt-5 pb-[30px]">
        <Button type="button" variant="outline" onClick={() => setTranscriptOn((v) => !v)} className="h-10 rounded-xl">
          Transcript
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          className={`h-14 w-14 rounded-full ${
            muted ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary/40 bg-primary/10 text-primary'
          }`}
        >
          {muted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
        </Button>
        <Button type="button" variant="destructive" onClick={onClose} className="h-10 rounded-xl">
          End
        </Button>
      </div>
      <div className="flex-none pb-3 text-center font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70">
        SPACE TO MUTE · ESC TO END
      </div>
    </div>
  );
}
