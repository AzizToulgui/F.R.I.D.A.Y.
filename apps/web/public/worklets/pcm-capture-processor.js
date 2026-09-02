// Runs on the audio rendering thread. Resamples whatever rate the browser
// actually gave the AudioContext (some browsers, notably Safari, ignore the
// `sampleRate` constructor hint and keep the hardware's native rate) down to
// a true 16kHz via linear interpolation, then emits 20ms (320-sample) Int16
// PCM chunks to the main thread for base64-encoding and sending to Gemini.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._targetRate = 16000;
    // `sampleRate` is the AudioWorkletGlobalScope global - the context's
    // real rendering rate, not the value we asked the constructor for.
    this._ratio = sampleRate / this._targetRate;
    this._chunkSamples = 320;
    this._outBuffer = [];
    this._inQueue = [];
    this._readCursor = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) this._inQueue.push(channel[i]);

    while (true) {
      const i0 = Math.floor(this._readCursor);
      const i1 = i0 + 1;
      if (i1 >= this._inQueue.length) break;
      const frac = this._readCursor - i0;
      const sample = this._inQueue[i0] + (this._inQueue[i1] - this._inQueue[i0]) * frac;
      this._outBuffer.push(sample);
      this._readCursor += this._ratio;

      if (this._outBuffer.length >= this._chunkSamples) {
        this._flush();
      }
    }

    const consumed = Math.floor(this._readCursor);
    if (consumed > 0) {
      this._inQueue.splice(0, consumed);
      this._readCursor -= consumed;
    }
    return true;
  }

  _flush() {
    const chunk = this._outBuffer.splice(0, this._chunkSamples);
    const int16 = new Int16Array(chunk.length);
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(int16.buffer, [int16.buffer]);
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
