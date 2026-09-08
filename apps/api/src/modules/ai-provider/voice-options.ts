// Gemini's documented catalog of prebuilt Live/TTS voices (see
// https://ai.google.dev/gemini-api/docs/live and .../speech-generation) -
// `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` only ever accepts
// a name from this fixed roster. There is no free-text or voice-cloning
// option on this project's API tier (that's `replicatedVoiceConfig`, a
// separate consent-gated feature) - so unlike delivery style, this list is
// not something a user can extend, only pick from.
export const PREBUILT_VOICE_NAMES = [
  'Zephyr',
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Leda',
  'Orus',
  'Aoede',
  'Callirrhoe',
  'Autonoe',
  'Enceladus',
  'Iapetus',
  'Umbriel',
  'Algieba',
  'Despina',
  'Erinome',
  'Algenib',
  'Rasalgethi',
  'Laomedeia',
  'Achernar',
  'Alnilam',
  'Schedar',
  'Gacrux',
  'Pulcherrima',
  'Achird',
  'Zubenelgenubi',
  'Vindemiatrix',
  'Sadachbia',
  'Sadaltager',
  'Sulafat',
] as const;

export type PrebuiltVoiceName = (typeof PREBUILT_VOICE_NAMES)[number];

// Google's own docs give only a one-word style tag per voice (Bright,
// Upbeat, ...) and never state a gender for any of them (verified against
// https://ai.google.dev/gemini-api/docs/speech-generation) - so the gender
// tag below is our own best-effort characterization of how each voice
// actually sounds, not an official spec. Worth an ear-check against the
// real samples (Settings > Voice > preview) if precision here ever matters.
const VOICE_DESCRIPTIONS: Record<PrebuiltVoiceName, string> = {
  Zephyr: 'Female · Bright and airy',
  Puck: 'Male · Upbeat and playful',
  Charon: 'Male · Informative and steady',
  Kore: 'Female · Firm and confident',
  Fenrir: 'Male · Excitable and animated',
  Leda: 'Female · Youthful and light',
  Orus: 'Male · Firm and grounded',
  Aoede: 'Female · Breezy and relaxed',
  Callirrhoe: 'Female · Easy-going and warm',
  Autonoe: 'Female · Bright and clear',
  Enceladus: 'Male · Breathy and soft',
  Iapetus: 'Male · Clear and precise',
  Umbriel: 'Male · Easy-going and calm',
  Algieba: 'Male · Smooth and polished',
  Despina: 'Female · Smooth and silky',
  Erinome: 'Female · Clear and crisp',
  Algenib: 'Male · Gravelly and textured',
  Rasalgethi: 'Male · Informative and measured',
  Laomedeia: 'Female · Upbeat and lively',
  Achernar: 'Female · Soft and gentle',
  Alnilam: 'Male · Firm and steady',
  Schedar: 'Male · Even and balanced',
  Gacrux: 'Female · Mature and grounded',
  Pulcherrima: 'Female · Forward and assertive',
  Achird: 'Male · Friendly and approachable',
  Zubenelgenubi: 'Male · Casual and relaxed',
  Vindemiatrix: 'Female · Gentle and soothing',
  Sadachbia: 'Male · Lively and animated',
  Sadaltager: 'Male · Knowledgeable and composed',
  Sulafat: 'Female · Warm and rich',
};

export interface PrebuiltVoice {
  name: PrebuiltVoiceName;
  description: string;
}

export const PREBUILT_VOICES: PrebuiltVoice[] = PREBUILT_VOICE_NAMES.map((name) => ({
  name,
  description: VOICE_DESCRIPTIONS[name],
}));

export interface VoiceDeliveryStyleOption {
  key: string;
  label: string;
  // Folded into the Live session's system instruction (see
  // jarvis-persona.buildVoiceSystemPrompt) - unlike voiceName, this isn't a
  // Gemini API parameter, just steering text the model tends to follow.
  instruction: string;
}

export const VOICE_DELIVERY_STYLES: VoiceDeliveryStyleOption[] = [
  {
    key: 'calm-measured',
    label: 'Calm & measured',
    instruction: 'Calm, measured, and precise - understated confidence, no filler words.',
  },
  {
    key: 'warm-friendly',
    label: 'Warm & friendly',
    instruction: 'Warm, friendly, and conversational - like a helpful colleague, not a formal assistant.',
  },
  {
    key: 'brisk-efficient',
    label: 'Brisk & efficient',
    instruction: 'Brisk and efficient - short sentences, straight to the point, minimal small talk.',
  },
  {
    key: 'formal-professional',
    label: 'Formal & professional',
    instruction: 'Formal and professional - precise language, no slang, no contractions.',
  },
  {
    key: 'playful-energetic',
    label: 'Playful & energetic',
    instruction: 'Playful and energetic - light humor is welcome, upbeat pacing.',
  },
];

export const VOICE_DELIVERY_STYLE_KEYS = VOICE_DELIVERY_STYLES.map((s) => s.key);

export function deliveryStyleInstructionFor(key: string | null | undefined): string | undefined {
  return VOICE_DELIVERY_STYLES.find((s) => s.key === key)?.instruction;
}
