"use client";

import { useEffect, useMemo, useState } from "react";
import { WrenchIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth/AuthProvider";

interface ToolInfo {
  name: string;
  description: string;
  requiresConfirmation: boolean;
  enabled: boolean;
}

interface GroupMember {
  name: string;
  action: string;
}

interface ToolGroup {
  key: string;
  label: string;
  // Direct URL to an image file (.png/.svg/.jpg) - a marketplace/listing page
  // URL (e.g. a Flaticon or Vecteezy product page) will not render, since
  // it's HTML, not an image. See GroupImage's onError fallback below.
  image: string;
  members: GroupMember[];
}

// Renders `src` as the group's image, falling back to a generic icon if it
// fails to load (e.g. the URL points at a marketplace page rather than the
// actual image file, or the host blocks hotlinking) - so a bad URL degrades
// to a placeholder instead of the browser's broken-image glyph.
function GroupImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="grid size-full place-items-center rounded-[10px] bg-muted text-muted-foreground">
        <WrenchIcon className="size-[55%]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external hosts, not worth a next.config remotePatterns entry per icon source
    <img
      src={src}
      alt={alt}
      className="size-full rounded-[10px] object-contain"
      onError={() => setFailed(true)}
    />
  );
}

// Every registered tool must appear in exactly one group's `members`, in the
// order it should be listed - see ToolsView's assembly effect, which errors
// loudly in dev if the backend ever registers a tool this config doesn't know
// about, rather than silently dropping it from the page.
const TOOL_GROUPS: ToolGroup[] = [
  {
    key: "reminders",
    label: "Reminders",
    image: "/reminders.png",
    members: [
      { name: "create_reminder", action: "Create" },
      { name: "list_reminders", action: "List" },
      { name: "update_reminder", action: "Update" },
      { name: "delete_reminder", action: "Delete" },
    ],
  },
  {
    key: "notes",
    label: "Notes",
    image: "/notes.png",
    members: [
      { name: "create_note", action: "Create" },
      { name: "list_notes", action: "List" },
      { name: "update_note", action: "Update" },
      { name: "delete_note", action: "Delete" },
    ],
  },
  {
    key: "calendar",
    label: "Google Calendar",
    image: "/calendar.png",
    members: [
      { name: "list_calendar_events", action: "List" },
      { name: "create_calendar_event", action: "Create" },
      { name: "update_calendar_event", action: "Update" },
    ],
  },
  {
    key: "gmail",
    label: "Gmail",
    image: "/gmail.png",
    members: [{ name: "list_unread_emails", action: "Read unread email" }],
  },
  {
    key: "voice_memos",
    label: "Voice Memos",
    image: "/voice.png",
    members: [
      { name: "record_voice_memo", action: "Record" },
      { name: "stop_recording_voice_memo", action: "Stop recording" },
      { name: "play_voice_memo", action: "Play" },
      { name: "list_voice_memos", action: "List" },
    ],
  },
  {
    key: "current_time",
    label: "Current Time",
    image: "/current_time.png",
    members: [{ name: "get_current_time", action: "Check the time" }],
  },
  {
    key: "search_application_data",
    label: "Search Your Data",
    image: "/history.png",
    members: [{ name: "search_application_data", action: "Search your data" }],
  },
  {
    key: "weather",
    label: "Weather",
    image: "/weather.png",
    members: [{ name: "get_weather", action: "Check the weather" }],
  },
];

interface AssembledGroup {
  group: ToolGroup;
  tools: ToolInfo[];
  allEnabled: boolean;
}

export function ToolsView() {
  const { authFetch } = useAuth();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingGroups, setPendingGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const toolList = await authFetch<ToolInfo[]>("/tools");
        if (!cancelled) setTools(toolList);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load tools.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const byName = useMemo(() => new Map(tools.map((t) => [t.name, t])), [tools]);

  const assembled: AssembledGroup[] = useMemo(
    () =>
      TOOL_GROUPS.map((group) => ({
        group,
        tools: group.members
          .map((m) => byName.get(m.name))
          .filter((t): t is ToolInfo => Boolean(t)),
        allEnabled: group.members.every(
          (m) => byName.get(m.name)?.enabled ?? true,
        ),
      })).filter((g) => g.tools.length > 0),
    [byName],
  );

  const toggleGroup = async (group: ToolGroup, nextEnabled: boolean) => {
    const previous = tools;
    const names = new Set(group.members.map((m) => m.name));
    setTools((prev) =>
      prev.map((t) => (names.has(t.name) ? { ...t, enabled: nextEnabled } : t)),
    );
    setPendingGroups((prev) => new Set(prev).add(group.key));
    try {
      await Promise.all(
        group.members.map((m) =>
          authFetch(`/tools/${encodeURIComponent(m.name)}/enabled`, {
            method: "PATCH",
            body: JSON.stringify({ enabled: nextEnabled }),
          }),
        ),
      );
    } catch (e) {
      setTools(previous); // out of sync with the server - restore and surface the failure
      setError(
        e instanceof Error ? e.message : `Could not update "${group.label}".`,
      );
    } finally {
      setPendingGroups((prev) => {
        const next = new Set(prev);
        next.delete(group.key);
        return next;
      });
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[860px] px-6 pt-[38px] pb-[60px]">
        <h1 className="m-0 text-[26px] font-normal text-foreground">Tools</h1>
        <p className="mt-2 mb-[22px] max-w-[52ch] text-sm leading-[1.65] text-muted-foreground">
          Capabilities JARVIS can use on your behalf, in both voice and text.
          Switch a whole capability off to stop JARVIS from using any part of
          it.
        </p>

        {error && (
          <div className="mb-3 text-[13px] text-destructive">{error}</div>
        )}

        {loading ? (
          <div className="text-[13.5px] text-muted-foreground">
            Loading tools…
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
            {assembled.map(({ group, tools: groupTools, allEnabled }) => (
              <Card
                key={group.key}
                size="sm"
                className={`p-4 ${allEnabled ? "" : "opacity-60"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 flex-none">
                    <GroupImage src={group.image} alt={group.label} />
                  </div>
                  <div className="flex-1 text-[14px] text-foreground">
                    {group.label}
                  </div>
                  <Switch
                    aria-label={`Toggle ${group.label}`}
                    checked={allEnabled}
                    disabled={pendingGroups.has(group.key)}
                    onCheckedChange={(checked) =>
                      void toggleGroup(group, checked)
                    }
                  />
                </div>
                {group.members.length > 1 ? (
                  <ul className="mt-2.5 flex flex-col gap-1 text-[12.5px] leading-[1.55] text-muted-foreground">
                    {group.members.map((m) => (
                      <li key={m.name} className="flex items-center gap-1.5">
                        <span className="size-1 flex-none rounded-full bg-current opacity-50" />
                        {m.action}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-[12.5px] leading-[1.55] text-muted-foreground">
                    {groupTools[0]?.description}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
