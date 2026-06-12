'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Trash2,
  SplitSquareHorizontal,
  ChevronDown,
  Maximize2,
  Pin,
  Columns2
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const WS_URL = 'ws://127.0.0.1:8000/ws/terminal';

const MAIN_TABS = [
  { id: 'problems', label: 'PROBLEMS' },
  { id: 'output', label: 'OUTPUT' },
  { id: 'debug', label: 'DEBUG CONSOLE' },
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'tasks', label: 'AI TASKS' },
];

interface TerminalPanelProps {
  isPinned: boolean;
  isMinimized: boolean;
  onPin: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface TerminalTab {
  id: string;
  label: string;
  status: ConnectionStatus;
  pinned: boolean;
  profile?: string;
}

function TerminalInstance({ tabId, tabStatus, tabProfile, onStatusChange }: {
  tabId: string;
  tabStatus: ConnectionStatus;
  tabProfile?: string;
  onStatusChange: (termId: string, status: ConnectionStatus) => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    onStatusChange(tabId, 'connecting');

    // Initialize xterm
    const term = new Terminal({
      theme: {
        background: 'transparent',
        foreground: '#CCCCCC',
        cursor: '#4DAAF1'
      },
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      cursorBlink: true,
      allowProposedApi: true
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    if (terminalRef.current) {
      term.open(terminalRef.current);
      // Let it render before fitting
      setTimeout(() => {
        if (mountedRef.current) fitAddon.fit();
      }, 50);
    }
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const url = tabProfile ? `${WS_URL}?shell=${tabProfile}` : WS_URL;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current && wsRef.current === ws) {
        onStatusChange(tabId, 'connected');
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current || wsRef.current !== ws) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'terminal:data' && typeof msg.data === 'string') {
          term.write(msg.data);
        }
      } catch {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      if (mountedRef.current && wsRef.current === ws) {
        onStatusChange(tabId, 'disconnected');
      }
    };

    ws.onerror = () => {
      if (mountedRef.current && wsRef.current === ws) {
        onStatusChange(tabId, 'disconnected');
        term.write('\r\n[Error: Could not connect to terminal backend. Is the server running?]\r\n');
      }
    };

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'terminal:write', data }));
      }
    });

    const handleResize = () => {
      if (mountedRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => handleResize());
    if (terminalRef.current) {
      observer.observe(terminalRef.current);
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (wsRef.current === ws) {
        ws.close();
        wsRef.current = null;
      } else {
        ws.close();
      }
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent p-2">
      {tabStatus === 'connecting' && (
        <div className="absolute top-2 left-2 text-white/30 animate-pulse text-[12px] font-mono z-10">Connecting to terminal...</div>
      )}
      {tabStatus === 'disconnected' && (
        <div className="absolute top-2 left-2 text-white/20 z-10">
          <div className="text-red-400/60 mb-2 text-[12px]">Terminal disconnected</div>
        </div>
      )}
      <div ref={terminalRef} className="flex-1 overflow-hidden w-full h-full" />
    </div>
  );
}

export default function HyprTerminal({ isPinned, isMinimized, onPin, onMinimize, onClose, onDragStart }: TerminalPanelProps) {
  const tabCounterRef = useRef(2);

  const createTab = useCallback((counter: number, profile?: string): TerminalTab => {
    const id = `terminal-${counter}`;
    const label = profile ? profile : `cmd`;
    return { id, label: `${label} ${counter}`, status: 'disconnected', pinned: false, profile };
  }, []);

  const [activeBottomTab, setActiveBottomTab] = useState('terminal');
  const [terminals, setTerminals] = useState<TerminalTab[]>([{ id: 'terminal-1', label: 'cmd 1', status: 'disconnected', pinned: false, profile: 'cmd' }]);
  const [activeTermId, setActiveTermId] = useState<string>('terminal-1');
  const [showRetryBanner, setShowRetryBanner] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(false);

  // Removed unused handleOutput and handleClear logic since xterm.js handles its own buffer

  const handleStatusChange = useCallback((termId: string, status: ConnectionStatus) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, status } : t)),
    );
    if (status === 'connected') setShowRetryBanner(false);
    if (status === 'disconnected') setShowRetryBanner(true);
  }, []);

  const addTerminal = (profile?: string) => {
    const tab = createTab(tabCounterRef.current, profile);
    tabCounterRef.current += 1;
    setTerminals((prev) => [...prev, tab]);
    setActiveTermId(tab.id);
    setShowProfileMenu(false);
  };

  const closeTerminal = useCallback((termId: string) => {
    setTerminals((prev) => {
      if (prev.length <= 1) {
        // If last terminal is closed, create a new one to replace it
        const newTab = createTab(tabCounterRef.current);
        tabCounterRef.current += 1;
        setActiveTermId(newTab.id);
        return [newTab];
      }
      return prev.filter((t) => t.id !== termId);
    });

    setActiveTermId((prev) => {
      if (prev === termId) {
        const remaining = terminals.filter((t) => t.id !== termId);
        return remaining.length > 0 ? remaining[0].id : prev;
      }
      return prev;
    });
  }, [terminals, createTab]);

  const retryConnection = () => {
    setShowRetryBanner(false);
    const tab = createTab(tabCounterRef.current);
    tabCounterRef.current += 1;
    setTerminals((prev) => [...prev, tab]);
    setActiveTermId(tab.id);
  };

  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden rounded-xl">
      {/* VS Code Style Header */}
      <div 
        draggable
        onDragStart={onDragStart}
        className="flex items-center justify-between px-3 h-9 shrink-0 select-none cursor-grab active:cursor-grabbing bg-white/5 border-b border-white/10"
      >
        <div className="flex items-center gap-5 h-full">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveBottomTab(tab.id)}
              className={`h-full text-[11px] font-sans tracking-wide flex items-center border-b-[2px] transition-colors mt-[2px] ${activeBottomTab === tab.id
                  ? 'border-[var(--color-primary-accent)] text-white font-medium'
                  : 'border-transparent text-white/50 hover:text-white/80'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions Toolbar */}
        <div className="flex items-center gap-1.5 ml-2">
          {activeBottomTab === 'terminal' && (
            <div className="flex items-center gap-1 mr-2 relative">
              <button onClick={() => addTerminal('cmd')} className="p-1 rounded text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors" title="New Terminal">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="p-1 rounded text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors" title="Select Terminal Profile">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              
              {showProfileMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1e2e] border border-white/10 shadow-xl rounded-md py-1 z-50">
                  <div className="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider font-semibold border-b border-white/5 mb-1">
                    Select Profile
                  </div>
                  <button onClick={() => addTerminal('powershell')} className="w-full text-left px-3 py-1.5 text-[12px] text-[#CCCCCC] hover:bg-white/10 hover:text-white transition-colors">
                    PowerShell
                  </button>
                  <button onClick={() => addTerminal('cmd')} className="w-full text-left px-3 py-1.5 text-[12px] text-[#CCCCCC] hover:bg-white/10 hover:text-white transition-colors">
                    Command Prompt (Default)
                  </button>
                  <button onClick={() => addTerminal('bash')} className="w-full text-left px-3 py-1.5 text-[12px] text-[#CCCCCC] hover:bg-white/10 hover:text-white transition-colors">
                    Git Bash
                  </button>
                </div>
              )}
              
              <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
              
              <button onClick={() => { if (!isSplitMode) setIsSplitMode(true); addTerminal(); }} className="p-1 rounded text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors" title="Split Terminal">
                <SplitSquareHorizontal className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsSplitMode(!isSplitMode)} className={`p-1 rounded transition-colors ${isSplitMode ? 'text-white bg-[var(--color-primary-accent)]/30' : 'text-[#CCCCCC] hover:text-white hover:bg-white/10'}`} title="Toggle Split View">
                <Columns2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => closeTerminal(activeTermId)} className="p-1 rounded text-[#CCCCCC] hover:text-red-400 hover:bg-white/10 transition-colors" title="Kill Terminal">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-0.5">
            {onPin && (
              <button
                onClick={onPin}
                className={`p-1 rounded hover:bg-white/10 transition-colors ${isPinned ? 'text-[#4DAAF1]' : 'text-[#CCCCCC] hover:text-white'}`}
                title={isPinned ? 'Unpin' : 'Pin'}
              >
                <Pin className="w-3.5 h-3.5" style={isPinned ? { transform: 'rotate(45deg)' } : undefined} />
              </button>
            )}
            <button onClick={onMinimize} className="p-1 rounded text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors" title="Minimize Panel">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={onMinimize} className="p-1 rounded text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors" title="Maximize Panel">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1 rounded text-[#CCCCCC] hover:text-red-400 hover:bg-red-500/20 transition-colors" title="Close Panel">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex overflow-hidden bg-transparent">
          {showRetryBanner && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-md bg-[#5A1D1D] border border-red-500/20 flex items-center gap-3 shadow-lg">
              <span className="text-[11px] font-sans text-red-200">Cannot connect to terminal backend</span>
              <button onClick={retryConnection} className="text-[11px] font-sans px-2 py-0.5 rounded bg-white/10 text-white hover:bg-white/20 transition-colors">
                Retry
              </button>
            </div>
          )}

          {activeBottomTab === 'terminal' && (
            <>
              {/* Terminal Instance */}
              {/* Terminal Instances */}
              <div className="flex-1 flex flex-row relative min-w-0">
                {terminals.map((t, i) => (
                  <div 
                    key={t.id} 
                    className={`flex-1 flex flex-col min-w-0 ${i > 0 && isSplitMode ? 'border-l border-white/10' : ''}`}
                    style={{ display: !isSplitMode && t.id !== activeTermId ? 'none' : 'flex' }}
                  >
                    <TerminalInstance
                      tabId={t.id}
                      tabStatus={t.status}
                      tabProfile={t.profile}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                ))}
              </div>

              {/* Terminal Sidebar (Right) */}
              <div className="w-[200px] border-l border-white/5 bg-black/20 flex flex-col py-2 overflow-y-auto custom-scrollbar shrink-0">
                {terminals.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setActiveTermId(t.id)}
                    className={`flex items-center justify-between px-4 py-1 cursor-pointer group transition-colors ${t.id === activeTermId
                        ? 'bg-[#37373D] text-white'
                        : 'text-[#CCCCCC] hover:bg-[#2A2D2E]'
                      }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <TerminalIcon className="w-4 h-4 shrink-0 text-[#CCCCCC]" />
                      <span className="text-[12px] font-sans truncate">{t.label}</span>
                    </div>
                    {/* Icons on hover */}
                    <div className={`flex items-center gap-1 shrink-0 ml-2 ${t.id === activeTermId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
                        className="p-1 rounded-md hover:bg-white/10 text-[#CCCCCC] hover:text-white transition-colors"
                        title="Kill Terminal"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeBottomTab === 'output' && (
            <div className="flex-1 p-3 font-mono text-[12px] text-[#CCCCCC] overflow-y-auto custom-scrollbar">
              No output yet.
            </div>
          )}

          {activeBottomTab === 'problems' && (
            <div className="flex-1 p-3 font-mono text-[12px] text-[#CCCCCC] overflow-y-auto custom-scrollbar">
              No problems have been detected in the workspace.
            </div>
          )}

          {activeBottomTab === 'tasks' && (
            <div className="flex-1 p-3 font-mono text-[12px] text-[#CCCCCC] overflow-y-auto custom-scrollbar">
              No AI tasks are currently running.
            </div>
          )}

          {activeBottomTab === 'debug' && (
            <div className="flex-1 p-3 font-mono text-[12px] text-[#CCCCCC] overflow-y-auto custom-scrollbar">
              No active debug sessions.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
