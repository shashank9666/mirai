import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, Settings, Bot, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

interface Command {
  id: string;
  title: string;
  icon: React.ReactNode;
  action: () => void;
}

export default function CommandPalette() {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { setCurrentView } = useSettingsStore();

  const commands: Command[] = [
    {
      id: 'settings',
      title: 'Preferences: Open Settings',
      icon: <Settings size={16} />,
      action: () => setCurrentView('settings')
    },
    {
      id: 'chat',
      title: 'Mirai: Open AI Chat',
      icon: <Bot size={16} />,
      action: () => setCurrentView('chat')
    },
    {
      id: 'new-file',
      title: 'File: New File',
      icon: <File size={16} />,
      action: () => console.log('New file not hooked up yet')
    },
    {
      id: 'terminal',
      title: 'Terminal: Create New Terminal',
      icon: <Terminal size={16} />,
      action: () => console.log('Terminal focus not hooked up yet')
    }
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => {
        setQuery('');
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
      setCommandPaletteOpen(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div 
        className="fixed inset-0 bg-black/20" 
        onClick={() => setCommandPaletteOpen(false)}
      />
      <div className="relative w-[600px] max-w-[90vw] bg-[#1e1e1e] border border-border/50 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center px-3 py-2 border-b border-border/50">
          <Search size={16} className="text-muted-foreground mr-2" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-foreground outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              No matching commands
            </div>
          ) : (
            filteredCommands.map((cmd, i) => (
              <div
                key={cmd.id}
                className={cn(
                  "flex items-center px-4 py-2 text-sm cursor-pointer",
                  i === selectedIndex ? "bg-blue-600 text-white" : "text-foreground hover:bg-white/5"
                )}
                onClick={() => {
                  cmd.action();
                  setCommandPaletteOpen(false);
                }}
              >
                <span className={cn("mr-3", i === selectedIndex ? "text-white" : "text-muted-foreground")}>
                  {cmd.icon}
                </span>
                <span>{cmd.title}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
