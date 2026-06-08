'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Type, Palette, Sparkles, Globe, Braces, Pilcrow } from 'lucide-react';
import { useIdeStore, type EditorSettings } from '@/store/ideStore';
import { api } from '@/lib/api';

type SettingsTab = 'editor' | 'ai' | 'general';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');
  const [settingsJson, setSettingsJson] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

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
    { id: 'ai', label: 'AI', icon: <Sparkles className="w-3.5 h-3.5" /> },
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
        {activeTab === 'ai' && (
          <div className="text-[11px] font-mono text-white/40 p-4 text-center">
            AI settings coming soon
          </div>
        )}
        {activeTab === 'general' && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-white/30 border-b border-white/5 pb-1.5 mb-2">Raw Settings JSON</div>
            <textarea
              value={settingsJson}
              onChange={(e) => setSettingsJson(e.target.value)}
              className="w-full h-64 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white/60 outline-none focus:border-[var(--color-primary-accent)]/40 resize-none"
              placeholder='{}'
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EditorSettings() {
  const { editorSettings, setEditorSettings } = useIdeStore();
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
