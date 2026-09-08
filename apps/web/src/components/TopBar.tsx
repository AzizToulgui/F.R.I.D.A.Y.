'use client';

import { AudioLinesIcon, MenuIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Theme } from '@/types';

interface TopBarProps {
  title: string;
  theme: Theme;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenVoice: () => void;
}

export function TopBar({ title, theme, onToggleSidebar, onToggleTheme, onOpenVoice }: TopBarProps) {
  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b px-5 backdrop-blur-[8px]">
      <Button type="button" variant="ghost" size="icon-sm" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <MenuIcon />
      </Button>
      <div className="text-sm text-muted-foreground">{title}</div>
      <Badge variant="outline" className="gap-1.5 rounded-full font-mono text-[10px] tracking-[0.08em]">
        <span className="h-[5px] w-[5px] rounded-full bg-primary" /> ONLINE
      </Badge>
      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onToggleTheme}
          aria-label="Toggle dark and light mode"
        >
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </Button>
        <Button type="button" variant="outline" size="sm">
          Share
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onOpenVoice}>
          <AudioLinesIcon /> Voice mode
        </Button>
      </div>
    </header>
  );
}
