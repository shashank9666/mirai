'use client';

import React, { useState } from 'react';
import PanelHeader from './PanelHeader';
import { Send, Sparkles, Bot, Code2, Bug, Eye } from 'lucide-react';

const MODES = [
  { id: 'chat', label: 'Chat', icon: Sparkles },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'architect', label: 'Architect', icon: Code2 },
  { id: 'debugger', label: 'Debug', icon: Bug },
  { id: 'reviewer', label: 'Review', icon: Eye },
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
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "I'm ready! What shall we build next?" },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: `Processing: "${input}"... (AI backend not connected yet)` }]);
    }, 500);
  };

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
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_#a855f7] ml-auto" />
      </PanelHeader>

      {!isMinimized && (
        <>
          {/* Mode Tabs */}
          <div className="flex px-2 py-1 gap-1 border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveMode(id)}
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-[var(--color-primary-accent)]/20 text-white/90 rounded-br-sm' 
                    : 'bg-white/5 text-white/80 rounded-bl-sm border border-white/5'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-white/5 shrink-0">
            <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5 focus-within:border-[var(--color-primary-accent)]/40 transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask AI..."
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-white/90 placeholder:text-white/25 font-mono"
              />
              <button 
                onClick={handleSend}
                className="w-6 h-6 rounded-lg bg-[var(--color-primary-accent)] flex items-center justify-center hover:brightness-110 transition-all"
              >
                <Send className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
