// Ported from apps/web/src/types.ts.
export interface ChatMessage {
  role: 'user' | 'friday';
  text: string;
  /** Set when generating this reply failed - rendered in place of (or after any partial) response text, not as a separate banner. */
  errorMessage?: string;
}
