'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/AuthProvider';

interface Note {
  id: string;
  title: string | null;
  content: string;
}

export function NotesView() {
  const { authFetch } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await authFetch<Note[]>('/notes');
        if (!cancelled) setNotes(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load notes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[860px] px-6 pt-[38px] pb-[60px]">
        <h1 className="m-0 text-[26px] font-normal text-foreground">Notes</h1>
        <p className="mt-2 mb-[22px] max-w-[52ch] text-sm leading-[1.65] text-muted-foreground">
          Ask JARVIS, in chat or voice, to save a note and it&rsquo;ll show up here.
        </p>

        {error && <div className="mb-3 text-[13px] text-destructive">{error}</div>}

        {loading ? (
          <div className="text-[13.5px] text-muted-foreground">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="text-[13.5px] text-muted-foreground">
            Nothing yet - ask JARVIS to save a note and it&rsquo;ll show up here.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {notes.map((note) => (
              <Card key={note.id} size="sm" className="p-[15px_17px]">
                {note.title && <div className="text-[14px] text-foreground">{note.title}</div>}
                <div className={`text-[13px] leading-[1.55] text-muted-foreground ${note.title ? 'mt-1' : ''}`}>
                  {note.content}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
