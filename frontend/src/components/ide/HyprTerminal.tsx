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
  output: string[];
  status: ConnectionStatus;
  pinned: boolean;
  profile?: string;
}

function TerminalInstance({ tabId, tabOutput, tabStatus, tabProfile, onOutput, onStatusChange, onClear }: {
  tabId: string;
  tabOutput: string[];
  tabStatus: ConnectionStatus;
  tabProfile?: string;
  onOutput: (termId: string, data: string) => void;
  onStatusChange: (termId: string, status: ConnectionStatus) => void;
  onClear: (termId: string) => void;
}) {
  const outputRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    onStatusChange(tabId, 'connecting');

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
          onOutput(tabId, msg.data);
        }
      } catch {
        onOutput(tabId, event.data);
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
        onOutput(tabId, '\r\n[Error: Could not connect to terminal backend. Is the server running?]\r\n');
      }
    };

    return () => {
      mountedRef.current = false;
      if (wsRef.current === ws) {
        ws.close();
        wsRef.current = null;
      } else {
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [tabOutput]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      <div
        ref={outputRef}
        className="flex-1 p-3 font-mono text-[12px] overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap break-all"
      >
        {tabOutput.length === 0 && tabStatus === 'connecting' && (
          <div className="text-white/30 animate-pulse">Connecting to terminal...</div>
        )}
        {tabOutput.length === 0 && tabStatus === 'disconnected' && (
          <div className="text-white/20">
            <div className="text-red-400/60 mb-2">Terminal disconnected</div>
            <div className="text-white/20 text-[11px]">Make sure the backend server is running on port 8000</div>
          </div>
        )}
        {tabOutput.map((line, i) => (
          <div key={i} className="text-[#CCCCCC]">{line}</div>
        ))}
        {tabStatus === 'connected' && (
          <div className="flex items-center text-[#CCCCCC] mt-1">
            <span className="mr-2 text-green-400/80">❯</span>
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent outline-none border-none text-[#CCCCCC] font-mono text-[12px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value;
                  if (val.trim() === 'clear' || val.trim() === 'cls') {
                    onClear(tabId);
                    e.currentTarget.value = '';
                    return;
                  }
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ event: 'terminal:write', data: val + '\n' }));
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function HyprTerminal({ isPinned, isMinimized, onPin, onMinimize, onClose, onDragStart }: TerminalPanelProps) {
  const tabCounterRef = useRef(2);

  const createTab = useCallback((counter: number, profile?: string): TerminalTab => {
    const id = `terminal-${counter}`;
    const label = profile ? profile : `cmd`;
    return { id, label: `${label} ${counter}`, output: [], status: 'disconnected', pinned: false, profile };
  }, []);

  const [activeBottomTab, setActiveBottomTab] = useState('terminal');
  const [terminals, setTerminals] = useState<TerminalTab[]>([{ id: 'terminal-1', label: 'cmd 1', output: [], status: 'disconnected', pinned: false, profile: 'cmd' }]);
  const [activeTermId, setActiveTermId] = useState<string>('terminal-1');
  const [showRetryBanner, setShowRetryBanner] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(false);

  const handleOutput = useCallback((termId: string, data: string) => {
    setTerminals((prev) =>
      prev.map((t) => {
        if (t.id !== termId) return t;
        const lines = data.split('\n');
        const newOutput = [...t.output];
        if (newOutput.length > 0 && lines.length > 0) {
          newOutput[newOutput.length - 1] += lines[0];
          for (let i = 1; i < lines.length; i++) {
            newOutput.push(lines[i]);
          }
        } else {
          newOutput.push(...lines);
        }
        if (newOutput.length > 2000) {
          newOutput.splice(0, newOutput.length - 2000);
        }
        return { ...t, output: newOutput };
      }),
    );
  }, []);

  const handleClear = useCallback((termId: string) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, output: [] } : t)),
    );
  }, []);

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
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden bg-transparent rounded-xl">
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
                      tabOutput={t.output}
                      tabStatus={t.status}
                      tabProfile={t.profile}
                      onOutput={handleOutput}
                      onStatusChange={handleStatusChange}
                      onClear={handleClear}
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
