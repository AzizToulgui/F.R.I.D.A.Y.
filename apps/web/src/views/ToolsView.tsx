'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

interface ToolInfo {
  name: string;
  description: string;
  requiresConfirmation: boolean;
}

interface Reminder {
  id: string;
  text: string;
  dueAt: string | null;
  completedAt: string | null;
}

const TOOL_LABELS: Record<string, string> = {
  get_current_time: 'Current time',
  search_application_data: 'Search your data',
  create_reminder: 'Reminders',
};

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  return new Date(dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ToolsView() {
  const { authFetch } = useAuth();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [toolList, reminderList] = await Promise.all([
          authFetch<ToolInfo[]>('/tools'),
          authFetch<Reminder[]>('/reminders'),
        ]);
        if (cancelled) return;
        setTools(toolList);
        setReminders(reminderList);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load tools.');
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
        <h1 className="m-0 text-[26px] font-normal text-tx">Tools</h1>
        <p className="mt-2 mb-[22px] max-w-[52ch] text-sm leading-[1.65] text-tx3">
          Capabilities JARVIS can use on your behalf, in both voice and text. Every call is logged; anything marked
          "asks first" won't run without your explicit confirmation.
        </p>

        {error && <div className="mb-3 text-[13px] text-danger">{error}</div>}

        {loading ? (
          <div className="text-[13.5px] text-tx3">Loading tools…</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
            {tools.map((tool) => (
              <div key={tool.name} className="rounded-[13px] border border-line bg-panel p-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 text-[14px] text-tx">{TOOL_LABELS[tool.name] ?? tool.name}</div>
                  <span className="rounded-full border border-[rgba(120,220,160,0.28)] px-2.5 py-[3px] font-mono text-[10.5px] text-ok">
                    AVAILABLE
                  </span>
                </div>
                <div className="mt-2 text-[12.5px] leading-[1.55] text-tx3">{tool.description}</div>
                {tool.requiresConfirmation && (
                  <div className="mt-2 font-mono text-[10.5px] tracking-[0.08em] text-tx4">ASKS FIRST</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 mb-2.5 font-mono text-[10px] tracking-[0.14em] text-tx4">
          REMINDERS · {reminders.length}
        </div>
        {!loading && reminders.length === 0 ? (
          <div className="text-[13.5px] text-tx3">
            Nothing yet - ask JARVIS to remind you of something and it'll show up here.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`rounded-[13px] border p-[15px_17px] ${
                  reminder.completedAt ? 'border-line bg-bg2 opacity-70' : 'border-line bg-panel'
                }`}
              >
                <div className="text-[14px] text-tx">{reminder.text}</div>
                <div className="mt-1.5 font-mono text-[11px] text-tx4">
                  {reminder.completedAt ? 'DONE · ' : ''}
                  {formatDue(reminder.dueAt).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
