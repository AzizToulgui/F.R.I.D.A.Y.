'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/AuthProvider';

interface Reminder {
  id: string;
  text: string;
  dueAt: string | null;
  completedAt: string | null;
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  return new Date(dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function RemindersView() {
  const { authFetch } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await authFetch<Reminder[]>('/reminders');
        if (!cancelled) setReminders(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load reminders.');
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
        <h1 className="m-0 text-[26px] font-normal text-foreground">Reminders</h1>
        <p className="mt-2 mb-[22px] max-w-[52ch] text-sm leading-[1.65] text-muted-foreground">
          Ask JARVIS, in chat or voice, to remind you of something and it&rsquo;ll show up here.
        </p>

        {error && <div className="mb-3 text-[13px] text-destructive">{error}</div>}

        {loading ? (
          <div className="text-[13.5px] text-muted-foreground">Loading reminders…</div>
        ) : reminders.length === 0 ? (
          <div className="text-[13.5px] text-muted-foreground">
            Nothing yet - ask JARVIS to remind you of something and it&rsquo;ll show up here.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reminders.map((reminder) => (
              <Card
                key={reminder.id}
                size="sm"
                className={`p-[15px_17px] ${reminder.completedAt ? 'bg-muted/40 opacity-70' : ''}`}
              >
                <div className="text-[14px] text-foreground">{reminder.text}</div>
                <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                  {reminder.completedAt ? 'DONE · ' : ''}
                  {formatDue(reminder.dueAt).toUpperCase()}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
