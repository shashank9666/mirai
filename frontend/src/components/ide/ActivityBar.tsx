'use client';

import React from 'react';
import { Files, Search, GitBranch, Blocks, Bot, Database, Settings, Bug, Sparkles, Monitor } from 'lucide-react';

interface ActivityBarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onShowSettings: () => void;
}

const VIEWS = [
  { id: 'explorer', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'extensions', icon: Blocks, label: 'Extensions' },
  { id: 'agent', icon: Bot, label: 'AI Agent Tasks' },
  { id: 'ai-providers', icon: Sparkles, label: 'AI Providers' },
  { id: 'database', icon: Database, label: 'Database Explorer' },
  { id: 'debug', icon: Bug, label: 'Debugger' },
];

export default function ActivityBar({ activeView, onViewChange, onShowSettings }: ActivityBarProps) {
  return (
    <div className="w-[48px] h-full flex flex-col items-center py-2 gap-1 shrink-0"
      style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Top icons */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {VIEWS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            title={label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative
              ${activeView === id 
                ? 'bg-[var(--color-primary-accent)]/20 text-white shadow-[0_0_12px_rgba(124,58,237,0.2)]' 
                : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
          >
            {activeView === id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--color-primary-accent)] rounded-r-full" />
            )}
            <Icon className="w-[18px] h-[18px]" />
          </button>
        ))}
      </div>

      {/* Bottom Icons */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'toggleEditor' } }))}
          title="Toggle Editor"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-white/30 hover:text-white/70 hover:bg-white/5"
        >
          <Monitor className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onShowSettings}
          title="Settings"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
            ${activeView === 'settings'
              ? 'bg-[var(--color-primary-accent)]/20 text-white'
              : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
}
