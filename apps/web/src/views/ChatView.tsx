'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { MessageComposer } from '@/components/MessageComposer';
import type { ChatMessage } from '@/types';

interface ChatViewProps {
  msgs: ChatMessage[];
  streaming: boolean;
  error?: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onSuggestion: (text: string) => void;
  onOpenVoice: () => void;
  onOpenTools: () => void;
}

const SUGGESTIONS = [
  'What can you remember about me?',
  'Search my documents for anything about pricing',
  'What time is it right now?',
];

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="h-6 gap-1 px-1.5 text-xs">
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

export function ChatView({
  msgs,
  streaming,
  error,
  draft,
  onDraftChange,
  onSend,
  onSuggestion,
  onOpenVoice,
  onOpenTools,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Keeps the latest turn in view while streaming, but never yanks the
  // scroll position away from someone who's scrolled up to read history.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const copy = (index: number, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 pt-[34px] pb-5">
          {msgs.map((m, i) => {
            const isLast = i === msgs.length - 1;
            if (m.role === 'user') {
              return (
                <div key={i} className="mb-[26px] flex justify-end">
                  <div className="max-w-[78%]">
                    <div
                      dir="auto"
                      className="rounded-tl-2xl rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl border bg-muted px-4 py-3 text-[14.5px] leading-relaxed text-foreground"
                    >
                      {m.text}
                    </div>
                    <div className="mt-1 flex justify-end">
                      <CopyButton copied={copiedIndex === i} onClick={() => copy(i, m.text)} />
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="mb-[30px] flex gap-3.5">
                <div className="mt-0.5 grid h-[26px] w-[26px] flex-none place-items-center rounded-full border border-ac-l">
                  <div className="h-1.5 w-1.5 rounded-full bg-ac-tx shadow-[0_0_9px_2px_rgba(95,216,255,0.7)]" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div dir="auto">
                    <MarkdownMessage text={m.text} />
                    {isLast && streaming && (
                      <span className="ml-0.5 animate-[jv-blink_1s_steps(1)_infinite] text-primary">▌</span>
                    )}
                  </div>
                  {m.text && !(isLast && streaming) && (
                    <CopyButton copied={copiedIndex === i} onClick={() => copy(i, m.text)} />
                  )}
                </div>
              </div>
            );
          })}

          {msgs.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((text) => (
                <Button
                  key={text}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => onSuggestion(text)}
                >
                  {text}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-none px-6 pb-[22px]">
        <div className="mx-auto max-w-[760px]">
          {error && <div className="mb-2 text-[12.5px] text-destructive">{error}</div>}
          <MessageComposer
            draft={draft}
            onDraftChange={onDraftChange}
            onSend={onSend}
            onOpenVoice={onOpenVoice}
            onOpenTools={onOpenTools}
          />
          <div className="mt-2.5 text-center text-[11px] text-muted-foreground">
            JARVIS can make mistakes. Verify important details.
          </div>
        </div>
      </div>
    </div>
  );
}
