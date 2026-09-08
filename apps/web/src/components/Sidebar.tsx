"use client";

import { useState } from "react";
import {
  BellIcon,
  BrainIcon,
  ChevronLeftIcon,
  LibraryIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
  SettingsIcon,
  StickyNoteIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConversationSummary } from "@/lib/chat/useChat";
import type { Route } from "@/types";
import { useAuth } from "@/lib/auth/AuthProvider";

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

const navItemBase =
  "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground";
const navItemActive = "bg-accent text-accent-foreground";

const historyItemBase =
  "group flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-[7px] text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground";
const historyItemActive = "bg-accent text-accent-foreground";

type DateGroup = "Today" | "Yesterday" | "Earlier";
const DATE_GROUPS: DateGroup[] = ["Today", "Yesterday", "Earlier"];

function dateGroup(iso: string): DateGroup {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
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
  const [editingTitle, setEditingTitle] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<ConversationSummary | null>(null);

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
        className={`flex flex-none flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
          open ? "w-64" : "w-0"
        }`}
      >
        <div className="flex h-14 flex-none items-center gap-2.5 border-b px-3.5">
          <div className="relative grid h-[26px] w-[26px] flex-none place-items-center rounded-full border border-ac-l shadow-[0_0_14px_rgba(95,216,255,0.25)_inset]">
            <div className="h-3.5 w-3.5 rounded-full border border-ac-m" />
            <div className="absolute h-[5px] w-[5px] animate-[jv-breathe_4s_ease-in-out_infinite] rounded-full bg-ac-tx shadow-[0_0_10px_2px_rgba(95,216,255,0.8)]" />
          </div>
          <span className="whitespace-nowrap text-[13px] font-medium tracking-[0.22em] text-muted-foreground">
            JARVIS
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="ml-auto"
          >
            <ChevronLeftIcon />
          </Button>
        </div>

        <div className="flex flex-col gap-1.5 p-3">
          <Button
            type="button"
            variant="outline"
            onClick={onNewChat}
            className="justify-start"
          >
            <PlusIcon /> New conversation
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenSearch}
            className="justify-start text-muted-foreground"
          >
            <SearchIcon /> Search
            <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 pb-2.5">
          <button
            type="button"
            onClick={() => onNavigate("memory")}
            className={`${navItemBase} ${route === "memory" ? navItemActive : ""}`}
          >
            <BrainIcon className="size-4" /> Memory
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              24
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("knowledge")}
            className={`${navItemBase} ${route === "knowledge" ? navItemActive : ""}`}
          >
            <LibraryIcon className="size-4" /> Knowledge
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              6
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("tools")}
            className={`${navItemBase} ${route === "tools" ? navItemActive : ""}`}
          >
            <WrenchIcon className="size-4" /> Tools
          </button>
          <button
            type="button"
            onClick={() => onNavigate("reminders")}
            className={`${navItemBase} ${route === "reminders" ? navItemActive : ""}`}
          >
            <BellIcon className="size-4" /> Reminders
          </button>
          <button
            type="button"
            onClick={() => onNavigate("notes")}
            className={`${navItemBase} ${route === "notes" ? navItemActive : ""}`}
          >
            <StickyNoteIcon className="size-4" /> Notes
          </button>
        </nav>

        <div className="flex-1 overflow-y-auto px-3 pt-1.5 pb-3">
          {conversations.length === 0 ? (
            <div className="px-2.5 py-2.5 text-xs text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            DATE_GROUPS.map((group) => {
              const items = conversations.filter(
                (c) => dateGroup(c.updatedAt) === group,
              );
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="flex items-center gap-1.5 pt-3.5 pr-1 pb-1.5 pl-1 font-mono text-[10px] tracking-[0.14em] text-muted-foreground first:pt-2">
                    {group.toUpperCase()}
                  </div>
                  {items.map((c) =>
                    editingId === c.id ? (
                      <div
                        key={c.id}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-[5px]"
                      >
                        <Input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            else if (e.key === "Escape") cancelEdit();
                          }}
                          onBlur={commitEdit}
                          className="h-7 text-sm"
                        />
                      </div>
                    ) : (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectConversation(c.id)}
                        className={`${historyItemBase} ${
                          route === "chat" && activeConversationId === c.id
                            ? historyItemActive
                            : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {c.title}
                        </span>
                        <span
                          role="button"
                          aria-label={`Rename "${c.title}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(c);
                          }}
                          className="hidden flex-none cursor-pointer items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground group-hover:flex"
                        >
                          <PencilIcon className="size-[13px]" />
                        </span>
                        <span
                          role="button"
                          aria-label={`Delete "${c.title}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(c);
                          }}
                          className="hidden flex-none cursor-pointer items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive group-hover:flex"
                        >
                          <Trash2Icon className="size-[13px]" />
                        </span>
                      </button>
                    ),
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-none items-center gap-2.5 border-t px-3 py-2.5">
          <Avatar size="sm">
            <AvatarFallback className="font-mono text-[11px]">
              {initials(user?.displayName ?? user?.email ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="overflow-hidden text-[12.5px] text-ellipsis whitespace-nowrap text-foreground">
              {user?.displayName ?? user?.email ?? "Signed out"}
            </div>
            <div className="font-mono text-[10.5px] text-muted-foreground">
              GEMINI 2.5
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void logout()}
              aria-label="Log out"
            >
              <PowerIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onOpenSettings}
              aria-label="Settings"
            >
              <SettingsIcon />
            </Button>
          </div>
        </div>
      </aside>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; will be permanently deleted.
              This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
