function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Captures the microphone as 16kHz mono PCM16 chunks (the format Gemini
 * Live's `sendRealtimeInput` expects) via an AudioWorklet, and never routes
 * the raw stream anywhere else - no recording, no upload except through the
 * caller-supplied chunk callback.
 */
export class AudioCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;

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
    };
    // Deliberately not connected to `context.destination` - we must not
    // play the user's own mic back to them.
    this.source.connect(this.worklet);
  }

  setMuted(muted: boolean): void {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  stop(): void {
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.worklet = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}
