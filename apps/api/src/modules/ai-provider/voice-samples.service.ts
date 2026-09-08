import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { AIProvider } from "./ai-provider.interface";

// Fixed, short, and deliberately generic - the point is to hear the
// timbre/pacing of the voice itself, not FRIDAY's persona or branding
// (matches the style of Google's own TTS examples, e.g. "Say cheerfully:
// Have a wonderful day!" - a neutral line, not tied to any assistant).
const SAMPLE_TEXT ="Hello! I'm your AI assistant. I can help you find information, organize your day, and get things done.";

// Derived from SAMPLE_TEXT, not hand-bumped - editing the text above changes
// this automatically. The frontend appends it to the sample URL as a
// cache-buster (see UsersController.voiceOptions / SettingsView) - without
// it, a text edit doesn't change the URL, so both the browser's HTTP cache
// (24h, see UsersController.voiceSample) and this service's own in-memory
// cache below keep serving the *previous* wording indefinitely.
export const SAMPLE_VERSION = createHash('sha256').update(SAMPLE_TEXT).digest('hex').slice(0, 10);

export interface VoiceSample {
  buffer: Buffer;
  mimeType: string;
}

// Caches one synthesized clip per prebuilt voice for the process lifetime -
// there are only ~30 possible voices and the sample text never changes, so
// this is a handful of small WAV buffers in memory, not an unbounded cache.
// Exists mainly to keep repeated/concurrent previews of the same voice (a
// user replaying a sample, or two users previewing "Kore" at once) from
// each burning a Gemini call - see the 429 quota pain in conversation-titling.
@Injectable()
export class VoiceSamplesService {
  private readonly cache = new Map<string, VoiceSample>();
  private readonly inFlight = new Map<string, Promise<VoiceSample>>();

  constructor(private readonly aiProvider: AIProvider) {}

  async getSample(voiceName: string): Promise<VoiceSample> {
    const cached = this.cache.get(voiceName);
    if (cached) return cached;

    const pending = this.inFlight.get(voiceName) ?? this.synthesize(voiceName);
    this.inFlight.set(voiceName, pending);
    try {
      return await pending;
    } finally {
      this.inFlight.delete(voiceName);
    }
  }

  private async synthesize(voiceName: string): Promise<VoiceSample> {
    const { audioBase64, sampleRateHz } =
      await this.aiProvider.synthesizeSpeech(SAMPLE_TEXT, voiceName);
    const sample: VoiceSample = {
      buffer: wrapPcmAsWav(Buffer.from(audioBase64, "base64"), sampleRateHz),
      mimeType: "audio/wav",
    };
    this.cache.set(voiceName, sample);
    return sample;
  }
}

// Gemini's TTS response is raw headerless 16-bit PCM (see GeminiProvider.synthesizeSpeech) -
// browsers can't play that directly, so it gets a standard 44-byte RIFF/WAVE
// header describing that same format before being sent to the client.
function wrapPcmAsWav(pcm: Buffer, sampleRateHz: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRateHz * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size (PCM)
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
