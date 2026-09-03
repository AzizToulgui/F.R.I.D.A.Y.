'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { ConversationSummary } from '@/lib/chat/useChat';
import type { Route } from '@/types';
import { useAuth } from '@/lib/auth/AuthProvider';

interface SidebarProps {
  open: boolean;
  route: Route;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSearch: () => void;
  onNavigate: (route: Route) => void;
  onOpenSettings: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
}

const iconBtn =
  'flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-tx4 hover:bg-line hover:text-tx2';

const navItemBase =
  'flex w-full cursor-pointer items-center gap-[9px] rounded-[9px] border-0 bg-transparent px-[11px] py-2 text-left text-[13.5px] text-tx3 hover:bg-line hover:text-tx';
const navItemActive = 'bg-ac-s text-tx shadow-[inset_1px_0_0_var(--ac)]';

const historyItemBase =
  'group flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-[7px] text-left text-[13px] text-tx2 hover:bg-line hover:text-tx';
const historyItemActive = 'bg-ac-xs text-tx shadow-[inset_1px_0_0_var(--ac)]';
const historyActionBtn =
  'hidden flex-none cursor-pointer items-center justify-center rounded-md p-1 text-tx4 hover:bg-line2 hover:text-tx group-hover:flex';

type DateGroup = 'Today' | 'Yesterday' | 'Earlier';
const DATE_GROUPS: DateGroup[] = ['Today', 'Yesterday', 'Earlier'];

function dateGroup(iso: string): DateGroup {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Earlier';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

interface DeleteConfirmDialogProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ title, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,5,7,0.72)] backdrop-blur-[4px]"
    >
      <div
        onClick={stop}
        className="w-[min(380px,92vw)] animate-[jv-rise_0.16s_ease-out] rounded-2xl border border-line2 bg-panel p-5 shadow-[0_30px_90px_rgba(0,0,0,0.7)]"
      >
        <div className="text-[14.5px] font-medium text-tx">Delete conversation?</div>
        <div className="mt-1.5 text-[13px] text-tx3">
          <span className="text-tx2">&ldquo;{title}&rdquo;</span> will be permanently deleted. This can&rsquo;t be
          undone.
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[9px] border border-line2 bg-transparent px-3.5 py-[7px] text-[13px] text-tx2 hover:bg-line"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer rounded-[9px] border border-danger-line bg-danger-bg px-3.5 py-[7px] text-[13px] text-danger hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  route,
  conversations,
  activeConversationId,
  onToggle,
  onNewChat,
  onOpenSearch,
  onNavigate,
  onOpenSettings,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);

  const startEditing = (c: ConversationSummary) => {
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const commitEdit = () => {
    if (editingId) onRenameConversation(editingId, editingTitle);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const confirmDelete = () => {
    if (pendingDelete) onDeleteConversation(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <>
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
          {conversations.length === 0 ? (
            <div className="px-2.5 py-2.5 text-xs text-tx5">No conversations yet</div>
          ) : (
            DATE_GROUPS.map((group) => {
              const items = conversations.filter((c) => dateGroup(c.updatedAt) === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="flex items-center gap-1.5 pt-3.5 pr-1 pb-1.5 pl-1 font-mono text-[10px] tracking-[0.14em] text-tx4 first:pt-2">
                    {group.toUpperCase()}
                  </div>
                  {items.map((c) =>
                    editingId === c.id ? (
                      <div key={c.id} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[5px]">
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit();
                            else if (e.key === 'Escape') cancelEdit();
                          }}
                          onBlur={commitEdit}
                          className="w-full min-w-0 flex-1 rounded-md border border-ac-m bg-panel px-1.5 py-1 text-[13px] text-tx outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectConversation(c.id)}
                        className={`${historyItemBase} ${
                          route === 'chat' && activeConversationId === c.id ? historyItemActive : ''
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{c.title}</span>
                        <span
                          role="button"
                          aria-label={`Rename "${c.title}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(c);
                          }}
                          className={historyActionBtn}
                        >
                          <PencilIcon />
                        </span>
                        <span
                          role="button"
                          aria-label={`Delete "${c.title}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(c);
                          }}
                          className={`${historyActionBtn} hover:text-danger`}
                        >
                          <TrashIcon />
                        </span>
                      </button>
                    ),
                  )}
                </div>
              );
            })
          )}
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
      {pendingDelete && (
        <DeleteConfirmDialog
          title={pendingDelete.title}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
