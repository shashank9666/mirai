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
} from 'lucide-react';

const WS_URL = 'ws://127.0.0.1:8000/ws/terminal';
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

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

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface TerminalTab {
  id: string;
  label: string;
  output: string[];
  status: ConnectionStatus;
}

let tabCounter = 1;

function createTab(): TerminalTab {
  return {
    id: `terminal-${tabCounter++}`,
    label: `Terminal ${tabCounter - 1}`,
    output: [],
    status: 'disconnected',
  };
}

function useTerminalWebSocket(
  tabId: string,
  onOutput: (data: string) => void,
  onStatusChange: (status: ConnectionStatus) => void,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(BASE_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const sendResize = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const el = containerRef.current;
    if (!el) return;
    const cols = Math.floor(el.clientWidth / 7);
    const rows = Math.floor(el.clientHeight / 16);
    if (cols > 0 && rows > 0) {
      wsRef.current.send(JSON.stringify({ event: 'terminal:resize', data: { cols, rows } }));
    }
  }, [containerRef]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        reconnectDelayRef.current = BASE_RECONNECT_DELAY;
        onStatusChange('connected');
        sendResize();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'terminal:data' && typeof msg.data === 'string') {
            onOutput(msg.data);
          }
        } catch {
          // Non-JSON message, treat as raw data
          onOutput(event.data);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        onStatusChange('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      onStatusChange('disconnected');
      scheduleReconnect();
    }
  }, [onOutput, onStatusChange, sendResize]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    onStatusChange('reconnecting');
    reconnectTimerRef.current = setTimeout(() => {
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_DELAY);
      connect();
    }, reconnectDelayRef.current);
  }, [connect, onStatusChange]);

  const sendInput = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'terminal:write', data: text }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { sendInput, sendResize };
}

function TerminalInstance({ tab, onOutput, onStatusChange, containerRef }: {
  tab: TerminalTab;
  onOutput: (data: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [input, setInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const { sendInput, sendResize } = useTerminalWebSocket(tab.id, onOutput, onStatusChange, containerRef);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [tab.output]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      sendResize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, sendResize]);

  const handleSubmit = () => {
    if (!input) return;
    sendInput(input + '\n');
    setInput('');
  };

  const statusColor = tab.status === 'connected'
    ? 'bg-green-500'
    : tab.status === 'reconnecting'
    ? 'bg-yellow-500 animate-pulse'
    : 'bg-red-500';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={(el) => {
          (outputRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="flex-1 p-3 font-mono text-[11px] overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap break-all"
      >
        {tab.output.length === 0 && (
          <div className="text-white/30">
            Connecting to terminal...
          </div>
        )}
        {tab.output.map((line, i) => (
          <div key={i} className="text-white/70">
            {line}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
        <span className="text-blue-400 text-[11px] font-mono shrink-0">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={tab.status === 'connected' ? 'Enter command...' : 'Waiting for connection...'}
          disabled={tab.status !== 'connected'}
          className="flex-1 bg-transparent border-none outline-none text-[11px] text-white/80 placeholder:text-white/20 font-mono disabled:opacity-40"
          autoFocus
        />
      </div>
    </div>
  );
}

export default function HyprTerminal({ isPinned, isMinimized, onPin, onMinimize, onClose }: TerminalPanelProps) {
  const [activeBottomTab, setActiveBottomTab] = useState('terminal');
  const [terminals, setTerminals] = useState<TerminalTab[]>(() => [createTab()]);
  const [activeTermId, setActiveTermId] = useState<string>(() => terminals[0].id);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, []);

  const addTerminal = () => {
    const tab = createTab();
    setTerminals((prev) => [...prev, tab]);
    setActiveTermId(tab.id);
  };

  const closeTerminal = (termId: string) => {
    setTerminals((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((t) => t.id !== termId);
      if (activeTermId === termId) {
        setActiveTermId(next[0].id);
      }
      return next;
    });
  };

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
          {activeBottomTab === 'terminal' && (
            <>
              {/* Terminal tab bar */}
              <div className="flex items-center border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
                {terminals.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setActiveTermId(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono cursor-pointer border-r border-white/5 transition-colors shrink-0
                      ${t.id === activeTermId
                        ? 'bg-white/5 text-white'
                        : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      t.status === 'connected' ? 'bg-green-500' : t.status === 'reconnecting' ? 'bg-yellow-500' : 'bg-white/20'
                    }`} />
                    <span>{t.label}</span>
                    {terminals.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTerminal(t.id);
                        }}
                        className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/60 transition-colors"
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

              {/* Active terminal */}
              {activeTerminal && (
                <TerminalInstance
                  key={activeTerminal.id}
                  tab={activeTerminal}
                  onOutput={(data) => handleOutput(activeTerminal.id, data)}
                  onStatusChange={(status) => handleStatusChange(activeTerminal.id, status)}
                  containerRef={containerRef}
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
