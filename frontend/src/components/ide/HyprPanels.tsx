'use client';

import React, { useState, useEffect } from 'react';
import { Puzzle, Bot, Database, Bug, Zap, Plus, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useIdeStore } from '@/store/ideStore';

export function HyprExtensions() {
  const { extensions, setExtensions } = useIdeStore();

  const toggleExtension = (name: string) => {
    setExtensions((prev) =>
      prev.map((ext) => (ext.name === name ? { ...ext, enabled: !ext.enabled } : ext))
    );
  };

  const enabledCount = extensions.filter((e) => e.enabled).length;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0 flex items-center justify-between">
        <span>Extensions ({enabledCount}/{extensions.length})</span>
        <span title="Browse Extensions"><Plus className="w-3 h-3 text-white/30 hover:text-white/60 cursor-pointer" /></span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1">
        {extensions.map((ext) => (
          <div key={ext.name} className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-white/5 transition-colors group">
            <Puzzle className="w-4 h-4 text-white/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-white/70 truncate">{ext.name}</span>
                {ext.builtin && <span className="text-[8px] font-mono text-white/20 px-1 bg-white/5 rounded">built-in</span>}
              </div>
              <div className="text-[10px] font-mono text-white/25 truncate">{ext.desc}</div>
            </div>
            <button
              onClick={() => toggleExtension(ext.name)}
              className={`w-8 h-4 rounded-full transition-colors relative ${ext.enabled ? 'bg-[var(--color-primary-accent)]/50' : 'bg-white/10'}`}
            >
              <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${ext.enabled ? 'left-4.5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
        {extensions.length === 0 && (
          <div className="text-center py-8 text-[11px] font-mono text-white/20">No extensions installed</div>
        )}
      </div>
    </div>
  );
}

export function HyprAgent() {
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.listTasks().then((res) => {
      setSessions(res.tasks.map((t) => ({ id: t.id, name: t.command })));
    }).catch(() => {});
  }, []);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0 flex items-center justify-between">
        <span>Agent Tasks</span>
        <Bot className="w-3 h-3 text-white/30" />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
        <div className="text-[11px] font-mono text-white/30 mb-4">AI Agent Sessions</div>
        {sessions.length === 0 ? (
          <div className="text-[10px] font-mono text-white/20 italic">No active sessions</div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors">
                <Zap className="w-3 h-3 text-[var(--color-primary-accent)]/60" />
                <span className="text-[11px] font-mono text-white/55 truncate">{s.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 px-2 py-2 bg-white/5 rounded-lg">
          <div className="text-[10px] font-mono text-white/30">Agent tools: file read, file write, terminal, web search</div>
        </div>
      </div>
    </div>
  );
}

export function HyprDatabase() {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0 flex items-center justify-between">
        <span>Database</span>
        <Database className="w-3 h-3 text-white/30" />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
        <div className="text-[11px] font-mono text-white/30 mb-3">MCP Servers</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-mono text-white/55">sqlite</span>
            <span className="ml-auto text-[9px] font-mono text-white/25">connected</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-mono text-white/55">filesystem</span>
            <span className="ml-auto text-[9px] font-mono text-white/25">connected</span>
          </div>
        </div>
        <div className="mt-4 text-[10px] font-mono text-white/20">Add MCP servers in settings.json</div>
      </div>
    </div>
  );
}

export function HyprDebug() {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0 flex items-center justify-between">
        <span>Debug</span>
        <Bug className="w-3 h-3 text-white/30" />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
        <div className="text-[11px] font-mono text-white/30 mb-3">Launch Configurations</div>
        <div className="space-y-1">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-left">
            <Bug className="w-3 h-3 text-red-400/60" />
            <span className="text-[11px] font-mono text-white/55">Run Mirai Backend</span>
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-left">
            <Bug className="w-3 h-3 text-red-400/60" />
            <span className="text-[11px] font-mono text-white/55">Run Frontend Dev</span>
          </button>
        </div>
        <div className="mt-4 text-[10px] font-mono text-white/20">Configure in .vscode/launch.json</div>
      </div>
    </div>
  );
}

export function HyprAIProviders() {
  const { aiProviders, activeAiProviderId, setAiProviderConfig, setActiveAiProvider } = useIdeStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(activeAiProviderId || 'openai');
  const [prevActiveId, setPrevActiveId] = useState<string | null>(activeAiProviderId);
  const [showPassword, setShowPassword] = useState(false);

  // Sync selected provider if active changes externally
  if (activeAiProviderId !== prevActiveId) {
    setPrevActiveId(activeAiProviderId);
    if (activeAiProviderId) {
      setSelectedProviderId(activeAiProviderId);
    }
  }

  const selectedProvider = aiProviders.find(p => p.id === selectedProviderId) || aiProviders[0];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0 flex items-center justify-between">
        <span>AI Providers</span>
        <Zap className="w-3 h-3 text-[var(--color-primary-accent)]" />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-4">
        
        {/* Dropdown for selecting provider to configure */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Select Provider</label>
          <div className="relative">
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="w-full appearance-none bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] font-mono text-white/80 outline-none focus:border-[var(--color-primary-accent)]/50 cursor-pointer"
            >
              {aiProviders.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-mono text-white/90">{selectedProvider.name}</span>
            {activeAiProviderId === selectedProvider.id ? (
              <span className="text-[9px] font-mono bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] px-2 py-0.5 rounded border border-[var(--color-primary-accent)]/30">
                Active
              </span>
            ) : (
              <button
                onClick={() => setActiveAiProvider(selectedProvider.id)}
                className="text-[9px] font-mono bg-white/10 hover:bg-[var(--color-primary-accent)]/50 px-2 py-0.5 rounded text-white/80 transition-colors"
              >
                Set Active
              </button>
            )}
          </div>

          {selectedProvider.isCustom && (
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-white/40">Base URL</label>
              <input
                type="text"
                value={selectedProvider.baseUrl}
                onChange={(e) => setAiProviderConfig(selectedProvider.id, { baseUrl: e.target.value })}
                placeholder="https://api..."
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-mono text-white/40">API Key {selectedProvider.id === 'ollama' || selectedProvider.id === 'lmstudio' ? '(Optional)' : ''}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={selectedProvider.apiKey}
                onChange={(e) => setAiProviderConfig(selectedProvider.id, { apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50 pr-8"
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-mono text-white/40">Model</label>
            <input
              type="text"
              value={selectedProvider.model}
              onChange={(e) => setAiProviderConfig(selectedProvider.id, { model: e.target.value })}
              placeholder="gpt-4o, claude-3, etc."
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
