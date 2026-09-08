'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'friday:tts-settings';

export interface TtsSettings {
  /** SpeechSynthesisVoice.voiceURI of the chosen voice, or null to use the browser's default. */
  voiceURI: string | null;
  rate: number;
  pitch: number;
}

// Chrome exposes this as a network voice (SpeechSynthesisVoice.localService
// === false) with an identical name/voiceURI on every platform we've
// checked, unlike local SAPI/OS voices which vary machine to machine - a
// reasonable default that most users won't need to change.
const DEFAULT_VOICE_URI = 'Google UK English Female';

export const DEFAULT_TTS_SETTINGS: TtsSettings = { voiceURI: DEFAULT_VOICE_URI, rate: 1, pitch: 1 };

export function loadTtsSettings(): TtsSettings {
  if (typeof window === 'undefined') return DEFAULT_TTS_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TTS_SETTINGS;
    return { ...DEFAULT_TTS_SETTINGS, ...(JSON.parse(raw) as Partial<TtsSettings>) };
  } catch {
    return DEFAULT_TTS_SETTINGS;
  }
}

export function saveTtsSettings(settings: TtsSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Applies the saved voice/rate/pitch preference to an utterance - falls back to the browser default voice if the saved one isn't installed on this browser/device. */
export function applyTtsSettings(utterance: SpeechSynthesisUtterance, settings: TtsSettings) {
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  if (settings.voiceURI) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.voiceURI === settings.voiceURI) ?? voices.find((v) => v.name === settings.voiceURI);
    if (voice) utterance.voice = voice;
  }
}

/** Live list of installed speech-synthesis voices - some browsers populate this asynchronously via the voiceschanged event rather than on first call. */
export function useSpeechVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  return voices;
}
