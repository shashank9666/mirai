'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PanelHeader from './PanelHeader';
import {
  Terminal as TerminalIcon,
  FileText,
  AlertTriangle,
  ListChecks,
  Bug,
  Plus,
  X,
  Pin,
  GripVertical,
} from 'lucide-react';

const WS_URL = 'ws://127.0.0.1:8000/ws/terminal';

const TABS = [
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { id: 'output', label: 'Output', icon: FileText },
  { id: 'problems', label: 'Problems', icon: AlertTriangle },
  { id: 'tasks', label: 'AI Tasks', icon: ListChecks },
  { id: 'debug', label: 'Debug', icon: Bug },
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

function TerminalInstance({ tab, onOutput, onStatusChange }: {
  tab: TerminalTab;
  onOutput: (data: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}) {
  const [input, setInput] = useState('');
  const [manualInput, setManualInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    onStatusChange('connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) {
        onStatusChange('connected');
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'terminal:data' && typeof msg.data === 'string') {
          onOutput(msg.data);
        }
      } catch {
        onOutput(event.data);
      }
    };

    ws.onclose = () => {
      if (mountedRef.current) {
        onStatusChange('disconnected');
      }
    };

    ws.onerror = () => {
      if (mountedRef.current) {
        onStatusChange('disconnected');
        onOutput('\r\n[Error: Could not connect to terminal backend. Is the server running?]\r\n');
      }
    };

    return () => {
      mountedRef.current = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [tab.output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!input || tab.status !== 'connected') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'terminal:write', data: input + '\n' }));
    }
    setInput('');
    inputRef.current?.focus();
  };

  const statusColor = tab.status === 'connected'
    ? 'bg-green-500'
    : tab.status === 'reconnecting' || tab.status === 'connecting'
    ? 'bg-yellow-500 animate-pulse'
    : 'bg-red-500';

  const statusText = tab.status === 'connected'
    ? 'Connected'
    : tab.status === 'connecting'
    ? 'Connecting...'
    : tab.status === 'reconnecting'
    ? 'Reconnecting...'
    : 'Disconnected';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={outputRef}
        className="flex-1 p-3 font-mono text-[11px] overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap break-all"
      >
        {tab.output.length === 0 && tab.status === 'connecting' && (
          <div className="text-white/30 animate-pulse">Connecting to terminal...</div>
        )}
        {tab.output.length === 0 && tab.status === 'disconnected' && (
          <div className="text-white/20">
            <div className="text-red-400/60 mb-2">Terminal disconnected</div>
            <div className="text-white/20 text-[10px]">Make sure the backend server is running on port 8000</div>
          </div>
        )}
        {tab.output.map((line, i) => (
          <div key={i} className="text-white/70">{line}</div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} title={statusText} />
        <span className="text-blue-400 text-[11px] font-mono shrink-0">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={tab.status === 'connected' ? 'Enter command...' : statusText}
          disabled={tab.status !== 'connected'}
          className="flex-1 bg-transparent border-none outline-none text-[11px] text-white/80 placeholder:text-white/20 font-mono disabled:opacity-40"
          autoFocus
        />
      </div>
    </div>
  );
}

export default function HyprTerminal({ isPinned, isMinimized, onPin, onMinimize, onClose }: TerminalPanelProps) {
  const tabCounterRef = useRef(1);

  const createTab = useCallback((): TerminalTab => {
    const id = `terminal-${tabCounterRef.current}`;
    const label = `Terminal ${tabCounterRef.current}`;
    tabCounterRef.current += 1;
    return { id, label, output: [], status: 'disconnected', pinned: false };
  }, []);

  const [activeBottomTab, setActiveBottomTab] = useState('terminal');
  const [terminals, setTerminals] = useState<TerminalTab[]>(() => [createTab()]);
  const [activeTermId, setActiveTermId] = useState<string>(() => '');
  const [showRetryBanner, setShowRetryBanner] = useState(false);

  // Set initial activeTermId after terminals is initialized
  useEffect(() => {
    if (!activeTermId && terminals.length > 0) {
      setActiveTermId(terminals[0].id);
    }
  }, [terminals, activeTermId]);

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
    const tab = createTab();
    setTerminals((prev) => [...prev, tab]);
    setActiveTermId(tab.id);
  };

  const closeTerminal = useCallback((termId: string) => {
    setTerminals((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((t) => t.id !== termId);
      return next;
    });
    setActiveTermId((prev) => {
      if (prev === termId) {
        const remaining = terminals.filter((t) => t.id !== termId);
        return remaining.length > 0 ? remaining[0].id : prev;
      }
      return prev;
    });
  }, [terminals]);

  const retryConnection = () => {
    setShowRetryBanner(false);
    const tab = createTab();
    setTerminals((prev) => [...prev, tab]);
    setActiveTermId(tab.id);
  };

  const dragTermIndex = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragTermIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragTermIndex.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    setTerminals((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    dragTermIndex.current = null;
  }, []);

  const togglePinTerminal = useCallback((termId: string) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, pinned: !t.pinned } : t)),
    );
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeBottomTab !== 'terminal') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        setActiveTermId((prev) => {
          const idx = terminals.findIndex((t) => t.id === prev);
          return terminals[(idx - 1 + terminals.length) % terminals.length].id;
        });
      } else if (mod && e.key === 'Tab') {
        e.preventDefault();
        setActiveTermId((prev) => {
          const idx = terminals.findIndex((t) => t.id === prev);
          return terminals[(idx + 1) % terminals.length].id;
        });
      } else if (mod && e.key === 'w' && terminals.length > 1) {
        e.preventDefault();
        closeTerminal(activeTermId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBottomTab, terminals, activeTermId, closeTerminal]);

  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
      <PanelHeader
        title="Terminal"
        isPinned={isPinned}
        isMinimized={isMinimized}
        onPin={onPin}
        onMinimize={onMinimize}
        onClose={onClose}
        accentColor="#3B82F6"
      >
        <div className="flex gap-1 ml-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveBottomTab(id)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors
                ${activeBottomTab === id
                  ? 'bg-white/10 text-white'
                  : 'text-white/30 hover:text-white/60'}`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </PanelHeader>

      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {showRetryBanner && (
            <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
              <span className="text-[10px] font-mono text-red-400">Cannot connect to terminal backend</span>
              <button onClick={retryConnection} className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors">
                Retry
              </button>
            </div>
          )}

          {activeBottomTab === 'terminal' && (
            <>
              <div className="flex items-center border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
                {terminals.map((t, idx) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => setActiveTermId(t.id)}
                    className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono cursor-pointer border-r border-white/5 transition-colors shrink-0
                      ${t.id === activeTermId
                        ? 'bg-white/5 text-white'
                        : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'}`}
                  >
                    <span className="text-white/20 hover:text-white/40 cursor-grab active:cursor-grabbing shrink-0">
                      <GripVertical className="w-2.5 h-2.5" />
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.status === 'connected' ? 'bg-green-500' : t.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-white/20'
                    }`} />
                    <span className="truncate max-w-[100px]">{t.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePinTerminal(t.id); }}
                      className={`p-0.5 rounded hover:bg-white/10 transition-colors shrink-0 ${
                        t.pinned ? 'text-[var(--color-primary-accent)]' : 'text-white/20 hover:text-white/60'
                      }`}
                      title={t.pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`w-2.5 h-2.5 ${t.pinned ? 'rotate-45' : ''}`} />
                    </button>
                    {terminals.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTerminal(t.id);
                        }}
                        className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/60 transition-colors shrink-0"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addTerminal}
                  className="px-2 py-1.5 text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors shrink-0"
                  title="New Terminal"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {activeTerminal && (
                <TerminalInstance
                  key={activeTerminal.id}
                  tab={activeTerminal}
                  onOutput={(data) => handleOutput(activeTerminal.id, data)}
                  onStatusChange={(status) => handleStatusChange(activeTerminal.id, status)}
                />
              )}
            </>
          )}

          {activeBottomTab === 'output' && (
            <div className="flex-1 p-3 font-mono text-[11px] text-white/40 overflow-y-auto custom-scrollbar">
              No output yet.
            </div>
          )}

          {activeBottomTab === 'problems' && (
            <div className="flex-1 p-3 font-mono text-[11px] text-white/40 overflow-y-auto custom-scrollbar">
              No problems detected.
            </div>
          )}

          {activeBottomTab === 'tasks' && (
            <div className="flex-1 p-3 font-mono text-[11px] text-white/40 overflow-y-auto custom-scrollbar">
              No active tasks.
            </div>
          )}

          {activeBottomTab === 'debug' && (
            <div className="flex-1 p-3 font-mono text-[11px] text-white/40 overflow-y-auto custom-scrollbar">
              No debug sessions.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
