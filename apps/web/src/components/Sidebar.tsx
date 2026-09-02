'use client';

import type { Route } from '@/types';
import { useAuth } from '@/lib/auth/AuthProvider';

interface SidebarProps {
  open: boolean;
  route: Route;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSearch: () => void;
  onNavigate: (route: Route) => void;
  onOpenSettings: () => void;
}

const HISTORY_TODAY = ['Project architecture', 'Morning planning', 'Learn TypeScript'];
const HISTORY_YESTERDAY = ['Database design', 'Flight to Lisbon'];

const iconBtn =
  'flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-tx4 hover:bg-line hover:text-tx2';

const navItemBase =
  'flex w-full cursor-pointer items-center gap-[9px] rounded-[9px] border-0 bg-transparent px-[11px] py-2 text-left text-[13.5px] text-tx3 hover:bg-line hover:text-tx';
const navItemActive = 'bg-ac-s text-tx shadow-[inset_1px_0_0_var(--ac)]';

const historyItemBase =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-[7px] text-left text-[13px] text-tx2 hover:bg-line hover:text-tx';
const historyItemActive = 'bg-ac-xs text-tx shadow-[inset_1px_0_0_var(--ac)]';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Sidebar({ open, route, onToggle, onNewChat, onOpenSearch, onNavigate, onOpenSettings }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside
      className={`flex flex-none flex-col overflow-hidden border-r border-line bg-bg2 transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
        open ? 'w-64' : 'w-0'
      }`}
    >
      <div className="flex h-14 flex-none items-center gap-2.5 border-b border-line px-3.5">
        <div className="relative grid h-[26px] w-[26px] flex-none place-items-center rounded-full border border-ac-l shadow-[0_0_14px_rgba(95,216,255,0.25)_inset]">
          <div className="h-3.5 w-3.5 rounded-full border border-ac-m" />
          <div className="absolute h-[5px] w-[5px] animate-[jv-breathe_4s_ease-in-out_infinite] rounded-full bg-ac-tx shadow-[0_0_10px_2px_rgba(95,216,255,0.8)]" />
        </div>
        <span className="whitespace-nowrap text-[13px] font-medium tracking-[0.22em] text-tx2">JARVIS</span>
        <button type="button" onClick={onToggle} aria-label="Collapse sidebar" className={`${iconBtn} ml-auto text-sm`}>
          ‹
        </button>
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] border border-ac-m bg-ac-xs px-[11px] py-[9px] text-left text-[13.5px] text-ac-tx hover:border-ac-l hover:bg-ac-s"
        >
          <span className="text-[15px] leading-none">+</span> New conversation
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] border border-transparent bg-transparent px-[11px] py-[9px] text-left text-[13.5px] text-tx3 hover:bg-line hover:text-tx"
        >
          <span className="opacity-70">⌕</span> Search
          <span className="ml-auto rounded-[5px] border border-line2 px-[5px] py-px font-mono text-[10px] text-tx4">⌘K</span>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 pb-2.5">
        <button
          type="button"
          onClick={() => onNavigate('memory')}
          className={`${navItemBase} ${route === 'memory' ? navItemActive : ''}`}
        >
          <span className="opacity-65">◈</span> Memory
          <span className="ml-auto font-mono text-[10px] text-tx4">24</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('knowledge')}
          className={`${navItemBase} ${route === 'knowledge' ? navItemActive : ''}`}
        >
          <span className="opacity-65">▤</span> Knowledge
          <span className="ml-auto font-mono text-[10px] text-tx4">6</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('tools')}
          className={`${navItemBase} ${route === 'tools' ? navItemActive : ''}`}
        >
          <span className="opacity-65">⌘</span> Tools
          <span className="ml-auto h-[5px] w-[5px] rounded-full bg-ac shadow-[0_0_8px_var(--ac)]" />
        </button>
      </nav>

      <div className="flex-1 overflow-y-auto px-3 pt-1.5 pb-3">
        <div className="flex items-center gap-1.5 pt-2 pr-1 pb-1.5 pl-1 font-mono text-[10px] tracking-[0.14em] text-tx4">
          PINNED
        </div>
        <button type="button" onClick={() => onNavigate('chat')} className={historyItemBase}>
          <span className="text-[10px] text-ac">★</span> Voice assistant research
        </button>

        <div className="flex items-center gap-1.5 pt-3.5 pr-1 pb-1.5 pl-1 font-mono text-[10px] tracking-[0.14em] text-tx4">
          TODAY
        </div>
        {HISTORY_TODAY.map((title, i) => (
          <button
            key={title}
            type="button"
            onClick={() => onNavigate('chat')}
            className={`${historyItemBase} ${i === 0 && route === 'chat' ? historyItemActive : ''}`}
          >
            {title}
          </button>
        ))}

        <div className="flex items-center gap-1.5 pt-3.5 pr-1 pb-1.5 pl-1 font-mono text-[10px] tracking-[0.14em] text-tx4">
          YESTERDAY
        </div>
        {HISTORY_YESTERDAY.map((title) => (
          <button key={title} type="button" onClick={() => onNavigate('chat')} className={historyItemBase}>
            {title}
          </button>
        ))}
        <div className="px-2.5 py-2.5 text-xs text-tx5">Archive · 128 conversations</div>
      </div>

      <div className="flex flex-none items-center gap-2.5 border-t border-line px-3 py-2.5">
        <div className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-line2 bg-[linear-gradient(160deg,var(--bubble),var(--panel))] font-mono text-[11px] text-ac-tx">
          {initials(user?.displayName ?? user?.email ?? '?')}
        </div>
        <div className="min-w-0">
          <div className="overflow-hidden text-[12.5px] text-ellipsis whitespace-nowrap text-tx2">
            {user?.displayName ?? user?.email ?? 'Signed out'}
          </div>
          <div className="font-mono text-[10.5px] text-tx4">GEMINI 2.5</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => void logout()} aria-label="Log out" className={iconBtn}>
            ⏻
          </button>
          <button type="button" onClick={onOpenSettings} aria-label="Settings" className={iconBtn}>
            ⚙
          </button>
        </div>
      </div>
    </aside>
  );
}
