'use client';

import type { Theme } from '@/types';

interface TopBarProps {
  title: string;
  theme: Theme;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenVoice: () => void;
}

export function TopBar({ title, theme, onToggleSidebar, onToggleTheme, onOpenVoice }: TopBarProps) {
  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b border-line px-5 backdrop-blur-[8px]">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-tx4 hover:bg-line hover:text-tx2"
      >
        ☰
      </button>
      <div className="text-sm text-tx2">{title}</div>
      <div className="flex items-center gap-1.5 rounded-full border border-line2 px-2.5 py-[3px] font-mono text-[10px] tracking-[0.08em] text-tx3">
        <span className="h-[5px] w-[5px] rounded-full bg-ac shadow-[0_0_8px_var(--ac)]" /> ONLINE
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle dark and light mode"
          className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[9px] border border-line2 bg-transparent text-[13px] text-tx2 hover:border-line3 hover:text-tx"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
        <button
          type="button"
          className="h-[30px] cursor-pointer rounded-[9px] border border-line2 bg-transparent px-3 text-[12.5px] text-tx2 hover:border-line3 hover:text-tx"
        >
          Share
        </button>
        <button
          type="button"
          onClick={onOpenVoice}
          className="flex h-[30px] cursor-pointer items-center gap-[7px] rounded-[9px] border border-ac-m bg-ac-xs px-[13px] text-[12.5px] text-ac-tx hover:bg-ac-s"
        >
          ◉ Voice mode
        </button>
      </div>
    </header>
  );
}
