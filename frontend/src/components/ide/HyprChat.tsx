'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PanelHeader from './PanelHeader';
import { Send, Sparkles, Bot, Code2, Bug, Eye, Square, WifiOff } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Mode {
  id: string;
  label: string;
  icon: typeof Sparkles;
  systemPrompt: string;
}

const MODES: Mode[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: Sparkles,
    systemPrompt: 'You are a helpful general-purpose AI assistant. Answer questions clearly and concisely.',
  },
  {
    id: 'agent',
    label: 'Agent',
    icon: Bot,
    systemPrompt:
      'You are a coding agent. You can read, write, and modify files. When asked to change code, provide the exact file paths, full file contents, and explain every change.',
  },
  {
    id: 'architect',
    label: 'Architect',
    icon: Code2,
    systemPrompt:
      'You are a system architect. You design software systems, plan architecture, define APIs, and recommend tech stacks. Think about scalability, maintainability, and trade-offs.',
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: Bug,
    systemPrompt:
      'You are a debugging specialist. Analyze errors, trace root causes, suggest fixes, and explain what went wrong and why.',
  },
  {
    id: 'review',
    label: 'Review',
    icon: Eye,
    systemPrompt:
      'You are a code reviewer. Review code for quality, security, performance, and best practices. Point out issues and suggest improvements with concrete examples.',
  },
];

interface ChatPanelProps {
  isPinned: boolean;
  isMinimized: boolean;
  onPin: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export default function HyprChat({ isPinned, isMinimized, onPin, onMinimize, onClose }: ChatPanelProps) {
  const [activeMode, setActiveMode] = useState('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeModeObj = MODES.find((m) => m.id === activeMode)!;

  // Health check on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/docs', { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        setBackendAvailable(res.ok);
      } catch {
        setBackendAvailable(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    if (backendAvailable === false) {
      setError('Cannot connect to AI backend. Make sure the server is running on port 8000.');
      return;
    }

    setError(null);
    const userMessage: Message = { role: 'user', content: text };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: activeModeObj.systemPrompt },
            ...newMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          provider: 'openai',
          model: 'gpt-4o',
          apiKey: '',
          baseUrl: '',
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}${res.status === 500 ? ' - internal error' : ''}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'token' && event.content) {
              assistantMessage.content += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMessage };
                return updated;
              });
            } else if (event.type === 'final' && event.content) {
              assistantMessage.content = event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMessage };
                return updated;
              });
            } else if (event.type === 'error') {
              throw new Error(event.content || 'Unknown error from AI');
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant' && !last.content) {
            updated[updated.length - 1] = { role: 'assistant', content: '(Generation stopped)' };
          }
          return updated;
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to connect to AI backend';
        setError(msg);
        setMessages((prev) => prev.filter((_, i) => i < prev.length - 1));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const backendIndicator = backendAvailable === null
    ? 'bg-yellow-500 animate-pulse'
    : backendAvailable
    ? 'bg-green-500'
    : 'bg-red-500';

  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
      <PanelHeader
        title="AI Assistant"
        isPinned={isPinned}
        isMinimized={isMinimized}
        onPin={onPin}
        onMinimize={onMinimize}
        onClose={onClose}
        accentColor="#7C3AED"
      >
        <div className="flex items-center gap-2 ml-auto">
          <div className={`w-1.5 h-1.5 rounded-full ${backendIndicator}`} title={backendAvailable ? 'Backend connected' : backendAvailable === null ? 'Checking...' : 'Backend offline'} />
          {isStreaming && (
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_#a855f7]" />
          )}
        </div>
      </PanelHeader>

      {!isMinimized && (
        <>
          {/* Mode Tabs */}
          <div className="flex px-2 py-1 gap-1 border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setActiveMode(id); inputRef.current?.focus(); }}
                className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-1 transition-all whitespace-nowrap
                  ${activeMode === id
                    ? 'bg-[var(--color-primary-accent)]/20 text-purple-300'
                    : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* System Prompt */}
          <div className="px-3 py-1.5 text-[10px] text-white/25 font-mono border-b border-white/5 shrink-0 truncate">
            {activeModeObj.systemPrompt}
          </div>

          {/* Backend offline banner */}
          {backendAvailable === false && messages.length === 0 && (
            <div className="mx-3 mt-2 px-3 py-2 rounded-xl text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2">
              <WifiOff className="w-3 h-3 shrink-0" />
              <span>Backend server not available. AI features are disabled.</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
            {messages.length === 0 && !error && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[11px] text-white/20 font-mono">
                  {backendAvailable === false
                    ? 'Backend offline. Start the server to chat.'
                    : `Start a conversation in ${activeModeObj.label} mode...`}
                </p>
              </div>
            )}

            {error && (
              <div className="px-3 py-2 rounded-xl text-[11px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                {error}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] px-3 py-2 rounded-xl text-[12px] leading-relaxed font-mono whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-primary-accent)]/20 text-white/90 rounded-br-sm'
                      : 'bg-white/5 text-white/80 rounded-bl-sm border border-white/5'
                  }`}
                >
                  {msg.content}
                  {isStreaming && msg.role === 'assistant' && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-3 bg-purple-400/70 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-white/5 shrink-0">
            <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5 focus-within:border-[var(--color-primary-accent)]/40 transition-colors">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={backendAvailable === false ? 'Backend offline' : 'Ask AI...'}
                disabled={isStreaming || backendAvailable === false}
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-white/90 placeholder:text-white/25 font-mono disabled:opacity-40"
              />
              {isStreaming ? (
                <button
                  onClick={stopGeneration}
                  className="w-6 h-6 rounded-lg bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-all"
                >
                  <Square className="w-3 h-3 text-white" fill="white" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || backendAvailable === false}
                  className="w-6 h-6 rounded-lg bg-[var(--color-primary-accent)] flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30"
                >
                  <Send className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
