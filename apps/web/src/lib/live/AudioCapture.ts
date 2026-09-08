function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Wraps raw PCM16 mono samples in a minimal 44-byte WAV header - no encoder library needed for this format. */
function encodeWav(samples: Int16Array, sampleRateHz: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRateHz * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  new Int16Array(buffer, 44).set(samples);
  return new Blob([buffer], { type: 'audio/wav' });
}

export interface VoiceMemoRecording {
  blob: Blob;
  sampleRateHz: number;
  durationMs: number;
}

/**
 * Captures the microphone as 16kHz mono PCM16 chunks (the format Gemini
 * Live's `sendRealtimeInput` expects) via an AudioWorklet, and never routes
 * the raw stream anywhere else - no recording, no upload except through the
 * caller-supplied chunk callback (and the opt-in memo tee below, used only
 * while a personal voice memo is actively being recorded).
 */
export class AudioCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array<ArrayBuffer> | null = null;
  private memoChunks: Int16Array[] | null = null;

  async start(onChunk: (base64Pcm16Mono16k: string) => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone access (getUserMedia).');
    }
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('This browser does not support the Web Audio API.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    // Ask for a 16kHz context so browsers that honor the hint (most of
    // Chromium/Firefox) skip resampling entirely. Browsers that ignore it
    // (older Safari builds) fall back on the worklet's own resampler, which
    // reads the context's *actual* rate rather than assuming this was honored.
    this.context = new AudioContextCtor({ sampleRate: 16000 });
    if (!this.context.audioWorklet) {
      throw new Error('This browser does not support AudioWorklet.');
    }
    await this.context.audioWorklet.addModule('/worklets/pcm-capture-processor.js');

    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, 'pcm-capture-processor');
    this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      onChunk(bufferToBase64(event.data));
      // Tees the same already-flowing chunks into a buffer while a voice
      // memo is being recorded - doesn't touch getUserMedia again, and never
      // affects the Gemini streaming path above.
      if (this.memoChunks) {
        this.memoChunks.push(new Int16Array(event.data));
      }
    };
    // Deliberately not connected to `context.destination` - we must not
    // play the user's own mic back to them.
    this.source.connect(this.worklet);

    // A second, parallel tap purely for level metering (getLevel) - doesn't
    // need to reach destination either, an AnalyserNode just needs input
    // connected to have data to read.
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.levelData = new Uint8Array(this.analyser.frequencyBinCount);
    this.source.connect(this.analyser);
  }

  setMuted(muted: boolean): void {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  /** Current mic input level as a rough 0-1 RMS value - polled from an animation loop, not pushed. */
  getLevel(): number {
    if (!this.analyser || !this.levelData) return 0;
    this.analyser.getByteTimeDomainData(this.levelData);
    let sumSquares = 0;
    for (let i = 0; i < this.levelData.length; i++) {
      const normalized = (this.levelData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / this.levelData.length);
  }

  /** Starts teeing chunks for a personal voice memo - mic streaming to Gemini is unaffected. */
  startMemoRecording(): void {
    this.memoChunks = [];
  }

  /** Stops teeing and returns the recorded memo as a WAV blob, or null if none was in progress. */
  stopMemoRecording(): VoiceMemoRecording | null {
    if (!this.memoChunks) return null;
    const chunks = this.memoChunks;
    this.memoChunks = null;

    const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Int16Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const sampleRateHz = this.context?.sampleRate ?? 16000;
    return {
      blob: encodeWav(samples, sampleRateHz),
      sampleRateHz,
      durationMs: Math.round((totalSamples / sampleRateHz) * 1000),
    };
  }

  stop(): void {
    this.analyser?.disconnect();
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.analyser = null;
    this.levelData = null;
    this.worklet = null;
    this.source = null;
    this.stream = null;
    this.context = null;
    this.memoChunks = null;
  }
}
