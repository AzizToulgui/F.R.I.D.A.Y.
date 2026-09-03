'use client';

import { Orb } from '@/components/Orb';
import { MessageComposer } from '@/components/MessageComposer';
import type { Theme } from '@/types';

interface HomeViewProps {
  theme: Theme;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onOpenVoice: () => void;
  onOpenTools: () => void;
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  { title: 'Plan my day', sub: 'Ask about your priorities', text: 'Help me plan my day.' },
  { title: 'Search my knowledge', sub: 'Look across uploaded documents', text: 'Search my knowledge for…' },
  { title: 'Help me write', sub: 'Draft something from scratch', text: 'Help me write a draft of…' },
  { title: 'Analyze a document', sub: 'Drop a file to begin', text: 'Summarize the document I just uploaded.' },
];

export function HomeView({ theme, draft, onDraftChange, onSend, onOpenVoice, onOpenTools, onSuggestion }: HomeViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      <Orb mode="idle" isLight={theme === 'light'} size="home" />
      <div className="mt-1 font-mono text-[10.5px] tracking-[0.34em] text-tx4">JARVIS CORE</div>
      <h1 className="my-3.5 mt-3.5 mb-[26px] text-[30px] leading-none font-normal tracking-[-0.01em] text-tx">
        How can I assist?
      </h1>

      <div className="w-full max-w-[640px]">
        <MessageComposer
          draft={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
          onOpenVoice={onOpenVoice}
          onOpenTools={onOpenTools}
        />

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
