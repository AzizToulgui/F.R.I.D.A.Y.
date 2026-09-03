const OUTPUT_SAMPLE_RATE = 24_000; // Gemini Live streams response audio at 24kHz mono PCM16.

/**
 * Plays back streamed Gemini audio chunks gaplessly by scheduling each
 * decoded chunk to start exactly when the previous one ends, and can be
 * flushed immediately on a barge-in/interruption signal from the server.
 */
export class AudioPlayback {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array<ArrayBuffer> | null = null;

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      this.nextStartTime = this.context.currentTime;
      // Every buffer source routes through this one shared analyser on its
      // way to destination, so getLevel() reflects whatever's audible right
      // now regardless of how many scheduled chunks are overlapping.
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.levelData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(this.context.destination);
    }
    return this.context;
  }

  /** Current output level as a rough 0-1 RMS value - polled from an animation loop, not pushed. */
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

  /**
   * Creates (and resumes) the playback AudioContext as close to the user's
   * click as possible. Browsers suspend contexts by default and only allow
   * audible playback once resumed inside/near a user gesture; if we wait
   * until the first audio chunk actually arrives (after the token round-trip
   * and Gemini's own reply latency), that window has usually closed and the
   * context silently stays suspended forever - no error, just no sound.
   */
  async init(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
  }

  /** True once the context is actually able to produce audible output. */
  isRunning(): boolean {
    return this.context?.state === 'running';
  }

  enqueue(base64Pcm16Mono24k: string): void {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      // Best-effort catch-up if init() didn't already unblock it (e.g. the
      // tab lost focus mid-call) - not awaited, scheduling below still runs.
      void context.resume();
    }
    const binary = atob(base64Pcm16Mono24k);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;

    const buffer = context.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    // Non-null: ensureContext() above always creates `analyser` together with `context`.
    source.connect(this.analyser!);
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
    };

    const startAt = Math.max(this.nextStartTime, context.currentTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.activeSources.push(source);
  }

  /** Stops everything queued right now - used when the server reports the user interrupted a turn. */
  clear(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Already stopped/ended - fine to ignore.
      }
    }
    this.activeSources = [];
    if (this.context) this.nextStartTime = this.context.currentTime;
  }

  stop(): void {
    this.clear();
    this.analyser?.disconnect();
    void this.context?.close();
    this.context = null;
    this.analyser = null;
    this.levelData = null;
  }
}
