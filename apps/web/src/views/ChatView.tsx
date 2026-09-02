'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
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
}

const pillClass =
  'flex h-8 cursor-pointer items-center gap-[7px] rounded-[10px] border border-line2 bg-transparent px-[11px] text-[12.5px] text-tx2 hover:border-line3 hover:text-tx';

export function ChatView({
  msgs,
  streaming,
  error,
  draft,
  onDraftChange,
  onSend,
  onSuggestion,
  onOpenVoice,
}: ChatViewProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => onDraftChange(e.target.value);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 pt-[34px] pb-5">
          {/* seed example turn */}
          <div className="mb-[26px] flex justify-end">
            <div className="max-w-[78%]">
              <div className="rounded-tl-2xl rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl border border-line bg-bubble px-4 py-3 text-[14.5px] leading-relaxed text-tx">
                Look at my architecture doc and tell me if the voice pipeline can handle interruptions. Then check
                what&rsquo;s on my calendar tomorrow.
              </div>
              <div className="mt-1.5 flex justify-end gap-2.5 text-[11px] text-tx4 hover:text-tx3">
                <span className="font-mono">09:41</span>
                <span className="cursor-pointer">Edit</span>
                <span className="cursor-pointer">Copy</span>
              </div>
            </div>
          </div>

          <div className="mb-[30px] flex gap-3.5">
            <div className="mt-0.5 grid h-[26px] w-[26px] flex-none place-items-center rounded-full border border-ac-l">
              <div className="h-1.5 w-1.5 rounded-full bg-ac-tx shadow-[0_0_9px_2px_rgba(95,216,255,0.7)]" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              <div className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="flex items-center gap-2.5 px-3.5 py-[11px]">
                  <span className="text-ac">✓</span>
                  <span className="text-[13px] text-tx2">Calendar</span>
                  <span className="text-[12.5px] text-tx3">3 events tomorrow · 10:00, 13:30, 17:00</span>
                  <span className="ml-auto cursor-pointer text-xs text-tx3">Details</span>
                </div>
              </div>

              <p className="text-[15px] leading-[1.72] text-tx2">
                Yes — with one change. Your pipeline streams TTS in 200 ms chunks but only checks the barge-in flag
                between chunks, so an interruption can land up to 200 ms late. Move the check into the audio
                callback and cancel the queue immediately:
              </p>

              <div className="overflow-hidden rounded-xl border border-line bg-bg2">
                <div className="flex items-center border-b border-line px-3 py-2 font-mono text-[10.5px] tracking-[0.1em] text-tx4">
                  TYPESCRIPT<span className="ml-auto cursor-pointer text-tx3">copy</span>
                </div>
                <pre className="m-0 overflow-x-auto p-3.5 font-mono text-[12.5px] leading-[1.75] text-tx2">
                  <span className="text-ac">onAudioFrame</span>
                  {'((frame) => {\n  '}
                  <span className="text-tx3">{'// barge-in wins over playback, always'}</span>
                  {'\n  '}
                  <span className="text-ac">if</span>
                  {' (vad.isSpeech(frame)) {\n    tts.'}
                  <span className="text-ac-tx">cancelAll</span>
                  {'();\n    session.'}
                  <span className="text-ac-tx">setState</span>
                  {"('"}
                  <span className="text-ok">listening</span>
                  {"');\n  }\n});"}
                </pre>
              </div>

              <p className="text-[15px] leading-[1.72] text-tx2">Two follow-ups worth doing:</p>
              <ul className="list-disc pl-5 text-[15px] leading-[1.8] text-tx2">
                <li>Keep a 120 ms echo-suppression window so JARVIS&rsquo;s own voice doesn&rsquo;t trigger the VAD.</li>
                <li>Fade playback out over 60 ms instead of cutting — an instant cut reads as a bug.</li>
              </ul>

              <p className="text-[15px] leading-[1.72] text-tx2">
                Tomorrow you have design review at 10:00, a 1:1 at 13:30, and the latency retro at 17:00 — the retro
                is the natural place to land the barge-in fix.
              </p>

              <div>
                <div className="mb-2 font-mono text-[10px] tracking-[0.14em] text-tx4">SOURCES · 2</div>
                <div className="flex flex-wrap gap-2.5">
                  <div className="min-w-[220px] flex-1 cursor-pointer rounded-[11px] border border-line bg-panel px-[13px] py-[11px] hover:border-ac-m">
                    <div className="text-[13px] text-tx2">Project architecture.pdf</div>
                    <div className="mt-[3px] font-mono text-[11.5px] text-tx4">PAGE 12 · CHUNK 84</div>
                  </div>
                  <div className="min-w-[220px] flex-1 cursor-pointer rounded-[11px] border border-line bg-panel px-[13px] py-[11px] hover:border-ac-m">
                    <div className="text-[13px] text-tx2">voice-pipeline.md</div>
                    <div className="mt-[3px] font-mono text-[11.5px] text-tx4">SECTION 4 · CHUNK 12</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5 pt-0.5 text-xs text-tx4 opacity-75 hover:text-tx2 hover:opacity-100">
                <span className="cursor-pointer">Copy</span>
                <span className="cursor-pointer">Regenerate</span>
                <span className="cursor-pointer">Continue</span>
                <span className="cursor-pointer">Read aloud</span>
                <span className="cursor-pointer">Save</span>
                <span className="cursor-pointer">↑</span>
                <span className="cursor-pointer">↓</span>
              </div>
            </div>
          </div>

          {/* live conversation */}
          {msgs.map((m, i) => {
            const isLast = i === msgs.length - 1;
            if (m.role === 'user') {
              return (
                <div key={i} className="mb-[26px] flex justify-end">
                  <div className="max-w-[78%]">
                    <div
                      dir="auto"
                      className="rounded-tl-2xl rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl border border-line bg-bubble px-4 py-3 text-[14.5px] leading-relaxed text-tx"
                    >
                      {m.text}
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
                <div className="flex min-w-0 flex-1 flex-col gap-3.5">
                  <p dir="auto" className="text-[15px] leading-[1.72] text-tx2">
                    {m.text}
                    {isLast && streaming && (
                      <span className="ml-0.5 animate-[jv-blink_1s_steps(1)_infinite] text-ac">▌</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {msgs.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-full border border-line2 bg-transparent px-[13px] py-2 text-[12.5px] text-tx2 hover:border-ac-m hover:text-tx"
                onClick={() => onSuggestion('Plan my day around the retro')}
              >
                Plan my day around the retro
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-line2 bg-transparent px-[13px] py-2 text-[12.5px] text-tx2 hover:border-ac-m hover:text-tx"
                onClick={() => onSuggestion('Draft the retro agenda')}
              >
                Draft the retro agenda
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-line2 bg-transparent px-[13px] py-2 text-[12.5px] text-tx2 hover:border-ac-m hover:text-tx"
                onClick={() => onSuggestion('Search my knowledge for VAD notes')}
              >
                Search my knowledge for VAD notes
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-none px-6 pb-[22px]">
        <div className="mx-auto max-w-[760px]">
          {error && <div className="mb-2 text-[12.5px] text-danger">{error}</div>}
          <div className="overflow-hidden rounded-[18px] border border-line2 bg-panel2 shadow-[0_18px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(95,216,255,0.04)_inset]">
            <textarea
              value={draft}
              onChange={onChange}
              onKeyDown={onKeyDown}
              rows={1}
              dir="auto"
              aria-label="Message JARVIS"
              placeholder="Ask JARVIS anything…  ⏎ to send · ⇧⏎ for a new line"
              className="max-h-40 min-h-[52px] w-full border-0 bg-transparent px-[18px] pt-4 pb-1 text-[14.5px] leading-relaxed text-tx outline-none"
            />
            <div className="flex items-center gap-2 px-3 pt-2 pb-2.5">
              <button
                type="button"
                aria-label="Attach"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] border border-line2 bg-transparent text-[15px] text-tx2 hover:border-line3 hover:text-tx"
              >
                ＋
              </button>
              <button type="button" className={pillClass}>
                ⌘ Tools <span className="font-mono text-[10px] text-ac">3</span>
              </button>
              <button type="button" className={pillClass}>
                Reasoning ▾
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
          <div className="mt-2.5 text-center text-[11px] text-tx5">JARVIS can make mistakes. Verify important details.</div>
        </div>
      </div>
    </div>
  );
}
