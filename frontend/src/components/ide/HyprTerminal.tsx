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
  Pin
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
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface TerminalTab {
  id: string;
  label: string;
  output: string[];
  status: ConnectionStatus;
  pinned: boolean;
}

function TerminalInstance({ tabId, tabOutput, tabStatus, onOutput, onStatusChange }: {
  tabId: string;
  tabOutput: string[];
  tabStatus: ConnectionStatus;
  onOutput: (termId: string, data: string) => void;
  onStatusChange: (termId: string, status: ConnectionStatus) => void;
}) {
  const outputRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    onStatusChange(tabId, 'connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) {
        onStatusChange(tabId, 'connected');
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
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
      if (mountedRef.current) {
        onStatusChange(tabId, 'disconnected');
      }
    };

    ws.onerror = () => {
      if (mountedRef.current) {
        onStatusChange(tabId, 'disconnected');
        onOutput(tabId, '\r\n[Error: Could not connect to terminal backend. Is the server running?]\r\n');
      }
    };

    return () => {
      mountedRef.current = false;
      if (wsRef.current) wsRef.current.close();
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
      </div>

    </div>
  );
}

export default function HyprTerminal({ isPinned, isMinimized, onPin, onMinimize, onClose }: TerminalPanelProps) {
  const tabCounterRef = useRef(2);

  const createTab = useCallback((counter: number): TerminalTab => {
    const id = `terminal-${counter}`;
    // E.g., 'bash' or 'powershell' (using a generic name for now)
    const label = `cmd ${counter}`;
    return { id, label, output: [], status: 'disconnected', pinned: false };
  }, []);

  const [activeBottomTab, setActiveBottomTab] = useState('terminal');
  const [terminals, setTerminals] = useState<TerminalTab[]>([{ id: 'terminal-1', label: 'cmd 1', output: [], status: 'disconnected', pinned: false }]);
  const [activeTermId, setActiveTermId] = useState<string>('terminal-1');
  const [showRetryBanner, setShowRetryBanner] = useState(false);

  const activeTerminal = terminals.find((t) => t.id === activeTermId) ?? terminals[0];

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

  const handleStatusChange = useCallback((termId: string, status: ConnectionStatus) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, status } : t)),
    );
    if (status === 'connected') setShowRetryBanner(false);
    if (status === 'disconnected') setShowRetryBanner(true);
  }, []);

  const addTerminal = () => {
    const tab = createTab(tabCounterRef.current);
    tabCounterRef.current += 1;
    setTerminals((prev) => [...prev, tab]);
    setActiveTermId(tab.id);
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
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden bg-[#1a1a2e]/40 backdrop-blur-md rounded-xl">
      {/* VS Code Style Header */}
      <div className="flex items-center justify-between px-3 h-9 shrink-0 select-none cursor-grab active:cursor-grabbing bg-white/5 border-b border-white/10">
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
            <div className="flex items-center gap-1 mr-2">
              <button onClick={addTerminal} className="p-1 rounded text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors" title="New Terminal">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 rounded text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors" title="Split Terminal">
                <SplitSquareHorizontal className="w-3.5 h-3.5" />
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
              <div className="flex-1 flex flex-col relative min-w-0">
                {activeTerminal && (
                  <TerminalInstance
                    key={activeTerminal.id}
                    tabId={activeTerminal.id}
                    tabOutput={activeTerminal.output}
                    tabStatus={activeTerminal.status}
                    onOutput={handleOutput}
                    onStatusChange={handleStatusChange}
                  />
                )}
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
