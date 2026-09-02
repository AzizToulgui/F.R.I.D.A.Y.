'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { Orb } from '@/components/Orb';
import type { Theme } from '@/types';

interface HomeViewProps {
  theme: Theme;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onOpenVoice: () => void;
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  { title: 'Plan my day', sub: '4 meetings, 2 deadlines', text: 'Plan my day around the latency retro.' },
  { title: 'Search my knowledge', sub: '6 documents indexed', text: 'Search my knowledge for the VAD notes.' },
  { title: 'Help me write', sub: 'Retro agenda draft', text: 'Draft the retro agenda from my notes.' },
  { title: 'Analyze a document', sub: 'Drop a file to begin', text: 'Plan my day around the latency retro.' },
];

export function HomeView({ theme, draft, onDraftChange, onSend, onOpenVoice, onSuggestion }: HomeViewProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => onDraftChange(e.target.value);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      <Orb mode="idle" isLight={theme === 'light'} size="home" />
      <div className="mt-1 font-mono text-[10.5px] tracking-[0.34em] text-tx4">JARVIS CORE</div>
      <h1 className="my-3.5 mt-3.5 mb-[26px] text-[30px] leading-none font-normal tracking-[-0.01em] text-tx">
        How can I assist?
      </h1>

      <div className="w-full max-w-[640px]">
        <div className="overflow-hidden rounded-[18px] border border-line2 bg-panel2 shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
          <textarea
            value={draft}
            onChange={onChange}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="Message JARVIS"
            placeholder="Ask JARVIS anything…"
            className="min-h-[52px] w-full border-0 bg-transparent px-[18px] pt-4 pb-1 text-[14.5px] text-tx outline-none"
          />
          <div className="flex items-center gap-2 px-3 pt-2 pb-2.5">
            <button
              type="button"
              aria-label="Attach"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] border border-line2 bg-transparent text-tx2 hover:border-line3 hover:text-tx"
            >
              ＋
            </button>
            <button
              type="button"
              className="h-8 cursor-pointer rounded-[10px] border border-line2 bg-transparent px-[11px] text-[12.5px] text-tx2 hover:border-line3 hover:text-tx"
            >
              ⌘ Tools
            </button>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onOpenVoice}
                aria-label="Voice mode"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] border border-ac-m bg-ac-xs text-ac-tx hover:bg-ac-s"
              >
                🎙
              </button>
              <button
                type="button"
                onClick={onSend}
                className="h-8 cursor-pointer rounded-[10px] border-0 bg-ac px-4 text-[13px] font-semibold text-ac-fg hover:bg-ac-hi"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => onSuggestion(s.text)}
              className="cursor-pointer rounded-xl border border-line px-3.5 py-3 text-left hover:border-ac-m hover:bg-ac-xs"
            >
              <div className="text-[13.5px] text-tx2">{s.title}</div>
              <div className="mt-[3px] text-[11.5px] text-tx4">{s.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
