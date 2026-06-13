'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { HyprExtensions, HyprAgent, HyprDatabase, HyprDebug, HyprAIProviders } from '@/components/ide/HyprPanels';
import { useIdeStore } from '@/store/ideStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useEditorStore } from '@/store/editorStore';
import { NotificationManager } from '@/components/ide/NotificationManager';

import { useThemeStore } from '@/store/themeStore';
import { builtinThemes } from '@/lib/themes';
function SidebarContent({ activeView, isMinimized, onMinimize, onClose, onDragStart }: { activeView: string; isMinimized?: boolean; onMinimize?: () => void; onClose?: () => void; onDragStart?: (e: React.DragEvent) => void }) {
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
    case 'ai-providers':
      return <HyprAIProviders />;
    case 'debug':
      return <HyprDebug />;
    case 'explorer':
    default:
      return <HyprSidebar isMinimized={isMinimized} onMinimize={onMinimize} onClose={onClose} onDragStart={onDragStart} />;
  }
}

export default function Home() {

  const [activeView, setActiveView] = useState('explorer');
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const [chatVisible, setChatVisible] = useState(true);
  const [chatPinned, setChatPinned] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  const [terminalVisible, setTerminalVisible] = useState(true);
  const [terminalPinned, setTerminalPinned] = useState(false);
  const [terminalMinimized, setTerminalMinimized] = useState(false);

  const [editorVisible, setEditorVisible] = useState(true);
  const [editorMinimized, setEditorMinimized] = useState(false);

  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { zenMode, fullscreenMode, toggleZenMode, toggleFullscreenMode, editorSettings, zoom, setZoom } = useSettingsStore();
  const { workspacePath, setWorkspace } = useWorkspaceStore();
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
    useThemeStore.getState().registerThemes(builtinThemes);

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

  const handleViewChange = useCallback((view: string) => {
    if (view === 'settings') {
      setActiveView('settings');
      setSidebarVisible(true);
      return;
    }
    if (activeView === view) {
      setSidebarVisible(v => !v);
    } else {
      setActiveView(view);
      setSidebarVisible(true);
    }
  }, [activeView]);

  const handleShowSettings = () => {
    setShowSettingsModal(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(Math.min(2.0, useSettingsStore.getState().zoom + 0.1));
      }
      if (mod && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setZoom(Math.max(0.5, useSettingsStore.getState().zoom - 0.1));
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        setZoom(0.7);
      }
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
  }, [zenMode, toggleZenMode, toggleFullscreenMode, handleViewChange, setZoom]);

  useEffect(() => {
    const handleCommand = (e: CustomEvent) => {
      const cmd = e.detail?.command;
      if (cmd === 'toggleTerminal') setTerminalVisible(v => !v);
      else if (cmd === 'toggleSidebar') setSidebarVisible(v => !v);
      else if (cmd === 'toggleChat') setChatVisible(v => !v);
      else if (cmd === 'toggleEditor') setEditorVisible(v => !v);
      else if (cmd?.startsWith('view:')) handleViewChange(cmd.slice(5));
      else if (cmd === 'toggleZenMode') toggleZenMode();
      else if (cmd === 'toggleFullscreen') toggleFullscreenMode();
      else if (cmd === 'toggleWordWrap') useSettingsStore.getState().toggleWordWrap();
      else if (cmd === 'toggleMinimap') useSettingsStore.getState().toggleMinimap();
      else if (cmd === 'toggleStickyScroll') useSettingsStore.getState().toggleStickyScroll();
      else if (cmd === 'toggleFormatOnSave') useSettingsStore.getState().toggleFormatOnSave();
      else if (cmd === 'toggleBracketColorization') useSettingsStore.getState().toggleBracketPairColorization();
      else if (cmd === 'toggleFolding') useSettingsStore.getState().toggleFolding();
      else if (cmd === 'zoomIn') setZoom(Math.min(2.0, useSettingsStore.getState().zoom + 0.1));
      else if (cmd === 'zoomOut') setZoom(Math.max(0.1, useSettingsStore.getState().zoom - 0.1));
      else if (cmd === 'resetZoom') {
        setZoom(0.7);
      }
      else if (cmd === 'splitHorizontal') useEditorStore.getState().addGroup('horizontal');
      else if (cmd === 'splitVertical') useEditorStore.getState().addGroup('vertical');

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
  }, [toggleZenMode, toggleFullscreenMode, activeView, handleViewChange, workspacePath, setZoom]);

  useEffect(() => {
    if (fullscreenMode) {
      document.documentElement.requestFullscreen?.().catch(() => { });
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => { });
    }
  }, [fullscreenMode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenMode) {
        useSettingsStore.getState().toggleFullscreenMode();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [fullscreenMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary-accent', editorSettings.accentColor || '#7C3AED');
    document.documentElement.style.setProperty(
      '--bg-image',
      editorSettings.backgroundImage ? `url(${editorSettings.backgroundImage})` : (editorSettings.wallpaperPreset && editorSettings.wallpaperPreset !== 'none' ? `url(/wallpapers/${editorSettings.wallpaperPreset}.svg)` : 'none')
    );

    const theme = editorSettings.appTheme || 'glass';
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }

    const blurVal = editorSettings.panelBlur ?? 16;
    let bg = `rgba(26, 26, 46, ${editorSettings.panelOpacity ?? 0.6})`;
    if (theme === 'solid') bg = '#1a1a2e';
    if (theme === 'dark') bg = '#050505';
    if (theme === 'light') bg = '#f8fafc';
    document.documentElement.style.setProperty('--panel-bg', bg);
    document.documentElement.style.setProperty('--panel-backdrop', theme === 'glass' ? `blur(${blurVal}px)` : 'none');

    document.documentElement.style.setProperty('--app-zoom', zoom !== 1.0 ? `scale(${zoom})` : 'none');
    document.documentElement.style.setProperty('--app-width', zoom !== 1.0 ? `${100 / zoom}vw` : '100vw');
    document.documentElement.style.setProperty('--app-height', zoom !== 1.0 ? `${100 / zoom}vh` : '100vh');
  }, [editorSettings, zoom]);



  return (
    <div className="shrink-0 overflow-hidden flex flex-col relative bg-transparent text-[var(--foreground)] selection:bg-[var(--color-primary-accent)]/30"
      style={{
        backgroundImage: 'var(--bg-image, none)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transform: 'var(--app-zoom, none)',
        transformOrigin: 'top left',
        width: 'var(--app-width, 100vw)',
        height: 'var(--app-height, 100vh)',
      }}
    >
      {editorSettings.backgroundImage && (
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundColor: `rgba(5,5,5,${1 - editorSettings.backgroundOpacity})` }} />
      )}

      <div className="relative z-10 flex flex-col w-full flex-1 min-h-0">
        <NotificationManager />
        <CommandPalette />
        <QuickOpen />

        {!zenMode && <Waybar />}

        <div className={`flex-1 flex min-h-0 ${!zenMode ? 'mb-8' : ''}`}>
          {!zenMode && <ActivityBar activeView={activeView} onViewChange={handleViewChange} onShowSettings={handleShowSettings} />}

          <div className={`flex-1 flex min-h-0 ${!zenMode ? 'p-2' : ''}`}>
          <div className={`flex-1 flex min-h-0 w-full ${!zenMode ? 'gap-2' : ''}`}>
              {/* Sidebar */}
              {(!zenMode && sidebarVisible) && (
                  <div
                    className={`w-72 flex-shrink-0 overflow-hidden flex flex-col transition-all duration-200 ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg' : ''}`}
                    style={{ backgroundColor: 'var(--panel-bg, rgba(26, 26, 46, 0.6))', backdropFilter: 'var(--panel-backdrop, blur(16px))' }}
                  >
                    <SidebarContent
                      activeView={activeView}
                      isMinimized={sidebarMinimized}
                      onMinimize={() => setSidebarMinimized(m => !m)}
                      onClose={() => setSidebarVisible(false)}
                    />
                  </div>
              )}

              {/* Center (Editor + Terminal) */}
              {editorVisible && (
                <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${!zenMode ? 'gap-2' : ''}`}>
                    <div className={`flex-1 min-h-0 flex flex-col transition-all duration-200 ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg' : ''}`} style={{ backgroundColor: 'var(--panel-bg, rgba(26, 26, 46, 0.6))', backdropFilter: 'var(--panel-backdrop, blur(16px))' }}>
                      <div className={`flex-1 min-h-0 flex flex-col ${editorMinimized ? 'hidden' : 'flex'}`}>
                        {hasWorkspace && !showWelcome && <EditorToolbar />}
                        {showWelcome || !hasWorkspace ? (
                          <WelcomeScreen onWorkspaceOpened={() => setWelcomeOverride({ show: false, forWorkspace: workspacePath })} />
                        ) : (
                          <HyprEditor
                            isMinimized={editorMinimized}
                            onMinimize={() => setEditorMinimized(m => !m)}
                            onClose={() => setEditorVisible(false)}
                          />
                        )}
                      </div>
                    </div>

                    {(!zenMode && terminalVisible) && (
                        <div
                          className={`h-64 flex-shrink-0 overflow-hidden flex flex-col transition-all duration-200 ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg' : ''}`}
                          style={{ backgroundColor: 'var(--panel-bg, rgba(26, 26, 46, 0.6))', backdropFilter: 'var(--panel-backdrop, blur(16px))' }}
                        >
                          <HyprTerminal
                            isPinned={terminalPinned}
                            isMinimized={terminalMinimized}
                            onPin={() => setTerminalPinned(p => !p)}
                            onMinimize={() => setTerminalMinimized(m => !m)}
                            onClose={() => setTerminalVisible(false)}
                          />
                        </div>
                    )}
                </div>
              )}

              {/* Chat */}
              {(!zenMode && chatVisible) && (
                  <div
                    className={`w-[350px] flex-shrink-0 overflow-hidden flex flex-col transition-all duration-200 ${!zenMode ? 'rounded-xl border border-white/10 shadow-lg' : ''}`}
                    style={{ backgroundColor: 'var(--panel-bg, rgba(26, 26, 46, 0.6))', backdropFilter: 'var(--panel-backdrop, blur(16px))' }}
                  >
                    <HyprChat
                      isPinned={chatPinned}
                      isMinimized={chatMinimized}
                      onPin={() => setChatPinned(p => !p)}
                      onMinimize={() => setChatMinimized(m => !m)}
                      onClose={() => setChatVisible(false)}
                    />
                  </div>
              )}
            </div>
          </div>
        </div>

        {!zenMode && (
          <div className="absolute bottom-0 left-0 w-full z-50">
            <HyprStatusBar />
          </div>
        )}
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[80vw] h-[80vh] max-w-5xl rounded-xl border border-white/10 shadow-2xl bg-[var(--bg-color)] overflow-hidden flex flex-col">
            <SettingsPanel onClose={() => setShowSettingsModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
