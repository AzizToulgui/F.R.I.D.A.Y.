'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { CommandIcon, Loader2Icon, MicIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/AuthProvider';

interface ToolInfo {
  name: string;
}

interface UploadedDocument {
  title: string;
}

interface MessageComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onOpenVoice: () => void;
  onOpenTools: () => void;
  /** True while a reply is being generated - disables Send and shows a spinner instead of blocking silently. */
  streaming?: boolean;
}

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.md,.markdown,.txt';

/**
 * The message input shared by ChatView and HomeView - kept as one component
 * so the "attach a document" and "tool count" wiring (both of which call the
 * real backend) live in exactly one place instead of two copies drifting apart.
 */
export function MessageComposer({
  draft,
  onDraftChange,
  onSend,
  onOpenVoice,
  onOpenTools,
  streaming = false,
}: MessageComposerProps) {
  const { authFetch } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    authFetch<ToolInfo[]>('/tools')
      .then((tools) => setToolCount(tools.length))
      .catch(() => setToolCount(null));
  }, [authFetch]);

  // Grows with content up to the CSS max-height (then the textarea scrolls
  // internally) - re-measured on every keystroke since content height isn't
  // something CSS alone can track for a <textarea>.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) onSend();
    }
  };

  const onAttach = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadStatus(`Uploading ${file.name}…`);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const doc = await authFetch<UploadedDocument>('/documents', { method: 'POST', body: formData });
      setUploadStatus(`Added "${doc.title}" to your knowledge base`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : `Could not upload "${file.name}".`);
    } finally {
      setTimeout(() => setUploadStatus(null), 4000);
    }
  };

  return (
    <div>
      {uploadStatus && <div className="mb-2 text-[12.5px] text-muted-foreground">{uploadStatus}</div>}
      <div className="overflow-hidden rounded-[18px] border bg-card shadow-lg">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          dir="auto"
          aria-label="Message FRIDAY"
          placeholder="Ask FRIDAY anything…  ⏎ to send · ⇧⏎ for a new line"
          className="max-h-40 min-h-[52px] resize-none rounded-none border-0 bg-transparent px-[18px] pt-4 pb-1 text-[14.5px] leading-relaxed shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-2 px-3 pt-2 pb-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => void onAttach(e)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Attach a document to your knowledge base"
            onClick={() => fileInputRef.current?.click()}
          >
            <PlusIcon />
          </Button>
          <Button type="button" variant="outline" onClick={onOpenTools}>
            <CommandIcon /> Tools {toolCount !== null && <span className="font-mono text-[10px] text-primary">{toolCount}</span>}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onOpenVoice}
              aria-label="Voice mode"
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            >
              <MicIcon />
            </Button>
            <Button type="button" onClick={onSend} disabled={streaming} aria-busy={streaming}>
              {streaming ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                'Send'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
