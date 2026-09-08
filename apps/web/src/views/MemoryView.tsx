'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
        <h1 className="m-0 text-[26px] font-normal text-foreground">Memory</h1>
        <p className="mt-2 max-w-[52ch] text-sm leading-[1.65] text-muted-foreground">
          FRIDAY keeps a small set of facts so future conversations start informed. Everything here is editable, and
          nothing is stored without appearing on this page.
        </p>
        <div className="my-[22px] mb-[18px] flex flex-wrap gap-2.5">
          <Input
            aria-label="Search memories"
            placeholder="Search memories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[38px] min-w-[220px] flex-1"
          />
          <Button
            type="button"
            variant="destructive"
            onClick={() => void clearAll()}
            disabled={memories.length === 0}
          >
            {confirmingClear ? 'Click again to confirm' : 'Clear all'}
          </Button>
        </div>

        {error && <div className="mb-3 text-[13px] text-destructive">{error}</div>}

        {loading ? (
          <div className="text-[13.5px] text-muted-foreground">Loading memories…</div>
        ) : filtered.length === 0 ? (
          <div className="text-[13.5px] text-muted-foreground">
            {memories.length === 0
              ? "Nothing remembered yet - it fills in as you talk to FRIDAY."
              : 'No memories match your search.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((m) => {
              const fresh = Date.now() - new Date(m.createdAt).getTime() < RECENT_MS;
              const isEditing = editingId === m.id;
              return (
                <Card
                  key={m.id}
                  size="sm"
                  className={`flex-row items-start gap-3.5 p-[15px_17px] hover:ring-primary/30 ${
                    fresh ? 'bg-primary/5 ring-primary/30' : ''
                  }`}
                >
                  <div className="flex-1">
                    {isEditing ? (
                      <Textarea
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        className="resize-none text-[14px] leading-[1.55]"
                      />
                    ) : (
                      <div className="text-[14px] leading-[1.55] text-foreground">{m.content}</div>
                    )}
                    <div className={`mt-1.5 font-mono text-[11px] ${fresh ? 'text-primary' : 'text-muted-foreground'}`}>
                      {fresh ? 'JUST REMEMBERED' : formatMeta(m)}
                    </div>
                  </div>
                  <div className="flex flex-none gap-1">
                    {isEditing ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => void saveEdit(m.id)}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(m)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void remove(m.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
