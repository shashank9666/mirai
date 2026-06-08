'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Waybar from '@/components/ide/Waybar';
import ActivityBar from '@/components/ide/ActivityBar';
import HyprSidebar from '@/components/ide/HyprSidebar';
import HyprEditor from '@/components/ide/HyprEditor';
import HyprChat from '@/components/ide/HyprChat';
import HyprTerminal from '@/components/ide/HyprTerminal';
import HyprStatusBar from '@/components/ide/HyprStatusBar';
import CommandPalette from '@/components/ide/CommandPalette';
import QuickOpen from '@/components/ide/QuickOpen';
import HyprSearch from '@/components/ide/HyprSearch';
import HyprGit from '@/components/ide/HyprGit';
import { HyprExtensions, HyprAgent, HyprDatabase, HyprDebug } from '@/components/ide/HyprPanels';

function ResizeHandle({
  direction = 'horizontal',
  onResize
}: {
  direction?: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}) {
  const isDragging = useRef(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      startPos.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, onResize]);

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center group transition-colors
        ${direction === 'horizontal'
          ? 'w-[5px] cursor-col-resize hover:bg-[var(--color-primary-accent)]/20'
          : 'h-[5px] cursor-row-resize hover:bg-[var(--color-primary-accent)]/20'}`}
      onMouseDown={handleMouseDown}
    >
      <div className={`rounded-full bg-white/10 group-hover:bg-[var(--color-primary-accent)] transition-colors
        ${direction === 'horizontal' ? 'w-[2px] h-6' : 'w-6 h-[2px]'}`}
      />
    </div>
  );
}

function SidebarContent({ activeView }: { activeView: string }) {
  switch (activeView) {
    case 'search':
      return <HyprSearch />;
    case 'git':
      return <HyprGit />;
    case 'extensions':
      return <HyprExtensions />;
    case 'agent':
      return <HyprAgent />;
    case 'database':
      return <HyprDatabase />;
    case 'debug':
      return <HyprDebug />;
    case 'explorer':
    default:
      return <HyprSidebar />;
  }
}

export default function Home() {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [chatWidth, setChatWidth] = useState(320);
  const [terminalHeight, setTerminalHeight] = useState(200);

  const [activeView, setActiveView] = useState('explorer');
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const [chatVisible, setChatVisible] = useState(true);
  const [chatPinned, setChatPinned] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  const [terminalVisible, setTerminalVisible] = useState(true);
  const [terminalPinned, setTerminalPinned] = useState(false);
  const [terminalMinimized, setTerminalMinimized] = useState(false);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(w => Math.max(180, Math.min(500, w + delta)));
  }, []);

  const handleChatResize = useCallback((delta: number) => {
    setChatWidth(w => Math.max(200, Math.min(500, w - delta)));
  }, []);

  const handleTerminalResize = useCallback((delta: number) => {
    setTerminalHeight(h => Math.max(80, Math.min(500, h - delta)));
  }, []);

  const handleViewChange = (view: string) => {
    if (activeView === view && sidebarVisible) {
      setSidebarVisible(false);
    } else {
      setActiveView(view);
      setSidebarVisible(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'b') {
        e.preventDefault();
        setSidebarVisible(v => !v);
      }
      if (mod && e.key === '`') {
        e.preventDefault();
        setTerminalVisible(v => !v);
      }
      if (mod && e.key === 'j') {
        e.preventDefault();
        setChatVisible(v => !v);
      }
      if (mod && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleViewChange('search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleCommand = (e: CustomEvent) => {
      const cmd = e.detail?.command;
      if (cmd === 'toggleTerminal') setTerminalVisible(v => !v);
      else if (cmd === 'toggleSidebar') setSidebarVisible(v => !v);
      else if (cmd === 'toggleChat') setChatVisible(v => !v);
      else if (cmd?.startsWith('view:')) handleViewChange(cmd.slice(5));
    };
    window.addEventListener('ide:command', handleCommand as EventListener);
    return () => window.removeEventListener('ide:command', handleCommand as EventListener);
  }, []);

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden text-[var(--color-text-normal)] select-none" style={{ backgroundColor: 'var(--background)' }}>
      <CommandPalette />
      <QuickOpen />

      <Waybar />

      <div className="flex-1 flex min-h-0">
        <ActivityBar activeView={activeView} onViewChange={handleViewChange} />

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex min-h-0">
            {sidebarVisible && (
              <>
                <div className="flex-shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
                  <SidebarContent activeView={activeView} />
                </div>
                <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
              </>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">
              <HyprEditor />
            </div>

            {chatVisible && (
              <>
                <ResizeHandle direction="horizontal" onResize={handleChatResize} />
                <div className="flex-shrink-0 overflow-hidden" style={{ width: chatMinimized ? 200 : chatWidth }}>
                  <HyprChat
                    isPinned={chatPinned}
                    isMinimized={chatMinimized}
                    onPin={() => setChatPinned(p => !p)}
                    onMinimize={() => setChatMinimized(m => !m)}
                    onClose={() => setChatVisible(false)}
                  />
                </div>
              </>
            )}
          </div>

          {terminalVisible && (
            <>
              <ResizeHandle direction="vertical" onResize={handleTerminalResize} />
              <div className="flex-shrink-0 overflow-hidden" style={{ height: terminalMinimized ? 36 : terminalHeight }}>
                <HyprTerminal
                  isPinned={terminalPinned}
                  isMinimized={terminalMinimized}
                  onPin={() => setTerminalPinned(p => !p)}
                  onMinimize={() => setTerminalMinimized(m => !m)}
                  onClose={() => setTerminalVisible(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <HyprStatusBar />
    </main>
  );
}
