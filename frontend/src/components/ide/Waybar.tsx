'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIdeStore } from '@/store/ideStore';
import { FolderOpen, ChevronDown, History, ArrowLeftRight, Terminal, Sparkles, X, Minus, Square, Maximize2 } from 'lucide-react';

export default function Waybar() {
  const { getActiveGroup, setWorkspace, clearWorkspace } = useIdeStore();
  const activeFile = getActiveGroup()?.activeFile || null;
  const { workspaceName, workspacePath } = useIdeStore();
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.isMaximized().then(setIsMaximized);
    api.onMaximizeChange(setIsMaximized);
    return () => api.removeMaximizeListener();
  }, []);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimize();
  }, []);

  const handleMaximize = useCallback(() => {
    window.electronAPI?.maximize();
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.close();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) setShowFileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const truncatePath = (path: string | null) => {
    if (!path) return 'No File Open';
    const parts = path.replace(/\\/g, '/').split('/');
    if (parts.length > 4) return '.../' + parts.slice(-3).join('/');
    return path;
  };

  const workspaceLabel = workspaceName || 'No Workspace';

  return (
    <div className="h-10 w-full px-4 flex items-center justify-between text-xs font-mono select-none shrink-0" style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.08) 0%, rgba(59,130,246,0.08) 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left side */}
      <div className="flex items-center h-full gap-4 text-white/80">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[var(--color-primary-accent)] to-[var(--color-secondary-accent)] flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)]">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span className="text-white/60 tracking-wide font-semibold">{workspaceLabel}</span>
        </div>

        {/* File Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors"
          >
            File <ChevronDown className="w-3 h-3" />
          </button>
          {showFileMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 overflow-hidden">
              <MenuButton
                icon={<FolderOpen className="w-3.5 h-3.5" />}
                label="Open Folder"
                shortcut={workspacePath ? workspacePath.split(/[\\/]/).pop() || '' : ''}
                onClick={() => {
                  setShowFileMenu(false);
                  window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'openFolder' } }));
                }}
              />
              <MenuButton
                icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
                label="Switch Workspace"
                onClick={() => {
                  setShowFileMenu(false);
                  window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'openFolder' } }));
                }}
              />
              {workspacePath && (
                <MenuButton
                  icon={<X className="w-3.5 h-3.5" />}
                  label="Close Workspace"
                  onClick={() => {
                    setShowFileMenu(false);
                    clearWorkspace();
                  }}
                />
              )}
              <div className="border-t border-white/5 my-1" />
              <MenuButton
                icon={<Terminal className="w-3.5 h-3.5" />}
                label="New Terminal"
                shortcut="Ctrl+`"
                onClick={() => {
                  setShowFileMenu(false);
                  window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleTerminal' } }));
                }}
              />
            </div>
          )}
        </div>

        {/* Active File Breadcrumb */}
        <div className="text-white/40 truncate max-w-[300px]">{truncatePath(activeFile)}</div>
      </div>

      {/* Right side */}
      <div className="flex items-center h-full gap-4 text-white/50">
        <button className="hover:text-white hover:bg-white/10 px-2 py-0.5 rounded transition-colors" title="Notifications">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>

        <div className="flex items-center h-full" style={{ 'WebkitAppRegion': 'no-drag' } as React.CSSProperties}>
          <button onClick={handleMinimize} className="h-full px-3 flex items-center hover:bg-white/10 transition-colors text-white/40 hover:text-white" title="Minimize">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleMaximize} className="h-full px-3 flex items-center hover:bg-white/10 transition-colors text-white/40 hover:text-white" title={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleClose} className="h-full px-3 flex items-center hover:bg-red-500 hover:text-white transition-colors text-white/40" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon, label, shortcut, onClick }: { icon: React.ReactNode; label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors"
    >
      <span className="text-white/30">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[9px] text-white/20">{shortcut}</span>}
    </button>
  );
}
