'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SearchPalette } from './SearchPalette';
import { VoiceOverlay } from './VoiceOverlay';
import { ChatView } from '@/views/ChatView';
import { HomeView } from '@/views/HomeView';
import { MemoryView } from '@/views/MemoryView';
import { KnowledgeView } from '@/views/KnowledgeView';
import { ToolsView } from '@/views/ToolsView';
import { SettingsView } from '@/views/SettingsView';
import { useChat } from '@/lib/chat/useChat';
import type { Route, Theme } from '@/types';

const ROUTE_TITLES: Record<Exclude<Route, 'chat'>, string> = {
  home: 'New conversation',
  memory: 'Memory',
  knowledge: 'Knowledge',
  tools: 'Tools',
  settings: 'Settings',
};

export function AppShell() {
  const [theme, setTheme] = useState<Theme>('dark');
  // Defaults to the "New conversation" screen rather than the empty chat
  // view - the effect below switches to 'chat' exactly once, if a saved
  // conversation turns out to be resumed on mount.
  const [route, setRoute] = useState<Route>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [draft, setDraft] = useState('');
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
  const activeTitle = conversations.find((c) => c.id === activeConversationId)?.title ?? 'New conversation';
  const title = route === 'chat' ? activeTitle : ROUTE_TITLES[route];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Mirrors the mount-time auto-resume in useChat: if it lands a saved
  // conversation, jump to 'chat' to show it - but only that once, so it
  // doesn't fight with the user navigating elsewhere afterward.
  const didAutoResumeRoute = useRef(false);
  useEffect(() => {
    if (!didAutoResumeRoute.current && activeConversationId) {
      didAutoResumeRoute.current = true;
      setRoute('chat');
    }
  }, [activeConversationId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const newChat = useCallback(() => {
    setRoute('home');
    resetChat();
    setDraft('');
  }, [resetChat]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setRoute('chat');
    void sendChat(text);
  }, [draft, sendChat]);

  const openVoice = useCallback(() => setVoiceOpen(true), []);

  const selectConversation = useCallback(
    (id: string) => {
      setRoute('chat');
      void switchTo(id);
    },
    [switchTo],
  );

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar
        open={sidebarOpen}
        route={route}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewChat={newChat}
        onOpenSearch={() => setSearchOpen(true)}
        onNavigate={setRoute}
        onOpenSettings={() => setRoute('settings')}
        onSelectConversation={selectConversation}
        onDeleteConversation={(id) => {
          if (activeConversationId === id) setRoute('home');
          void removeConversation(id);
        }}
        onRenameConversation={(id, newTitle) => void renameConversation(id, newTitle)}
      />
      <main className="flex min-w-0 flex-1 flex-col [background:radial-gradient(1200px_700px_at_50%_-10%,var(--ac-xs),transparent_70%),var(--bg)]">
        <TopBar
          title={title}
          theme={theme}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onOpenVoice={openVoice}
        />

        {route === 'chat' && (
          <ChatView
            msgs={msgs}
            streaming={streaming}
            error={chatError}
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onSuggestion={setDraft}
            onOpenVoice={openVoice}
            onOpenTools={() => setRoute('tools')}
          />
        )}
        {route === 'home' && (
          <HomeView
            theme={theme}
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onOpenVoice={openVoice}
            onOpenTools={() => setRoute('tools')}
            onSuggestion={setDraft}
          />
        )}
        {route === 'memory' && <MemoryView />}
        {route === 'knowledge' && <KnowledgeView />}
        {route === 'tools' && <ToolsView />}
        {route === 'settings' && <SettingsView theme={theme} onSetTheme={setTheme} />}
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

      {voiceOpen && <VoiceOverlay theme={theme} onClose={() => setVoiceOpen(false)} />}
    </div>
  );
}
