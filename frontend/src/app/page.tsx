'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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

  const [panelOrderList, setPanelOrderList] = useState<string[]>(['sidebar', 'editor', 'chat']);
  const [dragOverSide, setDragOverSide] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { zenMode, fullscreenMode, toggleZenMode, toggleFullscreenMode, workspacePath, setWorkspace } = useIdeStore();
  const hasWorkspace = !!workspacePath;
  const [welcomeOverride, setWelcomeOverride] = useState<{ show: boolean; forWorkspace: string | null } | null>(null);
  const showWelcome = useMemo(() => {
    if (welcomeOverride !== null && welcomeOverride.forWorkspace === workspacePath) {
      return welcomeOverride.show;
    }
    return !workspacePath;
  }, [welcomeOverride, workspacePath]);

  // On mount, wait for backend to be ready then restore last workspace
  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const tryConnect = async (attempt = 0) => {
      if (cancelled) return;

      // First check if backend is healthy
      try {
        const healthRes = await fetch('http://127.0.0.1:8000/health', { signal: AbortSignal.timeout(2000) });
        if (!healthRes.ok) throw new Error('Backend not healthy');
      } catch {
        // Backend not ready yet, retry with backoff (max ~5s delay)
        if (attempt < 30) {
          const delay = Math.min(1000 * Math.pow(1.2, attempt), 5000);
          retryTimeout = setTimeout(() => tryConnect(attempt + 1), delay);
          return;
        }
        // Give up after 30 attempts
        console.error('Backend never became available');
        return;
      }

      // Backend is ready, restore workspace
      const lastWorkspace = localStorage.getItem('miraiLastWorkspace');
      if (lastWorkspace && !cancelled) {
        try {
          const res = await fetch('http://127.0.0.1:8000/api/workspace/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: lastWorkspace }),
          });
          const result = await res.json();
          if (result?.path && !cancelled) {
            setWorkspace(result.path, result.name);
          }
        } catch (err) {
          console.error('Failed to restore workspace:', err);
        }
      }
    };

    tryConnect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
    };
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

  const handleViewChange = useCallback((view: string) => {
    if (view === 'settings') {
      setActiveView('settings');
      setSidebarVisible(true);
      return;
    }
    setActiveView(prev => {
      if (prev === view) {
        setSidebarVisible(v => !v);
        return prev;
      }
      setSidebarVisible(true);
      return view;
    });
  }, []);

  const handleShowSettings = () => {
    setShowSettingsModal(true);
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
  }, [zenMode, toggleZenMode, toggleFullscreenMode, handleViewChange]);

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
        setWelcomeOverride({ show: true, forWorkspace: workspacePath });
      } else if (cmd === 'closeSettings') {
        setShowSettingsModal(false);
      }
    };
    window.addEventListener('ide:command', handleCommand as EventListener);
    return () => window.removeEventListener('ide:command', handleCommand as EventListener);
  }, [toggleZenMode, toggleFullscreenMode, activeView, handleViewChange, workspacePath]);

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
    if (source && source !== target) {
      setPanelOrderList((prev) => {
        const newOrder = [...prev];
        const sourceIdx = newOrder.indexOf(source);
        const targetIdx = newOrder.indexOf(target);
        if (sourceIdx !== -1 && targetIdx !== -1) {
          newOrder[sourceIdx] = target;
          newOrder[targetIdx] = source;
        }
        return newOrder;
      });
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, panel: string) => {
    e.dataTransfer.setData('text/panel', panel);
    e.dataTransfer.effectAllowed = 'move';
  }, []);



  return (
    <main className={`h-screen w-screen flex flex-col overflow-hidden text-[var(--color-text-normal)] select-none transition-all duration-300 ${zenMode ? 'bg-black' : ''}`} style={{ backgroundColor: zenMode ? 'black' : 'var(--background)' }}>
      <CommandPalette />
      <QuickOpen />

      {!zenMode && <Waybar />}

      <div className="flex-1 flex min-h-0">
        {!zenMode && <ActivityBar activeView={activeView} onViewChange={handleViewChange} onShowSettings={handleShowSettings} />}

        <div className={`flex-1 flex flex-col min-h-0 ${!zenMode ? 'gap-2 p-2' : ''}`}>
          <div className={`flex-1 flex min-h-0 ${!zenMode ? 'gap-2' : ''}`}>
            {!zenMode && sidebarVisible && (
              <>
                <div
                  draggable={!zenMode}
                  onDragStart={(e) => handleDragStart(e, 'sidebar')}
                  onDragOver={(e) => handleDragOver(e, 'sidebar')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'sidebar')}
                  className={`flex-shrink-0 overflow-hidden transition-all duration-200 ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg' : ''} ${
                    dragOverSide === 'sidebar' ? 'ring-2 ring-[var(--color-primary-accent)]/50' : ''
                  }`}
                  style={{ width: sidebarWidth, order: panelOrderList.indexOf('sidebar') }}
                >
                  <SidebarContent activeView={activeView} />
                </div>
                {panelOrderList.indexOf('sidebar') !== 2 && <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />}
              </>
            )}

            <div 
              draggable={!zenMode}
              onDragStart={(e) => handleDragStart(e, 'editor')}
              onDragOver={(e) => handleDragOver(e, 'editor')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'editor')}
              className={`flex-1 min-w-0 overflow-hidden flex flex-col transition-all duration-200 ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg' : ''} ${
                dragOverSide === 'editor' ? 'ring-2 ring-[var(--color-primary-accent)]/50' : ''
              }`}
              style={{ order: panelOrderList.indexOf('editor') }}
            >
              {hasWorkspace && !showWelcome && <EditorToolbar />}
              <div className="flex-1 min-h-0">
                {showWelcome || !hasWorkspace ? (
                  <WelcomeScreen onWorkspaceOpened={() => setWelcomeOverride({ show: false, forWorkspace: workspacePath })} />
                ) : (
                  <HyprEditor />
                )}
              </div>
            </div>

            {!zenMode && chatVisible && (
              <>
                {panelOrderList.indexOf('chat') !== 0 && <ResizeHandle direction="horizontal" onResize={(delta) => handleChatResize(-delta)} />}
                <div
                  draggable={!zenMode}
                  onDragStart={(e) => handleDragStart(e, 'chat')}
                  onDragOver={(e) => handleDragOver(e, 'chat')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'chat')}
                  className={`flex-shrink-0 overflow-hidden transition-all duration-200 ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg' : ''} ${
                    dragOverSide === 'chat' ? 'ring-2 ring-[var(--color-secondary-accent)]/50' : ''
                  }`}
                  style={{ width: chatMinimized ? 200 : chatWidth, order: panelOrderList.indexOf('chat') }}
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
              <div 
                className={`flex-shrink-0 overflow-hidden ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg mx-2 mb-2' : ''}`} 
                style={{ height: terminalMinimized ? 36 : terminalHeight }}
              >
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

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[80vw] h-[80vh] max-w-5xl rounded-xl border border-white/10 shadow-2xl bg-[#1e1e2e] overflow-hidden flex flex-col">
            <SettingsPanel onClose={() => setShowSettingsModal(false)} />
          </div>
        </div>
      )}
    </main>
  );
}
