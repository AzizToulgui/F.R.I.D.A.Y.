export type Route = 'chat' | 'home' | 'memory' | 'knowledge' | 'tools';

export type Theme = 'dark' | 'light';

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';

export interface ChatMessage {
  role: 'user' | 'jarvis';
  text: string;
}
