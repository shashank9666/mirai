'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIdeStore } from '@/store/ideStore';
import {
  FolderOpen,
  ArrowLeftRight,
  Terminal,
  X,
  Minus,
  Square,
  Maximize2,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  MousePointerSquareDashed,
  Eye,
  Search,
  Hash,
  Play,
  HelpCircle
} from 'lucide-react';

function truncatePath(path: string | null) {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  if (parts.length > 3) {
    return `.../${parts.slice(-2).join('/')}`;
  }
  return path;
}

export default function Waybar() {
  const { getActiveGroup, clearWorkspace, workspaceName, workspacePath } = useIdeStore();
  const activeFile = getActiveGroup()?.activeFile || null;
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
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
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const workspaceLabel = workspaceName || 'No Workspace';

  const menuConfig = [
    {
      id: 'file',
      label: 'File',
      items: [
        { label: 'Open Folder', icon: <FolderOpen className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'openFolder' } })) },
        { label: 'Switch Workspace', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'openFolder' } })) },
        ...(workspacePath ? [{ label: 'Close Workspace', icon: <X className="w-3.5 h-3.5" />, action: () => clearWorkspace() }] : []),
        { divider: true },
        { label: 'New Terminal', shortcut: 'Ctrl+`', icon: <Terminal className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleTerminal' } })) }
      ]
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', icon: <Undo2 className="w-3.5 h-3.5" />, action: () => document.execCommand('undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', icon: <Redo2 className="w-3.5 h-3.5" />, action: () => document.execCommand('redo') },
        { divider: true },
        { label: 'Cut', shortcut: 'Ctrl+X', icon: <Scissors className="w-3.5 h-3.5" />, action: () => document.execCommand('cut') },
        { label: 'Copy', shortcut: 'Ctrl+C', icon: <Copy className="w-3.5 h-3.5" />, action: () => document.execCommand('copy') },
        {
          label: 'Paste', shortcut: 'Ctrl+V', icon: <Clipboard className="w-3.5 h-3.5" />, action: () => navigator.clipboard.readText().then(text => {
            const activeEl = document.activeElement as HTMLTextAreaElement | HTMLInputElement;
            if (activeEl && ('value' in activeEl)) {
              const start = activeEl.selectionStart || 0;
              const end = activeEl.selectionEnd || 0;
              activeEl.value = activeEl.value.substring(0, start) + text + activeEl.value.substring(end);
            }
          }).catch(() => { })
        }
      ]
    },
    {
      id: 'selection',
      label: 'Selection',
      items: [
        {
          label: 'Select All', shortcut: 'Ctrl+A', icon: <MousePointerSquareDashed className="w-3.5 h-3.5" />, action: () => {
            const activeEl = document.activeElement as HTMLTextAreaElement | HTMLInputElement;
            if (activeEl && typeof activeEl.select === 'function') {
              activeEl.select();
            }
          }
        }
      ]
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', icon: <Eye className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleSidebar' } })) },
        { label: 'Toggle Editor', shortcut: 'Ctrl+E', icon: <Square className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleEditor' } })) },
        { label: 'Toggle Terminal', shortcut: 'Ctrl+`', icon: <Terminal className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleTerminal' } })) },
        { label: 'Toggle Chat', shortcut: 'Ctrl+J', icon: <Play className="w-3.5 h-3.5" rotate={90} />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleChat' } })) },
        { divider: true },
        { label: 'Zen Mode', shortcut: 'Esc', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleZenMode' } })) },
        { label: 'Fullscreen', shortcut: 'F11', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleFullscreen' } })) },
        { divider: true },
        { label: 'Zoom In', shortcut: 'Ctrl+=', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'increaseFontSize' } })) },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'decreaseFontSize' } })) },
        { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'resetFontSize' } })) }
      ]
    },
    {
      id: 'go',
      label: 'Go',
      items: [
        { label: 'Go to File', shortcut: 'Ctrl+P', icon: <Search className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'openQuickOpen' } })) },
        { label: 'Go to Line', shortcut: 'Ctrl+G', icon: <Hash className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'openCommandPalette' } })) }
      ]
    },
    {
      id: 'run',
      label: 'Run',
      items: [
        { label: 'Split Horizontal', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'splitHorizontal' } })) },
        { label: 'Split Vertical', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'splitVertical' } })) },
        { label: 'Close Active Editor Group', action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'closeGroup' } })) }
      ]
    },
    {
      id: 'terminal',
      label: 'Terminal',
      items: [
        { label: 'New Terminal', shortcut: 'Ctrl+`', icon: <Terminal className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleTerminal' } })) }
      ]
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { label: 'Documentation', icon: <HelpCircle className="w-3.5 h-3.5" />, action: () => window.open('https://github.com/shashank9666/mirai', '_blank') },
        { label: 'About Mirai', action: () => alert('Mirai IDE - v1.0.0\nAI-powered development environment.') }
      ]
    }
  ];

  type MenuItem = { label?: string; shortcut?: string; icon?: React.ReactNode; action?: () => void; divider?: boolean };

  return (
    <div className="h-10 w-full px-4 flex items-center justify-between text-xs font-mono select-none shrink-0" style={{ background: 'var(--panel-bg, linear-gradient(90deg, rgba(124,58,237,0.08) 0%, rgba(59,130,246,0.08) 100%))', backdropFilter: 'var(--panel-backdrop, blur(16px))', borderBottom: '1px solid rgba(255,255,255,0.06)', WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left side */}
      <div className="flex items-center h-full gap-4 text-white/80">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[var(--color-primary-accent)] to-[var(--color-secondary-accent)] flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)]">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <span className="text-white/60 tracking-wide font-semibold">{workspaceLabel}</span>
        </div>

        {/* Menu Bar */}
        <div className="flex items-center gap-1 relative" ref={menuRef} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {menuConfig.map((menu) => {
            const isOpen = activeMenu === menu.id;
            return (
              <div key={menu.id} className="relative">
                <button
                  onClick={() => setActiveMenu(isOpen ? null : menu.id)}
                  onMouseEnter={() => {
                    if (activeMenu !== null) {
                      setActiveMenu(menu.id);
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors text-[11px] font-sans ${isOpen
                      ? 'bg-white/10 text-white font-semibold shadow-[0_0_8px_rgba(255,255,255,0.08)]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {menu.label}
                </button>
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-1.5 overflow-hidden">
                    {menu.items.map((item: MenuItem, index: number) => {
                      if ('divider' in item) {
                        return <div key={index} className="border-t border-white/5 my-1" />;
                      }
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setActiveMenu(null);
                            item.action?.();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          {item.icon && <span className="text-white/30">{item.icon}</span>}
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.shortcut && <span className="text-[9px] text-white/20 font-sans">{item.shortcut}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Active File Breadcrumb */}
        <div className="text-white/40 truncate max-w-[300px]">{truncatePath(activeFile)}</div>
      </div>

      {/* Right side */}
      <div className="flex items-center h-full gap-4 text-white/50">
        <button onClick={() => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleEditor' } }))} className="hover:text-white hover:bg-white/10 px-2 py-0.5 rounded transition-colors" title="Toggle Editor">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
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
