'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Waybar from '@/components/ide/Waybar';
import ActivityBar from '@/components/ide/ActivityBar';
import HyprSidebar from '@/components/ide/HyprSidebar';
import HyprEditor from '@/components/ide/HyprEditor';
import EditorToolbar from '@/components/ide/EditorToolbar';
import HyprChat from '@/components/ide/HyprChat';
import HyprTerminal from '@/components/ide/HyprTerminal';
import HyprStatusBar from '@/components/ide/HyprStatusBar';
import CommandPalette from '@/components/ide/CommandPalette';
import QuickOpen from '@/components/ide/QuickOpen';
import HyprSearch from '@/components/ide/HyprSearch';
import HyprGit from '@/components/ide/HyprGit';
import WelcomeScreen from '@/components/ide/WelcomeScreen';
import SettingsPanel from '@/components/ide/SettingsPanel';
import { HyprExtensions, HyprAgent, HyprDatabase, HyprDebug } from '@/components/ide/HyprPanels';
import { useIdeStore } from '@/store/ideStore';

function ResizeHandle({
  direction = 'horizontal',
  onResize,
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
    case 'settings':
      return <SettingsPanel onClose={() => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'closeSettings' } }))} />;
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
  const [panelOrder, setPanelOrder] = useState<'normal' | 'reversed'>('normal');
  const [dragOverSide, setDragOverSide] = useState<string | null>(null);

  const { zenMode, fullscreenMode, toggleZenMode, toggleFullscreenMode, workspacePath, setWorkspace } = useIdeStore();
  const hasWorkspace = !!workspacePath;
  const [showWelcome, setShowWelcome] = useState(false);

  // On mount, try to restore last workspace from localStorage
  useEffect(() => {
    const lastWorkspace = localStorage.getItem('miraiLastWorkspace');
    if (lastWorkspace) {
      fetch('http://127.0.0.1:8000/api/workspace/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: lastWorkspace }),
      }).then(r => r.json()).then((result) => {
        if (result?.path) {
          setWorkspace(result.path, result.name);
        }
      }).catch(() => {});
    }
  }, [setWorkspace]);

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
    if (view === 'settings') {
      setActiveView('settings');
      setSidebarVisible(true);
      return;
    }
    if (activeView === view && sidebarVisible) {
      setSidebarVisible(false);
    } else {
      setActiveView(view);
      setSidebarVisible(true);
    }
  };

  const handleShowSettings = () => {
    handleViewChange('settings');
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
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreenMode();
      }
      if (e.key === 'Escape' && zenMode) {
        toggleZenMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenMode, toggleZenMode, toggleFullscreenMode]);

  useEffect(() => {
    const handleCommand = (e: CustomEvent) => {
      const cmd = e.detail?.command;
      if (cmd === 'toggleTerminal') setTerminalVisible(v => !v);
      else if (cmd === 'toggleSidebar') setSidebarVisible(v => !v);
      else if (cmd === 'toggleChat') setChatVisible(v => !v);
      else if (cmd?.startsWith('view:')) handleViewChange(cmd.slice(5));
      else if (cmd === 'toggleZenMode') toggleZenMode();
      else if (cmd === 'toggleFullscreen') toggleFullscreenMode();
      else if (cmd === 'toggleWordWrap') useIdeStore.getState().toggleWordWrap();
      else if (cmd === 'toggleMinimap') useIdeStore.getState().toggleMinimap();
      else if (cmd === 'toggleStickyScroll') useIdeStore.getState().toggleStickyScroll();
      else if (cmd === 'toggleFormatOnSave') useIdeStore.getState().toggleFormatOnSave();
      else if (cmd === 'toggleBracketColorization') useIdeStore.getState().toggleBracketPairColorization();
      else if (cmd === 'toggleFolding') useIdeStore.getState().toggleFolding();
      else if (cmd === 'increaseFontSize') useIdeStore.getState().increaseFontSize();
      else if (cmd === 'decreaseFontSize') useIdeStore.getState().decreaseFontSize();
      else if (cmd === 'resetFontSize') useIdeStore.getState().resetFontSize();
      else if (cmd === 'splitHorizontal') useIdeStore.getState().addGroup('horizontal');
      else if (cmd === 'splitVertical') useIdeStore.getState().addGroup('vertical');
      else if (cmd === 'closeGroup') {
        const state = useIdeStore.getState();
        if (state.groups.length > 1) {
          state.removeGroup(state.activeGroupId);
        }
      } else if (cmd === 'openFolder') {
        setShowWelcome(true);
      } else if (cmd === 'closeSettings') {
        if (activeView === 'settings') {
          setActiveView('explorer');
        }
      }
    };
    window.addEventListener('ide:command', handleCommand as EventListener);
    return () => window.removeEventListener('ide:command', handleCommand as EventListener);
  }, [toggleZenMode, toggleFullscreenMode, activeView]);

  useEffect(() => {
    if (fullscreenMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [fullscreenMode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenMode) {
        useIdeStore.getState().toggleFullscreenMode();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [fullscreenMode]);

  const handleDragOver = useCallback((e: React.DragEvent, side: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSide(side);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverSide(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, target: string) => {
    e.preventDefault();
    setDragOverSide(null);
    const source = e.dataTransfer.getData('text/panel');
    if (source === 'sidebar' && target === 'chat') {
      setPanelOrder('reversed');
    } else if (source === 'chat' && target === 'sidebar') {
      setPanelOrder('normal');
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, panel: string) => {
    e.dataTransfer.setData('text/panel', panel);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // Sync showWelcome with workspacePath changes
  useEffect(() => {
    if (workspacePath) {
      setShowWelcome(false);
    }
  }, [workspacePath]);

  // If no workspace on mount, show welcome
  useEffect(() => {
    if (!workspacePath) {
      setShowWelcome(true);
    }
  }, [workspacePath]);

  return (
    <main className={`h-screen w-screen flex flex-col overflow-hidden text-[var(--color-text-normal)] select-none transition-all duration-300 ${zenMode ? 'bg-black' : ''}`} style={{ backgroundColor: zenMode ? 'black' : 'var(--background)' }}>
      <CommandPalette />
      <QuickOpen />

      {!zenMode && <Waybar />}

      <div className="flex-1 flex min-h-0">
        {!zenMode && <ActivityBar activeView={activeView} onViewChange={handleViewChange} onShowSettings={handleShowSettings} />}

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex min-h-0">
            {!zenMode && sidebarVisible && (
              <>
                <div
                  draggable={!zenMode}
                  onDragStart={(e) => handleDragStart(e, 'sidebar')}
                  onDragOver={(e) => handleDragOver(e, 'sidebar')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'sidebar')}
                  className={`flex-shrink-0 overflow-hidden transition-all duration-200 ${
                    dragOverSide === 'sidebar' ? 'ring-2 ring-[var(--color-primary-accent)]/50 rounded-lg' : ''
                  }`}
                  style={{ width: sidebarWidth }}
                >
                  <SidebarContent activeView={activeView} />
                </div>
                <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
              </>
            )}

            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              {hasWorkspace && !showWelcome && <EditorToolbar />}
              <div className="flex-1 min-h-0">
                {showWelcome || !hasWorkspace ? (
                  <WelcomeScreen onWorkspaceOpened={() => setShowWelcome(false)} />
                ) : (
                  <HyprEditor />
                )}
              </div>
            </div>

            {!zenMode && chatVisible && (
              <>
                <ResizeHandle direction="horizontal" onResize={handleChatResize} />
                <div
                  draggable={!zenMode}
                  onDragStart={(e) => handleDragStart(e, 'chat')}
                  onDragOver={(e) => handleDragOver(e, 'chat')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'chat')}
                  className={`flex-shrink-0 overflow-hidden transition-all duration-200 ${
                    dragOverSide === 'chat' ? 'ring-2 ring-[var(--color-secondary-accent)]/50 rounded-lg' : ''
                  }`}
                  style={{ width: chatMinimized ? 200 : chatWidth }}
                >
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

          {!zenMode && terminalVisible && (
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

      {!zenMode && <HyprStatusBar />}
    </main>
  );
}
