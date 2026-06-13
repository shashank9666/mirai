'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Type, Palette, Sparkles, Globe, Blocks, Eye, EyeOff, Puzzle, ImageIcon } from 'lucide-react';
import { useIdeStore, type EditorSettings } from '@/store/ideStore';
import { useAiStore } from '@/store/aiStore';
import { useSettingsStore } from '@/store/settingsStore';

import { api } from '@/lib/api';

type SettingsTab = 'editor' | 'theme' | 'ai' | 'extensions' | 'mcp' | 'general';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { editorSettings, setEditorSettings, extensions, setExtensions, notificationsEnabled, toggleNotifications } = useSettingsStore();
  const { aiProviders, activeAiProviderId, setAiProviderConfig, setActiveAiProvider } = useAiStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');
  const [settingsJson, setSettingsJson] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/settings/upload_bg', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.url) {
        setEditorSettings({ backgroundImage: data.url });
      }
    } catch (e) {
      console.error('Failed to upload image', e);
    }
  };
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.healthCheck().then(async (ok) => {
      if (ok) {
        const res = await fetch('http://127.0.0.1:8000/api/settings/load');
        const data = await res.json();
        if (data?.settings) setSettingsJson(data.settings);
      }
    }).catch(() => {});
  }, []);

  const saveSettings = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsJson }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'editor', label: 'Editor', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'theme', label: 'Theme', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'ai', label: 'AI Settings', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'extensions', label: 'Extensions', icon: <Puzzle className="w-3.5 h-3.5" /> },
    { id: 'mcp', label: 'MCP Servers', icon: <Blocks className="w-3.5 h-3.5" /> },
    { id: 'general', label: 'General', icon: <Globe className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-white/40" />
          <span className="text-[11px] font-mono text-white/60">Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveSettings}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] text-[10px] font-mono hover:bg-[var(--color-primary-accent)]/30 transition-colors"
          >
            <Save className="w-3 h-3" />
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-3 py-1.5 gap-1 border-b border-white/5 shrink-0">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1.5 transition-all ${
              activeTab === id
                ? 'bg-white/10 text-white'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {activeTab === 'editor' && <EditorSettings />}
        {activeTab === 'theme' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <SectionTitle>Editor Theme</SectionTitle>
              <div className="grid grid-cols-1 gap-3 max-w-xs">
                {['vs'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setEditorSettings({ theme: t })}
                    className={`p-3 border rounded-lg transition-colors flex flex-col items-center gap-2 ${
                      editorSettings.theme === t 
                        ? 'border-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/10' 
                        : 'border-white/10 hover:border-[var(--color-primary-accent)]/50 bg-white/5'
                    }`}
                  >
                    <div className="w-full h-12 rounded bg-black/50 shadow-inner flex items-center justify-center">
                      <span className="text-[10px] text-white/30">{t}</span>
                    </div>
                    <span className="text-[11px] font-mono text-white/70">{t}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>App Theme (Hyprland UI)</SectionTitle>
              <div className="grid grid-cols-4 gap-3">
                {['dark', 'glass', 'solid', 'light'].map((t) => (
                  <button 
                    key={t}
                    onClick={() => setEditorSettings({ appTheme: t as 'dark' | 'glass' | 'solid' | 'light' })}
                    className={`p-2 border rounded-lg transition-colors flex flex-col items-center gap-2 ${
                      editorSettings.appTheme === t 
                        ? 'border-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/10' 
                        : 'border-white/10 hover:border-[var(--color-primary-accent)]/50 bg-white/5'
                    }`}
                  >
                    <span className="text-[11px] font-mono text-white/70 capitalize">{t}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>Background Settings</SectionTitle>
              <div className="space-y-3">
                <div 
                  className="p-3 border border-white/10 border-dashed rounded-lg bg-white/5 flex flex-col gap-2 relative transition-colors hover:bg-white/10"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[var(--color-primary-accent)]'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-[var(--color-primary-accent)]'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-[var(--color-primary-accent)]');
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      uploadImage(file);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-white/40" />
                    <span className="text-[12px] font-mono text-white/80">Background Image</span>
                  </div>
                  
                  {editorSettings.backgroundImage ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="w-full h-24 rounded-md bg-cover bg-center border border-white/10" style={{ backgroundImage: `url(${editorSettings.backgroundImage})` }} />
                      <button 
                        onClick={() => setEditorSettings({ backgroundImage: null })}
                        className="w-full py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-[11px] font-mono transition-colors"
                      >
                        Delete Background
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mt-1">
                      <input 
                        type="text" 
                        value={editorSettings.backgroundImage || ''}
                        onChange={(e) => setEditorSettings({ backgroundImage: e.target.value })}
                        placeholder="Paste image URL here..." 
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50" 
                      />
                      <span className="text-[10px] font-mono text-white/40 text-center">OR</span>
                      <div className="relative overflow-hidden w-full">
                        <button className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[11px] font-mono text-white/70 transition-colors pointer-events-none">
                          Browse Local File (or Drag & Drop)
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              uploadImage(file);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 border border-white/10 rounded-lg bg-white/5 flex flex-col gap-2">
                  <span className="text-[12px] font-mono text-white/80">Background Opacity</span>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={editorSettings.backgroundOpacity}
                      onChange={(e) => setEditorSettings({ backgroundOpacity: parseFloat(e.target.value) })}
                      className="flex-1" 
                    />
                    <span className="text-[11px] font-mono text-white/60 w-8">{Math.round(editorSettings.backgroundOpacity * 100)}%</span>
                  </div>
                </div>

                <div className="p-3 border border-white/10 rounded-lg bg-white/5 flex flex-col gap-2">
                  <span className="text-[12px] font-mono text-white/80">Panel Opacity (Glass Effect)</span>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={editorSettings.panelOpacity ?? 0.6}
                      onChange={(e) => setEditorSettings({ panelOpacity: parseFloat(e.target.value) })}
                      className="flex-1" 
                    />
                    <span className="text-[11px] font-mono text-white/60 w-8">{Math.round((editorSettings.panelOpacity ?? 0.6) * 100)}%</span>
                  </div>
                </div>

                <div className="p-3 border border-white/10 rounded-lg bg-white/5 flex flex-col gap-2">
                  <span className="text-[12px] font-mono text-white/80">Panel Blur (Glass Effect)</span>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="0" max="64" step="1"
                      value={editorSettings.panelBlur ?? 16}
                      onChange={(e) => setEditorSettings({ panelBlur: parseInt(e.target.value) })}
                      className="flex-1" 
                    />
                    <span className="text-[11px] font-mono text-white/60 w-8">{editorSettings.panelBlur ?? 16}px</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>Accent Color</SectionTitle>
              <div className="p-3 border border-white/10 rounded-lg bg-white/5 flex flex-col gap-3">
                <div className="flex gap-2">
                  {['#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'].map(color => (
                    <button
                      key={color}
                      onClick={() => setEditorSettings({ accentColor: color })}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${editorSettings.accentColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <input 
                    type="color" 
                    value={editorSettings.accentColor || '#3b82f6'}
                    onChange={(e) => setEditorSettings({ accentColor: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <div className="flex-1">
                    <span className="text-[12px] font-mono text-white/80 block">Custom Primary Accent</span>
                    <span className="text-[10px] font-mono text-white/40 block">Changes the active color glow and highlights.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <SectionTitle>Default Model</SectionTitle>
              <div className="p-3 border border-white/10 rounded-lg bg-white/5 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-mono text-white/60">Active Provider</span>
                  <select 
                    value={activeAiProviderId || ''}
                    onChange={(e) => setActiveAiProvider(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50"
                  >
                    {aiProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>All Providers</SectionTitle>
              <div className="space-y-3">
                {aiProviders.map(p => (
                  <div key={p.id} className="p-3 border border-white/10 rounded-lg bg-white/5 flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-mono text-white/80 flex items-center gap-2">
                        {p.name}
                        {activeAiProviderId === p.id && <span className="text-[9px] bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] px-1.5 rounded">Active</span>}
                      </span>
                    </div>
                    {p.isCustom && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white/40 w-16">Base URL</span>
                        <input 
                          type="text" 
                          value={p.baseUrl} 
                          onChange={(e) => setAiProviderConfig(p.id, { baseUrl: e.target.value })}
                          placeholder="https://api..." 
                          className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50" 
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-white/40 w-16">API Key</span>
                      <div className="flex-1 relative">
                        <input 
                          type={showPasswords[p.id] ? "text" : "password"} 
                          value={p.apiKey}
                          onChange={(e) => setAiProviderConfig(p.id, { apiKey: e.target.value })}
                          placeholder="sk-..." 
                          className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50 pr-8" 
                        />
                        <button 
                          onClick={() => setShowPasswords(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                          {showPasswords[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-white/40 w-16">Model</span>
                      <input 
                        type="text" 
                        value={p.model}
                        onChange={(e) => setAiProviderConfig(p.id, { model: e.target.value })}
                        placeholder="Model name..." 
                        className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white/70 outline-none focus:border-[var(--color-primary-accent)]/50" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'extensions' && (
          <div className="space-y-4">
            <SectionTitle>Installed Extensions</SectionTitle>
            <div className="space-y-2">
              {extensions.map(ext => (
                <div key={ext.name} className="p-3 border border-white/10 rounded-lg bg-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-white/80">{ext.name}</span>
                      {ext.builtin && <span className="text-[9px] font-mono bg-white/10 text-white/40 px-1.5 rounded">built-in</span>}
                    </div>
                    <span className="text-[10px] font-mono text-white/40 block mt-0.5">{ext.desc}</span>
                  </div>
                  <button
                    onClick={() => setExtensions(prev => prev.map(e => e.name === ext.name ? { ...e, enabled: !e.enabled } : e))}
                    className={`w-8 h-4 rounded-full transition-colors relative ${ext.enabled ? 'bg-[var(--color-primary-accent)]/50' : 'bg-white/10'}`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${ext.enabled ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'mcp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
              <span className="text-[11px] font-mono text-white/40">Model Context Protocol (MCP) Servers</span>
              <button className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-mono text-white transition-colors">Add Server</button>
            </div>
            <div className="text-[11px] font-mono text-white/40 p-4 text-center border border-white/10 border-dashed rounded-lg">
              No MCP servers configured yet.
            </div>
          </div>
        )}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-white/30 border-b border-white/5 pb-1.5 mb-2">Application</div>
              <ToggleSetting label="Enable Global Notifications" value={notificationsEnabled} onChange={() => toggleNotifications()} />
            </div>
            
            <div className="space-y-3 mt-6">
              <div className="text-[11px] font-mono text-white/30 border-b border-white/5 pb-1.5 mb-2">Raw Settings JSON</div>
              <textarea
                value={settingsJson}
                onChange={(e) => setSettingsJson(e.target.value)}
                className="w-full h-64 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white/60 outline-none focus:border-[var(--color-primary-accent)]/40 resize-none"
                placeholder='{}'
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditorSettings() {
  const { editorSettings, setEditorSettings } = useSettingsStore();
  const s = editorSettings;

  return (
    <div className="space-y-4">
      <SectionTitle>Font</SectionTitle>
      <SliderSetting label="Font Size" value={s.fontSize} min={8} max={40} onChange={(v) => setEditorSettings({ fontSize: v })} />
      <SliderSetting label="Line Height" value={s.lineHeight} min={12} max={40} onChange={(v) => setEditorSettings({ lineHeight: v })} />
      <SliderSetting label="Tab Size" value={s.tabSize} min={1} max={8} onChange={(v) => setEditorSettings({ tabSize: v })} />

      <SectionTitle>Display</SectionTitle>
      <ToggleSetting label="Minimap" value={s.minimap} onChange={(v) => setEditorSettings({ minimap: v })} />
      <ToggleSetting label="Sticky Scroll" value={s.stickyScroll} onChange={(v) => setEditorSettings({ stickyScroll: v })} />
      <ToggleSetting label="Code Folding" value={s.folding} onChange={(v) => setEditorSettings({ folding: v })} />
      <ToggleSetting label="Word Wrap" value={s.wordWrap === 'on'} onChange={(v) => setEditorSettings({ wordWrap: v ? 'on' : 'off' })} />
      <ToggleSetting label="Bracket Pair Colorization" value={s.bracketPairColorization} onChange={(v) => setEditorSettings({ bracketPairColorization: v })} />
      <ToggleSetting label="Smooth Scrolling" value={s.smoothScrolling} onChange={(v) => setEditorSettings({ smoothScrolling: v })} />
      <ToggleSetting label="Render Indent Guides" value={s.showIndentGuides} onChange={(v) => setEditorSettings({ showIndentGuides: v })} />
      <ToggleSetting label="Render Whitespace" value={s.renderWhitespace !== 'none'} onChange={(v) => setEditorSettings({ renderWhitespace: v ? 'boundary' : 'none' })} />
      <ToggleSetting label="Mouse Wheel Zoom" value={s.mouseWheelZoom} onChange={(v) => setEditorSettings({ mouseWheelZoom: v })} />
      <ToggleSetting label="Explorer Indent Guides" value={s.explorerIndentGuides} onChange={(v) => setEditorSettings({ explorerIndentGuides: v })} />

      <SectionTitle>Behavior</SectionTitle>
      <ToggleSetting label="Auto Closing Brackets" value={s.autoClosingBrackets} onChange={(v) => setEditorSettings({ autoClosingBrackets: v })} />
      <ToggleSetting label="Auto Closing Quotes" value={s.autoClosingQuotes} onChange={(v) => setEditorSettings({ autoClosingQuotes: v })} />
      <ToggleSetting label="Format on Save" value={s.formatOnSave} onChange={(v) => setEditorSettings({ formatOnSave: v })} />
      <ToggleSetting label="Format on Paste" value={s.formatOnPaste} onChange={(v) => setEditorSettings({ formatOnPaste: v })} />
      <ToggleSetting label="Quick Suggestions" value={s.quickSuggestions} onChange={(v) => setEditorSettings({ quickSuggestions: v })} />
      <ToggleSetting label="Links" value={s.links} onChange={(v) => setEditorSettings({ links: v })} />
      <ToggleSetting label="Color Decorators" value={s.colorDecorators} onChange={(v) => setEditorSettings({ colorDecorators: v })} />
      <ToggleSetting label="Context Menu" value={s.contextmenu} onChange={(v) => setEditorSettings({ contextmenu: v })} />

      <SectionTitle>Cursor</SectionTitle>
      <div className="flex gap-2 flex-wrap">
        {(['line', 'block', 'underline'] as const).map(v => (
          <button key={v} onClick={() => setEditorSettings({ cursorStyle: v })}
            className={`px-3 py-1 rounded text-[10px] font-mono ${s.cursorStyle === v ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
            {v}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['blink', 'smooth', 'phase', 'expand', 'solid'] as const).map(v => (
          <button key={v} onClick={() => setEditorSettings({ cursorBlinking: v })}
            className={`px-3 py-1 rounded text-[10px] font-mono ${s.cursorBlinking === v ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-mono text-white/30 border-b border-white/5 pb-1 mb-1 mt-2 first:mt-0">{children}</div>
  );
}

function ToggleSetting({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded transition-colors">
      <span className="text-[11px] font-mono text-white/60">{label}</span>
      <div className={`w-7 h-3.5 rounded-full transition-all duration-200 relative ${value ? 'bg-[var(--color-primary-accent)]' : 'bg-white/15'}`}>
        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all duration-200 ${value ? 'left-3.5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}

function SliderSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 hover:bg-white/5 rounded transition-colors">
      <span className="text-[11px] font-mono text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[var(--color-primary-accent)]"
        />
        <span className="text-[10px] font-mono text-white/40 w-6 text-right">{value}</span>
      </div>
    </div>
  );
}
