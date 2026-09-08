export type Route = 'chat' | 'home' | 'memory' | 'knowledge' | 'reminders' | 'notes' | 'tools';

export type Theme = 'dark' | 'light';

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';

export interface ChatMessage {
  role: 'user' | 'friday';
  text: string;
  /** Set when generating this reply failed - rendered in place of (or after any partial) response text, not as a separate banner. */
  errorMessage?: string;
}
