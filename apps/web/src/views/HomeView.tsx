'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Persona } from '@/components/ai-elements/persona';
import { MessageComposer } from '@/components/MessageComposer';

interface HomeViewProps {
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

export function HomeView({ draft, onDraftChange, onSend, onOpenVoice, onOpenTools, onSuggestion }: HomeViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      <Persona
        variant="opal"
        state="idle"
        className="size-44 pointer-events-none [filter:grayscale(1)_sepia(1)_hue-rotate(150deg)_saturate(4.5)_brightness(1.15)]"
      />
      <div className="mt-1 font-mono text-[10.5px] tracking-[0.34em] text-muted-foreground">JARVIS CORE</div>
      <h1 className="my-3.5 mt-3.5 mb-[26px] text-[30px] leading-none font-normal tracking-[-0.01em] text-foreground">
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
            <Card
              key={s.title}
              size="sm"
              onClick={() => onSuggestion(s.text)}
              className="cursor-pointer ring-border transition-colors hover:bg-accent/40 hover:ring-primary/40"
            >
              <CardHeader>
                <CardTitle className="text-[13.5px] font-normal">{s.title}</CardTitle>
                <CardDescription className="text-[11.5px]">{s.sub}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
