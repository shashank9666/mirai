'use client';

import React, { useState } from 'react';
import PanelHeader from './PanelHeader';
import { Terminal as TerminalIcon, FileText, AlertTriangle, ListChecks, Bug } from 'lucide-react';

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

export default function HyprTerminal({ isPinned, isMinimized, onPin, onMinimize, onClose }: TerminalPanelProps) {
  const [activeTab, setActiveTab] = useState('terminal');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([
    { type: 'header', text: 'Mirai Agent Terminal v3.0' },
    { type: 'success', text: '✓ Connected to workspace' },
    { type: 'info', text: '→ ~/workspace $' },
  ]);

  const handleCommand = () => {
    if (!terminalInput.trim()) return;
    setTerminalHistory(prev => [
      ...prev,
      { type: 'input', text: `→ ~/workspace $ ${terminalInput}` },
      { type: 'output', text: `Command "${terminalInput}" — shell not connected yet.` },
    ]);
    setTerminalInput('');
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
        {/* Tab switcher */}
        <div className="flex gap-1 ml-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors
                ${activeTab === id 
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
          {/* Terminal output */}
          <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
            {terminalHistory.map((line, i) => (
              <div key={i} className={`leading-relaxed ${
                line.type === 'header' ? 'text-white/50' :
                line.type === 'success' ? 'text-green-400' :
                line.type === 'input' ? 'text-blue-300' :
                line.type === 'output' ? 'text-white/60' :
                'text-white/40'
              }`}>
                {line.text}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5 shrink-0">
            <span className="text-blue-400 text-[11px] font-mono shrink-0">→ $</span>
            <input
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
              placeholder="Enter command..."
              className="flex-1 bg-transparent border-none outline-none text-[11px] text-white/80 placeholder:text-white/20 font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}
