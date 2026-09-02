'use client';

import { useCallback, useEffect, useState } from 'react';
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

const ROUTE_TITLES: Record<Route, string> = {
  chat: 'Project architecture',
  home: 'New conversation',
  memory: 'Memory',
  knowledge: 'Knowledge',
  tools: 'Tools',
  settings: 'Settings',
};

export function AppShell() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [route, setRoute] = useState<Route>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const { msgs, streaming, error: chatError, send: sendChat, reset: resetChat } = useChat();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar
        open={sidebarOpen}
        route={route}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewChat={newChat}
        onOpenSearch={() => setSearchOpen(true)}
        onNavigate={setRoute}
        onOpenSettings={() => setRoute('settings')}
      />
      <main className="flex min-w-0 flex-1 flex-col [background:radial-gradient(1200px_700px_at_50%_-10%,var(--ac-xs),transparent_70%),var(--bg)]">
        <TopBar
          title={ROUTE_TITLES[route]}
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
          />
        )}
        {route === 'home' && (
          <HomeView
            theme={theme}
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onOpenVoice={openVoice}
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
