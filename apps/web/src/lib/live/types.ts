export type LiveConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closing'
  | 'closed'
  | 'error';

export interface LiveSessionTokenResponse {
  token: string;
  expiresAt: string;
  newSessionExpiresAt: string;
  model: string;
}

export interface LiveTurnEvent {
  /** Base64-encoded PCM audio chunk(s) from this server message, if any. */
  audioBase64?: string;
  /** True if the user's speech interrupted a model turn in progress. */
  interrupted?: boolean;
  /** True once the model has finished this turn. */
  turnComplete?: boolean;
  /**
   * True exactly once, on the first audio byte of a fresh model turn -
   * tracked by LiveClient's own instance state (not React state, which
   * would be stale inside this long-lived callback). Lets the UI reset
   * per-turn text instead of letting every turn's transcript run together.
   */
  isNewTurn?: boolean;
  /** Finalized chunk of the model's own speech transcript, when available. */
  outputText?: string;
  /** Low-latency, still-changing transcript of what the user is saying right now. */
  interimInputText?: string;
  /** Finalized transcript of what the user said, once Gemini has settled on it. */
  inputText?: string;
}

export interface LiveFunctionCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export interface LiveFunctionResponse {
  name: string;
  id?: string;
  response: Record<string, unknown>;
}

export interface LiveClientCallbacks {
  onStateChange?: (state: LiveConnectionState) => void;
  onTurn?: (event: LiveTurnEvent) => void;
  /** Non-fatal, human-readable status for UI/debugging (e.g. "reconnecting (2/5)"). */
  onStatus?: (message: string) => void;
  /** Fatal error - the client has given up reconnecting. */
  onFatalError?: (message: string) => void;
  /** Approximate ms from the user's last recognized speech to the first byte of the model's reply audio. */
  onLatency?: (ms: number) => void;
}
