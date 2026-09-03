'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
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
}

const pillClass =
  'flex h-8 cursor-pointer items-center gap-[7px] rounded-[10px] border border-line2 bg-transparent px-[11px] text-[12.5px] text-tx2 hover:border-line3 hover:text-tx';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.md,.markdown,.txt';

/**
 * The message input shared by ChatView and HomeView - kept as one component
 * so the "attach a document" and "tool count" wiring (both of which call the
 * real backend) live in exactly one place instead of two copies drifting apart.
 */
export function MessageComposer({ draft, onDraftChange, onSend, onOpenVoice, onOpenTools }: MessageComposerProps) {
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
      onSend();
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
      {uploadStatus && <div className="mb-2 text-[12.5px] text-tx3">{uploadStatus}</div>}
      <div className="overflow-hidden rounded-[18px] border border-line2 bg-panel2 shadow-[0_18px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(95,216,255,0.04)_inset]">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          dir="auto"
          aria-label="Message JARVIS"
          placeholder="Ask JARVIS anything…  ⏎ to send · ⇧⏎ for a new line"
          className="max-h-40 min-h-[52px] w-full resize-none border-0 bg-transparent px-[18px] pt-4 pb-1 text-[14.5px] leading-relaxed text-tx outline-none"
        />
        <div className="flex items-center gap-2 px-3 pt-2 pb-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => void onAttach(e)}
          />
          <button
            type="button"
            aria-label="Attach a document to your knowledge base"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] border border-line2 bg-transparent text-[15px] text-tx2 hover:border-line3 hover:text-tx"
          >
            ＋
          </button>
          <button type="button" onClick={onOpenTools} className={pillClass}>
            ⌘ Tools {toolCount !== null && <span className="font-mono text-[10px] text-ac">{toolCount}</span>}
          </button>
          <div className="ml-auto flex items-center gap-2">
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
    </div>
  );
}
