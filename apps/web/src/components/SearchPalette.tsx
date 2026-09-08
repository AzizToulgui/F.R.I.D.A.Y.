'use client';

import { BrainIcon, FileTextIcon, MessageSquareIcon } from 'lucide-react';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Route } from '@/types';

interface SearchPaletteProps {
  onClose: () => void;
  onNavigate: (route: Route) => void;
}

export function SearchPalette({ onClose, onNavigate }: SearchPaletteProps) {
  return (
    <CommandDialog open onOpenChange={(open) => !open && onClose()} title="Search FRIDAY">
      {/* CommandDialog only supplies the Dialog chrome - the cmdk store
          context (which CommandInput/CommandList/CommandItem all subscribe
          to) comes from Command itself, so it has to wrap them explicitly. */}
      <Command className="rounded-none bg-transparent">
        <CommandInput autoFocus placeholder="Search conversations, memories, documents…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Conversations">
            <CommandItem onSelect={() => onNavigate('chat')}>
              <MessageSquareIcon />
              <span className="flex-1">Project architecture</span>
              <span className="text-xs text-muted-foreground">today</span>
            </CommandItem>
            <CommandItem onSelect={() => onNavigate('chat')}>
              <MessageSquareIcon />
              <span className="flex-1">Voice assistant research</span>
              <span className="text-xs text-muted-foreground">yesterday</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Documents">
            <CommandItem onSelect={() => onNavigate('knowledge')}>
              <FileTextIcon />
              <span className="flex-1">Project architecture.pdf</span>
              <span className="text-xs text-muted-foreground">p. 12</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Memories">
            <CommandItem onSelect={() => onNavigate('memory')}>
              <BrainIcon />
              <span className="flex-1">Prefers TypeScript with strict mode</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="flex gap-4 border-t px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
          ↑↓ NAVIGATE<span>⏎ OPEN</span>
          <span>⌘⏎ NEW CHAT</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
