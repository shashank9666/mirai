'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTerminalStore, ShellType } from '@/store/useTerminalStore';
import { Plus, Trash2, Columns, ChevronDown, Terminal as TerminalIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

const lightTheme = {
  background: '#f9fafb',
  foreground: '#1f2937',
  cursor: '#2563eb',
  selectionBackground: '#bfdbfe',
  black: '#000000',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#d946ef',
  cyan: '#0891b2',
  white: '#e5e7eb',
  brightBlack: '#4b5563',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#ec4899',
  brightCyan: '#06b6d4',
  brightWhite: '#f9fafb'
};

const darkTheme = {
  background: '#0f111a',
  foreground: '#a6accd',
  cursor: '#82aaff',
  selectionBackground: '#3a4264',
  black: '#000000',
  red: '#ff5370',
  green: '#c3e88d',
  yellow: '#ffcb6b',
  blue: '#82aaff',
  magenta: '#c792ea',
  cyan: '#89ddff',
  white: '#ffffff',
  brightBlack: '#545454',
  brightRed: '#ff5370',
  brightGreen: '#c3e88d',
  brightYellow: '#ffcb6b',
  brightBlue: '#82aaff',
  brightMagenta: '#c792ea',
  brightCyan: '#89ddff',
  brightWhite: '#ffffff'
};

interface XTermInstanceProps {
  id: string;
  shell: ShellType;
  isVisible: boolean;
  isSplit: boolean;
}

function XTermInstance({ shell, isVisible, isSplit }: XTermInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { workspacePath } = useWorkspaceStore();
  const { themeMode } = useSettingsStore();

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize xterm.js instance
    const term = new XTerm({
      cursorBlink: true,
      theme: themeMode === 'dark' ? darkTheme : lightTheme,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      allowProposedApi: true
    });
    xtermRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    
    // Fit delay to allow container mounting width calculations
    const t = setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {
        // Suppress fit errors during early render cycles
      }
    }, 100);

    // Create a WebSocket connection dedicated to this terminal process
    const socket = io('http://localhost:4000', {
      query: { cwd: workspacePath || '', shell }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      term.writeln(`\x1b[1;32mConnected to terminal session (${shell}).\x1b[0m`);
      socket.emit('terminal:resize', {
        cols: term.cols,
        rows: term.rows
      });
    });

    socket.on('terminal:data', (data: string) => {
      term.write(data);
    });

    socket.on('disconnect', () => {
      term.writeln('\r\n\x1b[1;31mDisconnected from terminal session.\x1b[0m');
    });

    term.onData((data) => {
      socket.emit('terminal:write', data);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (isVisible) {
        try {
          fitAddon.fit();
          socket.emit('terminal:resize', {
            cols: term.cols,
            rows: term.rows
          });
        } catch {}
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(t);
      resizeObserver.disconnect();
      socket.disconnect();
      term.dispose();
    };
  }, [shell, workspacePath, isVisible, themeMode]);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = themeMode === 'dark' ? darkTheme : lightTheme;
    }
  }, [themeMode]);

  // Recalculate terminal size on transition from hidden to visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current && xtermRef.current && socketRef.current) {
      const fit = fitAddonRef.current;
      const term = xtermRef.current;
      const socket = socketRef.current;
      
      const t = setTimeout(() => {
        try {
          fit.fit();
          socket.emit('terminal:resize', {
            cols: term.cols,
            rows: term.rows
          });
        } catch {}
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isVisible, isSplit]);

  return (
    <div className="w-full h-full p-2 bg-[#f9fafb] dark:bg-[#0f111a] overflow-hidden" ref={containerRef} />
  );
}

export default function Terminal() {
  const { terminals, activeTerminalId, addTerminal, killTerminal, splitTerminal, setActiveTerminalId } = useTerminalStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize at least one terminal if empty
  useEffect(() => {
    if (terminals.length === 0) {
      addTerminal();
    }
  }, [terminals.length, addTerminal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTerminal = terminals.find(t => t.id === activeTerminalId);

  const handleCreateTerminal = (shell: ShellType) => {
    addTerminal(shell);
    setDropdownOpen(false);
  };

  const handleSplitActive = () => {
    if (activeTerminalId) {
      splitTerminal(activeTerminalId);
    }
  };

  return (
    <div className="w-full h-full flex flex-row bg-[#f9fafb] dark:bg-[#0f111a] border-t border-border select-none">
      {/* Left Area: Toolbar + Terminals Grid */}
      <div className="flex-1 flex flex-col min-w-0 h-full border-r border-border">
        {/* Terminal Header Toolbar */}
        <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-border bg-muted/20">
          <div className="text-xs font-semibold text-muted-foreground truncate">
            {activeTerminal ? activeTerminal.name : 'Terminal'}
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Split Button */}
            <button
              onClick={handleSplitActive}
              disabled={!activeTerminal || !!activeTerminal.splitWithId}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Split Terminal (Vertical)"
            >
              <Columns size={14} />
            </button>

            {/* Trash Button */}
            <button
              onClick={() => activeTerminalId && killTerminal(activeTerminalId)}
              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
              title="Kill Active Terminal"
            >
              <Trash2 size={14} />
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Shell Creator Dropdown Button */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center gap-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md p-1 cursor-pointer transition-colors">
                <button
                  onClick={() => addTerminal()}
                  className="p-0.5 rounded"
                  title="New Terminal (Default)"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="p-0.5 rounded border-l border-primary/20"
                >
                  <ChevronDown size={12} />
                </button>
              </div>

              {dropdownOpen && (
                <div className="absolute right-0 bottom-full mb-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-[99] min-w-[150px]">
                  <div
                    onClick={() => handleCreateTerminal('powershell')}
                    className="px-3 py-1.5 hover:bg-muted text-xs cursor-pointer text-foreground font-medium flex items-center gap-2"
                  >
                    <TerminalIcon size={12} /> PowerShell
                  </div>
                  <div
                    onClick={() => handleCreateTerminal('cmd')}
                    className="px-3 py-1.5 hover:bg-muted text-xs cursor-pointer text-foreground font-medium flex items-center gap-2"
                  >
                    <TerminalIcon size={12} /> Command Prompt
                  </div>
                  <div
                    onClick={() => handleCreateTerminal('gitbash')}
                    className="px-3 py-1.5 hover:bg-muted text-xs cursor-pointer text-foreground font-medium flex items-center gap-2"
                  >
                    <TerminalIcon size={12} /> Git Bash
                  </div>
                  <div
                    onClick={() => handleCreateTerminal('bash')}
                    className="px-3 py-1.5 hover:bg-muted text-xs cursor-pointer text-foreground font-medium flex items-center gap-2"
                  >
                    <TerminalIcon size={12} /> Bash
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Viewport: Renders frames for all running terminals using display toggle */}
        <div className="flex-1 flex flex-row min-h-0 w-full relative">
          {terminals.map(term => {
            const isActive = term.id === activeTerminalId;
            const isSplitActive = !!(activeTerminal && activeTerminal.splitWithId === term.id);
            const isVisible = isActive || isSplitActive;
            const isSplitLayout = !!(activeTerminal && activeTerminal.splitWithId);

            return (
              <div
                key={term.id}
                className={cn(
                  "h-full overflow-hidden transition-all duration-150",
                  isVisible 
                    ? (isSplitLayout ? "w-1/2 flex border-r border-border last:border-r-0" : "w-full flex")
                    : "hidden"
                )}
              >
                <XTermInstance 
                  id={term.id} 
                  shell={term.shell} 
                  isVisible={isVisible} 
                  isSplit={!!isSplitLayout} 
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Area: VS Code-like Terminal sidebar listing */}
      <div className="w-1/3 max-w-[176px] min-w-[60px] flex flex-col h-full bg-muted/10 border-l border-border">
        <div className="h-9 shrink-0 flex items-center px-2 border-b border-border bg-muted/10 overflow-hidden">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
            Terminals
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 py-2.5 space-y-1.5 custom-scrollbar">
          {terminals.map((term) => {
            const isSelected = term.id === activeTerminalId || (activeTerminal && activeTerminal.splitWithId === term.id);
            const isPrimary = term.id === activeTerminalId;

            return (
              <div
                key={term.id}
                onClick={() => setActiveTerminalId(term.id)}
                className={cn(
                  "group flex items-center justify-between px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-medium",
                  isPrimary
                    ? "bg-primary text-primary-foreground font-semibold"
                    : isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <TerminalIcon size={12} className="shrink-0 opacity-80" />
                  <span className="truncate">{term.name}</span>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    killTerminal(term.id);
                  }}
                  className={cn(
                    "p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all shrink-0 ml-1",
                    isPrimary ? "text-primary-foreground hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Kill Terminal"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
