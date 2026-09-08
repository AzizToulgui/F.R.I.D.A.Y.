'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

interface Note {
  id: string;
  title: string | null;
  content: string;
}

const TOOL_LABELS: Record<string, string> = {
  get_current_time: 'Current time',
  search_application_data: 'Search your data',
  create_reminder: 'Create reminder',
  list_reminders: 'List reminders',
  update_reminder: 'Edit reminder',
  delete_reminder: 'Delete reminder',
  create_note: 'Save note',
  list_notes: 'List notes',
  update_note: 'Edit note',
  delete_note: 'Delete note',
};

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  return new Date(dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ToolsView() {
  const { authFetch } = useAuth();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [toolList, reminderList, noteList] = await Promise.all([
          authFetch<ToolInfo[]>('/tools'),
          authFetch<Reminder[]>('/reminders'),
          authFetch<Note[]>('/notes'),
        ]);
        if (cancelled) return;
        setTools(toolList);
        setReminders(reminderList);
        setNotes(noteList);
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
        <h1 className="m-0 text-[26px] font-normal text-foreground">Tools</h1>
        <p className="mt-2 mb-[22px] max-w-[52ch] text-sm leading-[1.65] text-muted-foreground">
          Capabilities JARVIS can use on your behalf, in both voice and text. Every call is logged; anything marked
          "asks first" won't run without your explicit confirmation.
        </p>

        {error && <div className="mb-3 text-[13px] text-destructive">{error}</div>}

        {loading ? (
          <div className="text-[13.5px] text-muted-foreground">Loading tools…</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
            {tools.map((tool) => (
              <Card key={tool.name} size="sm" className="p-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 text-[14px] text-foreground">{TOOL_LABELS[tool.name] ?? tool.name}</div>
                  <Badge variant="outline" className="border-ok/30 font-mono text-[10.5px] text-ok">
                    AVAILABLE
                  </Badge>
                </div>
                <div className="mt-2 text-[12.5px] leading-[1.55] text-muted-foreground">{tool.description}</div>
                {tool.requiresConfirmation && (
                  <div className="mt-2 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground">
                    ASKS FIRST
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 mb-2.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          REMINDERS · {reminders.length}
        </div>
        {!loading && reminders.length === 0 ? (
          <div className="text-[13.5px] text-muted-foreground">
            Nothing yet - ask JARVIS to remind you of something and it'll show up here.
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

        <div className="mt-8 mb-2.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          NOTES · {notes.length}
        </div>
        {!loading && notes.length === 0 ? (
          <div className="text-[13.5px] text-muted-foreground">
            Nothing yet - ask JARVIS to save a note and it'll show up here.
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
