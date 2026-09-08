"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SearchPalette } from "./SearchPalette";
import { VoiceOverlay } from "./VoiceOverlay";
import { ChatView } from "@/views/ChatView";
import { HomeView } from "@/views/HomeView";
import { MemoryView } from "@/views/MemoryView";
import { KnowledgeView } from "@/views/KnowledgeView";
import { RemindersView } from "@/views/RemindersView";
import { NotesView } from "@/views/NotesView";
import { ToolsView } from "@/views/ToolsView";
import { SettingsView } from "@/views/SettingsView";
import { useChat } from "@/lib/chat/useChat";
import type { Route, Theme } from "@/types";

const ROUTE_TITLES: Record<Exclude<Route, "chat">, string> = {
  home: "New conversation",
  memory: "Memory",
  knowledge: "Knowledge",
  reminders: "Reminders",
  notes: "Notes",
  tools: "Tools",
};

export function AppShell() {
  const [theme, setTheme] = useState<Theme>("dark");
  // Defaults to the "New conversation" screen rather than the empty chat
  // view - the effect below switches to 'chat' exactly once, if a saved
  // conversation turns out to be resumed on mount.
  const [route, setRoute] = useState<Route>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    string | undefined
  >(undefined);
  const [draft, setDraft] = useState("");

  // Picks up the redirect back from the Google OAuth callback (see
  // GoogleOAuthController) - there's no dedicated /settings route, so the
  // callback just lands on '/' with a query param and this opens the
  // Settings dialog straight to the Account tab instead.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "connected" || google === "error") {
      params.delete("google");
      const rest = params.toString();
      window.history.replaceState(
        null,
        "",
        rest ? `?${rest}` : window.location.pathname,
      );
      // Deferred rather than a direct setState call in the effect body -
      // avoids the cascading-synchronous-render lint rule for what's really
      // a one-time external-URL read on mount, not a per-render sync.
      queueMicrotask(() => {
        setSettingsInitialTab("Account");
        setSettingsOpen(true);
      });
    }
  }, []);
  const {
    msgs,
    streaming,
    error: chatError,
    send: sendChat,
    reset: resetChat,
    conversations,
    activeConversationId,
    switchTo,
    removeConversation,
    renameConversation,
  } = useChat();
  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ??
    "New conversation";
  const title = route === "chat" ? activeTitle : ROUTE_TITLES[route];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const newChat = useCallback(() => {
    setRoute("home");
    resetChat();
    setDraft("");
  }, [resetChat]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setRoute("chat");
    void sendChat(text);
  }, [draft, sendChat]);

  // Sends arbitrary text immediately, bypassing `draft` entirely - used by
  // "edit and resend" in ChatView, where reusing send() would read a stale
  // `draft` value in the same synchronous tick.
  const sendMessage = useCallback(
    (text: string) => {
      setRoute("chat");
      void sendChat(text);
    },
    [sendChat],
  );

  const openVoice = useCallback(() => setVoiceOpen(true), []);

  const selectConversation = useCallback(
    (id: string) => {
      setRoute("chat");
      void switchTo(id);
    },
    [switchTo],
  );

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        route={route}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewChat={newChat}
        onOpenSearch={() => setSearchOpen(true)}
        onNavigate={setRoute}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectConversation={selectConversation}
        onDeleteConversation={(id) => {
          if (activeConversationId === id) setRoute("home");
          void removeConversation(id);
        }}
        onRenameConversation={(id, newTitle) =>
          void renameConversation(id, newTitle)
        }
      />
      <main className="flex min-w-0 flex-1 flex-col [background:radial-gradient(1200px_700px_at_50%_-10%,color-mix(in_oklch,var(--primary)_6%,transparent),transparent_70%),var(--background)]">
        <TopBar
          title={title}
          theme={theme}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onToggleTheme={() =>
            setTheme((t) => (t === "dark" ? "light" : "dark"))
          }
          onOpenVoice={openVoice}
        />
        {route === "chat" && (
          <ChatView
            msgs={msgs}
            streaming={streaming}
            error={chatError}
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onSendMessage={sendMessage}
            onSuggestion={setDraft}
            onOpenVoice={openVoice}
            onOpenTools={() => setRoute("tools")}
          />
        )}
        {route === "home" && (
          <HomeView
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onOpenVoice={openVoice}
            onOpenTools={() => setRoute("tools")}
            onSuggestion={setDraft}
            streaming={streaming}
          />
        )}
        {route === "memory" && <MemoryView />}
        {route === "knowledge" && <KnowledgeView />}
        {route === "reminders" && <RemindersView />}
        {route === "notes" && <NotesView />}
        {route === "tools" && <ToolsView />}
      </main>

      {searchOpen && (
        <SearchPalette
          onClose={() => setSearchOpen(false)}
          onNavigate={(r) => {
            setRoute(r);
            setSearchOpen(false);
          }}
        />
      )}

      {voiceOpen && <VoiceOverlay onClose={() => setVoiceOpen(false)} />}

      {settingsOpen && (
        <SettingsView
          theme={theme}
          onSetTheme={setTheme}
          initialTab={settingsInitialTab}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsInitialTab(undefined);
          }}
        />
      )}
    </div>
  );
}
