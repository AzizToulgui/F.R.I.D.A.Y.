'use client';

import type { MouseEvent } from 'react';
import type { Route } from '@/types';

interface SearchPaletteProps {
  onClose: () => void;
  onNavigate: (route: Route) => void;
}

const resultBase = 'flex cursor-pointer items-center gap-[11px] rounded-[9px] p-2.5 hover:bg-line';
const resultActive = 'bg-ac-xs';

export function SearchPalette({ onClose, onNavigate }: SearchPaletteProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-40 flex items-start justify-center bg-[rgba(3,5,7,0.72)] pt-[12vh] backdrop-blur-[4px]"
    >
      <div
        onClick={stop}
        className="w-[min(620px,92vw)] animate-[jv-rise_0.16s_ease-out] overflow-hidden rounded-2xl border border-line2 bg-panel shadow-[0_30px_90px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
          <span className="text-ac">⌕</span>
          <input
            autoFocus
            aria-label="Search JARVIS"
            placeholder="Search conversations, memories, documents…"
            className="flex-1 border-0 bg-transparent text-[14.5px] text-tx outline-none"
          />
          <span className="rounded-[5px] border border-line2 px-1.5 py-0.5 font-mono text-[10px] text-tx4">ESC</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          <div className="px-2.5 pt-[9px] pb-[5px] font-mono text-[10px] tracking-[0.14em] text-tx4">
            CONVERSATIONS
          </div>
          <div onClick={() => onNavigate('chat')} className={`${resultBase} ${resultActive}`}>
            <span className="text-tx3">◫</span>
            <div className="flex-1 text-[13.5px] text-tx">Project architecture</div>
            <span className="text-[11.5px] text-tx4">today</span>
          </div>
          <div onClick={() => onNavigate('chat')} className={resultBase}>
            <span className="text-tx3">◫</span>
            <div className="flex-1 text-[13.5px] text-tx2">Voice assistant research</div>
            <span className="text-[11.5px] text-tx4">yesterday</span>
          </div>

          <div className="px-2.5 pt-[13px] pb-[5px] font-mono text-[10px] tracking-[0.14em] text-tx4">DOCUMENTS</div>
          <div onClick={() => onNavigate('knowledge')} className={resultBase}>
            <span className="text-tx3">▤</span>
            <div className="flex-1 text-[13.5px] text-tx2">Project architecture.pdf</div>
            <span className="text-[11.5px] text-tx4">p. 12</span>
          </div>

          <div className="px-2.5 pt-[13px] pb-[5px] font-mono text-[10px] tracking-[0.14em] text-tx4">MEMORIES</div>
          <div onClick={() => onNavigate('memory')} className={resultBase}>
            <span className="text-tx3">◈</span>
            <div className="flex-1 text-[13.5px] text-tx2">Prefers TypeScript with strict mode</div>
          </div>
        </div>
        <div className="flex gap-4 border-t border-line px-4 py-2.5 font-mono text-[10px] text-tx4">
          ↑↓ NAVIGATE<span>⏎ OPEN</span>
          <span>⌘⏎ NEW CHAT</span>
        </div>
      </div>
    </div>
  );
}
