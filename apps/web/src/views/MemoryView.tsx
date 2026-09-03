'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

interface Memory {
  id: string;
  content: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const RECENT_MS = 10 * 60 * 1000;

function formatMeta(memory: Memory): string {
  const created = new Date(memory.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  if (!memory.lastUsedAt) return `ADDED ${created.toUpperCase()}`;
  const used = new Date(memory.lastUsedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  return `ADDED ${created.toUpperCase()} · LAST USED ${used.toUpperCase()}`;
}

export function MemoryView() {
  const { authFetch } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch<Memory[]>('/memories');
      setMemories(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load memories.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter((m) => m.content.toLowerCase().includes(q));
  }, [memories, query]);

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setDraft(memory.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const saveEdit = async (id: string) => {
    const content = draft.trim();
    if (!content) return;
    try {
      const updated = await authFetch<Memory>(`/memories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that edit.');
    }
  };

  const remove = async (id: string) => {
    const previous = memories;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await authFetch(`/memories/${id}`, { method: 'DELETE' });
    } catch (e) {
      setMemories(previous);
      setError(e instanceof Error ? e.message : 'Could not delete that memory.');
    }
  };

  const clearAll = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    setConfirmingClear(false);
    const previous = memories;
    setMemories([]);
    try {
      await authFetch('/memories', { method: 'DELETE' });
    } catch (e) {
      setMemories(previous);
      setError(e instanceof Error ? e.message : 'Could not clear memories.');
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-6 pt-[38px] pb-[60px]">
        <h1 className="m-0 text-[26px] font-normal text-tx">Memory</h1>
        <p className="mt-2 max-w-[52ch] text-sm leading-[1.65] text-tx3">
          JARVIS keeps a small set of facts so future conversations start informed. Everything here is editable, and
          nothing is stored without appearing on this page.
        </p>
        <div className="my-[22px] mb-[18px] flex flex-wrap gap-2.5">
          <input
            aria-label="Search memories"
            placeholder="Search memories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[38px] min-w-[220px] flex-1 rounded-[10px] border border-line2 bg-panel px-[13px] text-[13.5px] text-tx outline-none focus:border-ac-m"
          />
          <button
            type="button"
            onClick={() => void clearAll()}
            disabled={memories.length === 0}
            className={`h-[38px] cursor-pointer rounded-[10px] border px-3.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${
              confirmingClear
                ? 'border-danger bg-danger-bg text-danger'
                : 'border-danger-line bg-transparent text-danger hover:bg-danger-bg'
            }`}
          >
            {confirmingClear ? 'Click again to confirm' : 'Clear all'}
          </button>
        </div>

        {error && <div className="mb-3 text-[13px] text-danger">{error}</div>}

        {loading ? (
          <div className="text-[13.5px] text-tx3">Loading memories…</div>
        ) : filtered.length === 0 ? (
          <div className="text-[13.5px] text-tx3">
            {memories.length === 0
              ? "Nothing remembered yet - it fills in as you talk to JARVIS."
              : 'No memories match your search.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((m) => {
              const fresh = Date.now() - new Date(m.createdAt).getTime() < RECENT_MS;
              const isEditing = editingId === m.id;
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3.5 rounded-[13px] border p-[15px_17px] hover:border-ac-m ${
                    fresh ? 'border-ac-m bg-ac-xs' : 'border-line bg-panel'
                  }`}
                >
                  <div className="flex-1">
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-md border border-line2 bg-transparent p-2 text-[14px] leading-[1.55] text-tx outline-none focus:border-ac-m"
                      />
                    ) : (
                      <div className="text-[14px] leading-[1.55] text-tx">{m.content}</div>
                    )}
                    <div className={`mt-1.5 font-mono text-[11px] ${fresh ? 'text-ac-tx' : 'text-tx4'}`}>
                      {fresh ? 'JUST REMEMBERED' : formatMeta(m)}
                    </div>
                  </div>
                  <div className="flex flex-none gap-3 text-[12.5px] text-tx3">
                    {isEditing ? (
                      <>
                        <span className="cursor-pointer" onClick={() => void saveEdit(m.id)}>
                          Save
                        </span>
                        <span className="cursor-pointer" onClick={cancelEdit}>
                          Cancel
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="cursor-pointer" onClick={() => startEdit(m)}>
                          Edit
                        </span>
                        <span className="cursor-pointer text-[#c98d8d]" onClick={() => void remove(m.id)}>
                          Delete
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
