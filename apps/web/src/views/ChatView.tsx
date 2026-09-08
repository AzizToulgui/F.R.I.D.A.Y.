'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { cn } from 'cn';
import {
  CheckIcon,
  Code2Icon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  Share2Icon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Volume2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { MessageComposer } from '@/components/MessageComposer';
import { applyTtsSettings, loadTtsSettings } from '@/lib/tts/ttsSettings';
import type { ChatMessage } from '@/types';

interface ChatViewProps {
  msgs: ChatMessage[];
  streaming: boolean;
  error?: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  /** Sends arbitrary text as a new turn immediately, independent of the composer's draft - used by "edit and resend". */
  onSendMessage: (text: string) => void;
  onSuggestion: (text: string) => void;
  onOpenVoice: () => void;
  onOpenTools: () => void;
}

const SUGGESTIONS = [
  'What can you remember about me?',
  'Search my documents for anything about pricing',
  'What time is it right now?',
];

/** One icon-only action button with a tooltip label, for a message's action row. */
function MessageActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={onClick} aria-label={label} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface MessageAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/** A message's action row - shows at most `maxVisible` icon buttons, tucking the rest behind a "More" menu so the row never gets crowded. */
function MessageActionBar({ actions, maxVisible = 4 }: { actions: MessageAction[]; maxVisible?: number }) {
  const visible = actions.slice(0, maxVisible);
  const overflow = actions.slice(maxVisible);

  return (
    <div className="flex items-center gap-0.5">
      {visible.map((action) => (
        <MessageActionButton key={action.key} label={action.label} disabled={action.disabled} onClick={action.onClick}>
          {action.icon}
        </MessageActionButton>
      ))}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon" aria-label="More actions" />}
          >
            <MoreHorizontalIcon className="size-4.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.map((action) => (
              <DropdownMenuItem key={action.key} disabled={action.disabled} onClick={action.onClick}>
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function downloadAsTextFile(text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'message.txt';
  a.click();
  URL.revokeObjectURL(url);
}

/** "Choose how to share" modal for a single message's text (prompt or response) - all client-side, no backend sharing endpoint exists. */
function ShareDialog({
  open,
  text,
  onClose,
}: {
  open: boolean;
  text: string;
  onClose: () => void;
}) {
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Checked post-mount (not during render) to avoid an SSR/client hydration
  // mismatch - `navigator.share` support varies by browser/OS. Deferred via
  // queueMicrotask to satisfy the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    queueMicrotask(() => {
      setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    });
  }, []);

  const shareNative = async () => {
    try {
      await navigator.share({ text });
      onClose();
    } catch {
      // User cancelled the native share sheet, or it failed silently - no toast needed either way.
    }
  };

  const copyText = () => {
    void navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
    onClose();
  };

  const download = () => {
    downloadAsTextFile(text);
    onClose();
  };

  const emailHref = `mailto:?subject=${encodeURIComponent('A message from JARVIS')}&body=${encodeURIComponent(text)}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this message</DialogTitle>
          <DialogDescription>Choose how you&rsquo;d like to share it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {canNativeShare && (
            <Button type="button" variant="outline" className="justify-start" onClick={() => void shareNative()}>
              <SendIcon /> Share via…
            </Button>
          )}
          <Button type="button" variant="outline" className="justify-start" onClick={copyText}>
            <CopyIcon /> Copy text
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            nativeButton={false}
            render={<a href={emailHref} onClick={onClose} />}
          >
            <MailIcon /> Email
          </Button>
          <Button type="button" variant="outline" className="justify-start" onClick={download}>
            <DownloadIcon /> Download as .txt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shows a response's raw markdown source (pre-rendering), so the user can see exactly what the model returned. */
function ViewSourceDialog({ open, text, onClose }: { open: boolean; text: string; onClose: () => void }) {
  const copy = () => {
    void navigator.clipboard.writeText(text);
    toast.success('Source copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Response source</DialogTitle>
          <DialogDescription>The raw markdown behind this response.</DialogDescription>
        </DialogHeader>
        <pre className="max-h-[50vh] overflow-auto rounded-lg border bg-muted p-3 text-xs whitespace-pre-wrap text-foreground">
          {text}
        </pre>
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            <CopyIcon /> Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Strips common markdown syntax so speech synthesis doesn't read literal `**`/`#`/link-brackets aloud. */
function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/-{3,}/g, '')
    .trim();
}

export function ChatView({
  msgs,
  streaming,
  error,
  draft,
  onDraftChange,
  onSend,
  onSendMessage,
  onSuggestion,
  onOpenVoice,
  onOpenTools,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [shareText, setShareText] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<number, 'up' | 'down'>>({});
  const [speech, setSpeech] = useState<{ index: number; status: 'loading' | 'speaking' } | null>(null);
  // Guards stale onstart/onend callbacks from a previous utterance after
  // it's been superseded by a newer speak() call or an explicit stop.
  const speechIndexRef = useRef<number | null>(null);

  // Stops any in-progress speech synthesis when the view unmounts (e.g.
  // navigating away mid-readout) so audio doesn't keep playing silently.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

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

  const react = (index: number, value: 'up' | 'down') => {
    setReactions((prev) => {
      const next = { ...prev };
      if (next[index] === value) {
        delete next[index];
      } else {
        next[index] = value;
        toast.success(value === 'up' ? 'Thanks for the feedback!' : 'Thanks - noted for improvement.');
      }
      return next;
    });
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    speechIndexRef.current = null;
    setSpeech(null);
  };

  const toggleSpeak = (index: number, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('Voice playback is not supported in this browser.');
      return;
    }
    if (speechIndexRef.current === index) {
      stopSpeaking();
      return;
    }
    window.speechSynthesis.cancel();
    speechIndexRef.current = index;
    setSpeech({ index, status: 'loading' });

    const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
    applyTtsSettings(utterance, loadTtsSettings());
    utterance.onstart = () => {
      if (speechIndexRef.current === index) setSpeech({ index, status: 'speaking' });
    };
    const clear = () => {
      if (speechIndexRef.current === index) {
        speechIndexRef.current = null;
        setSpeech(null);
      }
    };
    utterance.onend = clear;
    utterance.onerror = clear;
    window.speechSynthesis.speak(utterance);
  };

  const startEditing = (index: number, text: string) => {
    setEditingIndex(index);
    setEditingText(text);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  const submitEdit = () => {
    const trimmed = editingText.trim();
    cancelEditing();
    if (trimmed) onSendMessage(trimmed);
  };

  const onEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 pt-[34px] pb-5">
          {msgs.map((m, i) => {
            const isLast = i === msgs.length - 1;
            if (m.role === 'user') {
              const isEditing = editingIndex === i;
              return (
                <div key={i} className="group mb-[26px] flex justify-end">
                  <div className="max-w-[78%] min-w-[220px]">
                    {isEditing ? (
                      <Textarea
                        autoFocus
                        dir="auto"
                        rows={2}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={onEditKeyDown}
                        onBlur={cancelEditing}
                        className="rounded-tl-2xl rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl border bg-muted px-4 py-3 text-[14.5px] leading-relaxed text-foreground shadow-none"
                      />
                    ) : (
                      <div
                        dir="auto"
                        className="rounded-tl-2xl rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl border bg-muted px-4 py-3 text-[14.5px] leading-relaxed text-foreground"
                      >
                        {m.text}
                      </div>
                    )}
                    {!isEditing && (
                      <div className="mt-1 flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <MessageActionBar
                          actions={[
                            {
                              key: 'copy',
                              label: copiedIndex === i ? 'Copied' : 'Copy',
                              icon: copiedIndex === i ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />,
                              onClick: () => copy(i, m.text),
                            },
                            {
                              key: 'share',
                              label: 'Share',
                              icon: <Share2Icon className="size-4.5" />,
                              onClick: () => setShareText(m.text),
                            },
                            {
                              key: 'edit',
                              label: 'Edit',
                              icon: <PencilIcon className="size-4.5" />,
                              disabled: streaming,
                              onClick: () => startEditing(i, m.text),
                            },
                          ]}
                        />
                      </div>
                    )}
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
                    {m.text && <MarkdownMessage text={m.text} />}
                    {isLast && streaming && !m.errorMessage && (
                      <span className="ml-0.5 animate-[jv-blink_1s_steps(1)_infinite] text-primary">▌</span>
                    )}
                    {m.errorMessage && (
                      <div className={`text-[14.5px] leading-relaxed text-destructive ${m.text ? 'mt-2' : ''}`}>
                        {m.errorMessage}
                      </div>
                    )}
                  </div>
                  {m.text && !(isLast && streaming) && !m.errorMessage && (
                    <MessageActionBar
                      actions={[
                        {
                          key: 'copy',
                          label: copiedIndex === i ? 'Copied' : 'Copy',
                          icon: copiedIndex === i ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />,
                          onClick: () => copy(i, m.text),
                        },
                        {
                          key: 'up',
                          label: 'Good response',
                          icon: (
                            <ThumbsUpIcon className={cn('size-4.5', reactions[i] === 'up' && 'fill-current text-primary')} />
                          ),
                          onClick: () => react(i, 'up'),
                        },
                        {
                          key: 'down',
                          label: 'Bad response',
                          icon: (
                            <ThumbsDownIcon
                              className={cn('size-4.5', reactions[i] === 'down' && 'fill-current text-destructive')}
                            />
                          ),
                          onClick: () => react(i, 'down'),
                        },
                        {
                          key: 'read-aloud',
                          label:
                            speech?.index === i
                              ? speech.status === 'loading'
                                ? 'Loading…'
                                : 'Stop reading'
                              : 'Read aloud',
                          icon:
                            speech?.index === i && speech.status === 'loading' ? (
                              <Loader2Icon className="size-4.5 animate-spin" />
                            ) : speech?.index === i && speech.status === 'speaking' ? (
                              <SquareIcon className="size-4.5" />
                            ) : (
                              <Volume2Icon className="size-4.5" />
                            ),
                          onClick: () => toggleSpeak(i, m.text),
                        },
                        {
                          key: 'share',
                          label: 'Share',
                          icon: <Share2Icon className="size-4.5" />,
                          onClick: () => setShareText(m.text),
                        },
                        {
                          key: 'view-source',
                          label: 'View source',
                          icon: <Code2Icon className="size-4.5" />,
                          onClick: () => setSourceText(m.text),
                        },
                      ]}
                    />
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
            streaming={streaming}
          />
          <div className="mt-2.5 text-center text-[11px] text-muted-foreground">
            JARVIS can make mistakes. Verify important details.
          </div>
        </div>
      </div>

      <ShareDialog open={shareText !== null} text={shareText ?? ''} onClose={() => setShareText(null)} />
      <ViewSourceDialog open={sourceText !== null} text={sourceText ?? ''} onClose={() => setSourceText(null)} />
    </div>
  );
}
