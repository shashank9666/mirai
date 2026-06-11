'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PanelHeader from './PanelHeader';
import { useIdeStore } from '@/store/ideStore';
import { Send, Sparkles, Bot, Code2, Bug, Eye, Square, WifiOff, Mic, MicOff, Plus, ChevronDown, Paperclip, FileCode, TerminalSquare } from 'lucide-react';

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
  onDragStart?: (e: React.DragEvent) => void;
}

export default function HyprChat({ isPinned, isMinimized, onPin, onMinimize, onClose, onDragStart }: ChatPanelProps) {
  const { aiProviders, activeAiProviderId, setActiveAiProvider } = useIdeStore();
  const [activeMode, setActiveMode] = useState('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  // New states for voice, models, and actions
  const [isListening, setIsListening] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeModeObj = MODES.find((m) => m.id === activeMode)!;

  // Health check on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
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

  const toggleVoiceMode = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
    }
  }, [isListening]);

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
        onDragStart={onDragStart}
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
          <div className="flex px-2 py-1 gap-1 border-b border-white/5 shrink-0 overflow-visible justify-between items-center relative z-20">
            <div className="flex gap-1 overflow-x-auto custom-scrollbar flex-1">
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

            <div className="relative shrink-0 ml-2">
              <button 
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
              >
                <span className="max-w-[80px] truncate">{aiProviders.find(p => p.id === activeAiProviderId)?.name || 'Model'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModelMenu && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl py-1 z-50 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {aiProviders.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setActiveAiProvider(p.id); setShowModelMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[10px] font-mono ${p.id === activeAiProviderId ? 'text-white bg-white/10' : 'text-white/50 hover:bg-white/5'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <div className="p-2 border-t border-white/5 shrink-0 relative">
            {showActionMenu && (
              <div className="absolute bottom-full left-2 mb-2 w-48 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-1 z-50">
                <button onClick={() => setShowActionMenu(false)} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                  <Paperclip className="w-3.5 h-3.5 text-white/40" /> Upload Media
                </button>
                <button onClick={() => setShowActionMenu(false)} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                  <FileCode className="w-3.5 h-3.5 text-white/40" /> Add Context
                </button>
                <button onClick={() => setShowActionMenu(false)} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                  <TerminalSquare className="w-3.5 h-3.5 text-white/40" /> Action Commands
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-2 py-2 border border-white/5 focus-within:border-[var(--color-primary-accent)]/40 transition-colors relative z-20">
              <button 
                onClick={() => setShowActionMenu(!showActionMenu)}
                className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center transition-colors ${showActionMenu ? 'text-white bg-white/10' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
              >
                <Plus className="w-4 h-4" />
              </button>
              
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
                placeholder={backendAvailable === false ? 'Backend offline' : isListening ? 'Listening...' : 'Ask AI...'}
                disabled={isStreaming || backendAvailable === false}
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-white/90 placeholder:text-white/25 font-mono disabled:opacity-40"
              />
              
              <button
                onClick={toggleVoiceMode}
                title="Voice Dictation"
                className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center transition-colors ${isListening ? 'text-red-400 bg-red-400/20 animate-pulse' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
              >
                {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>

              {isStreaming ? (
                <button
                  onClick={stopGeneration}
                  className="w-6 h-6 rounded-lg bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-all shrink-0"
                >
                  <Square className="w-3 h-3 text-white" fill="white" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || backendAvailable === false}
                  className="w-6 h-6 rounded-lg bg-[var(--color-primary-accent)] flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 shrink-0"
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
