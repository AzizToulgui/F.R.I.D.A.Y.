import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage, Session } from '@google/genai';
import type {
  LiveClientCallbacks,
  LiveConnectionState,
  LiveFunctionCall,
  LiveFunctionResponse,
  LiveSessionTokenResponse,
  LiveTurnEvent,
} from './types';

const CONNECT_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 800;
const RECONNECT_MAX_DELAY_MS = 12_000;
// Gemini's ephemeral-token API is currently v1alpha-only (see backend
// GeminiProvider) - the live connect must use the same surface as the token
// that authorizes it.
const LIVE_API_VERSION = 'v1alpha';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function backoffDelay(attempt: number): number {
  const exp = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
  return exp / 2 + Math.random() * (exp / 2);
}

/**
 * Manages one real-time voice connection to the Gemini Live API: fetching a
 * fresh ephemeral token from the backend, opening the WebSocket, tracking
 * connection state, and reconnecting (with a resumed session where possible)
 * on drops - without losing the caller's place in the conversation.
 *
 * Deliberately does not touch memory or RAG - this is the transport layer
 * (see Step 4 scope in ARCHITECTURE.md). Tool calls are the one exception
 * (Section 3's "tool calling relay"): this class is just a dumb relay for
 * them too - it never decides whether a tool is allowed to run, it forwards
 * the request to `executeToolCalls` (backed by the authenticated
 * POST /tools/:name/invoke endpoint) and relays the result back into the
 * session, exactly as a `sendRealtimeInput`/audio chunk would be relayed.
 */
export class LiveClient {
  private readonly getToken: () => Promise<LiveSessionTokenResponse>;
  private readonly callbacks: LiveClientCallbacks;
  private readonly executeToolCalls?: (calls: LiveFunctionCall[]) => Promise<LiveFunctionResponse[]>;

  private state: LiveConnectionState = 'idle';
  private session: Session | null = null;
  private sessionResumptionHandle: string | undefined;
  private manualDisconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectSeq = 0;

  // Approximate latency tracking: last time Gemini recognized the user was
  // speaking, and whether we're still waiting for the first audio byte of
  // the model's reply to that speech (reset once we see it, and again on
  // turnComplete/interrupted so the next turn gets its own measurement).
  private lastUserSpeechAt: number | null = null;
  private awaitingFirstAudioOfTurn = true;

  constructor(options: {
    getToken: () => Promise<LiveSessionTokenResponse>;
    callbacks: LiveClientCallbacks;
    executeToolCalls?: (calls: LiveFunctionCall[]) => Promise<LiveFunctionResponse[]>;
  }) {
    this.getToken = options.getToken;
    this.callbacks = options.callbacks;
    this.executeToolCalls = options.executeToolCalls;
  }

  getState(): LiveConnectionState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected') return;
    this.manualDisconnect = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    await this.attemptConnect();
  }

  /** Sends one chunk of 16kHz mono PCM16 microphone audio, base64-encoded. */
  sendAudioChunk(base64Pcm16Mono16k: string): void {
    if (this.state !== 'connected' || !this.session) return;
    this.session.sendRealtimeInput({
      audio: { data: base64Pcm16Mono16k, mimeType: 'audio/pcm;rate=16000' },
    });
  }

  /** Tells Gemini the mic stream ended (e.g. user muted / left the call). */
  endAudioStream(): void {
    if (this.state !== 'connected' || !this.session) return;
    this.session.sendRealtimeInput({ audioStreamEnd: true });
  }

  /** Graceful disconnect: no further reconnect attempts will be made. */
  disconnect(): void {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.connectSeq += 1; // invalidate any in-flight connect attempt
    this.setState('closing');
    this.session?.close();
    this.session = null;
    this.sessionResumptionHandle = undefined;
    this.reconnectAttempt = 0;
    this.setState('closed');
  }

  private setState(state: LiveConnectionState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async attemptConnect(): Promise<void> {
    const seq = ++this.connectSeq;
    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    let tokenInfo: LiveSessionTokenResponse;
    try {
      tokenInfo = await this.getToken();
    } catch {
      this.handleConnectFailure(seq, 'Could not start a session (sign-in or network issue).');
      return;
    }
    if (seq !== this.connectSeq) return; // superseded by a newer attempt/disconnect

    const opened = createDeferred<void>();
    const ai = new GoogleGenAI({ apiKey: tokenInfo.token, httpOptions: { apiVersion: LIVE_API_VERSION } });

    const timeout = setTimeout(() => {
      opened.reject(new Error('Connection attempt timed out.'));
    }, CONNECT_TIMEOUT_MS);

    try {
      const session = await ai.live.connect({
        model: tokenInfo.model,
        config: {
          responseModalities: [Modality.AUDIO],
          sessionResumption: this.sessionResumptionHandle ? { handle: this.sessionResumptionHandle } : {},
          // Needed for interim/final speech transcripts (LiveTurnEvent's
          // interimInputText/inputText/outputText) - off by default.
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => opened.resolve(),
          onmessage: (message) => this.handleMessage(seq, message),
          onerror: (event) => this.callbacks.onStatus?.(`Live connection error: ${event.message || 'unknown'}`),
          onclose: (event) => this.handleClose(seq, event.reason),
        },
      });
      if (seq !== this.connectSeq) {
        session.close();
        return;
      }
      this.session = session;
      await opened.promise;
      clearTimeout(timeout);
      if (seq !== this.connectSeq) return;

      this.reconnectAttempt = 0;
      this.lastUserSpeechAt = null;
      this.awaitingFirstAudioOfTurn = true;
      this.setState('connected');
    } catch (error) {
      clearTimeout(timeout);
      this.session?.close();
      this.session = null;
      const message = error instanceof Error ? error.message : 'Could not open the live connection.';
      this.handleConnectFailure(seq, message);
    }
  }

  private handleMessage(seq: number, message: LiveServerMessage): void {
    if (seq !== this.connectSeq) return;

    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
      this.sessionResumptionHandle = message.sessionResumptionUpdate.newHandle;
    }
    if (message.goAway) {
      this.callbacks.onStatus?.('Server is ending this session soon; will reconnect automatically.');
    }

    if (message.toolCall?.functionCalls?.length) {
      const calls: LiveFunctionCall[] = message.toolCall.functionCalls
        .filter((call): call is typeof call & { name: string } => Boolean(call.name))
        .map((call) => ({ name: call.name, args: call.args ?? {}, id: call.id }));
      if (calls.length > 0) this.handleToolCall(seq, calls);
    }

    const content = message.serverContent;
    if (!content && !message.data) return;

    const userSpeechText = content?.interimInputTranscription?.text ?? content?.inputTranscription?.text;
    if (userSpeechText) this.lastUserSpeechAt = Date.now();

    let isNewTurn = false;
    if (message.data && this.awaitingFirstAudioOfTurn) {
      this.awaitingFirstAudioOfTurn = false;
      isNewTurn = true;
      if (this.lastUserSpeechAt !== null) {
        this.callbacks.onLatency?.(Date.now() - this.lastUserSpeechAt);
      }
    }
    if (content?.turnComplete || content?.interrupted) {
      this.awaitingFirstAudioOfTurn = true;
    }

    const event: LiveTurnEvent = {
      audioBase64: message.data,
      interrupted: content?.interrupted,
      turnComplete: content?.turnComplete,
      isNewTurn,
      outputText: content?.outputTranscription?.text ?? undefined,
      interimInputText: content?.interimInputTranscription?.text ?? undefined,
      inputText: content?.inputTranscription?.text ?? undefined,
    };
    this.callbacks.onTurn?.(event);
  }

  /**
   * Relays a Gemini-requested tool call to the backend and the result back
   * into the session - fire-and-forget from handleMessage's perspective
   * (the Live protocol doesn't block on this either; Gemini just waits for
   * the matching sendToolResponse before continuing that turn).
   */
  private handleToolCall(seq: number, calls: LiveFunctionCall[]): void {
    if (!this.executeToolCalls) {
      // No relay wired up (e.g. this session was opened without tool
      // support) - tell Gemini every call failed rather than hanging it.
      this.session?.sendToolResponse({
        functionResponses: calls.map((call) => ({
          id: call.id,
          name: call.name,
          response: { error: 'Tool calling is not available in this session.' },
        })),
      });
      return;
    }

    void this.executeToolCalls(calls)
      .then((responses) => {
        if (seq !== this.connectSeq || !this.session) return;
        this.session.sendToolResponse({
          functionResponses: responses.map((response) => ({
            id: response.id,
            name: response.name,
            response: response.response,
          })),
        });
      })
      .catch((error) => {
        if (seq !== this.connectSeq || !this.session) return;
        this.callbacks.onStatus?.(
          `Tool call failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        this.session.sendToolResponse({
          functionResponses: calls.map((call) => ({
            id: call.id,
            name: call.name,
            response: { error: 'Tool execution failed.' },
          })),
        });
      });
  }

  private handleClose(seq: number, reason: string): void {
    if (seq !== this.connectSeq) return;
    this.session = null;
    if (this.manualDisconnect) {
      this.setState('closed');
      return;
    }
    this.scheduleReconnect(reason || 'connection closed');
  }

  private handleConnectFailure(seq: number, reason: string): void {
    if (seq !== this.connectSeq) return;
    this.scheduleReconnect(reason);
  }

  private scheduleReconnect(reason: string): void {
    if (this.manualDisconnect) {
      this.setState('closed');
      return;
    }
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.setState('error');
      this.callbacks.onFatalError?.(`Gave up reconnecting after ${MAX_RECONNECT_ATTEMPTS} attempts (${reason}).`);
      return;
    }

    const delay = backoffDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.callbacks.onStatus?.(
      `Reconnecting (${this.reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS}) in ${Math.round(delay / 100) / 10}s - ${reason}`,
    );
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      void this.attemptConnect();
    }, delay);
  }
}
