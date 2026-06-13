'use client';

import React, { useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { Download, Upload, RefreshCcw, Search, Palette } from 'lucide-react';

export default function ThemeEditor() {
  const { 
    availableThemes, 
    activeThemeId, 
    setActiveTheme, 
    userThemeOverrides,
    updateThemeOverride,
    exportTheme,
    importTheme,
    resetToDefaults,
    glassmorphism
  } = useThemeStore();

  const [search, setSearch] = useState('');

  const activeTheme = availableThemes.find(t => t.id === activeThemeId);
  const colorsToEdit = ['editor.background', 'editor.foreground', 'sideBar.background', 'activityBar.background', 'focusBorder', 'terminal.background'];

  const handleImport = () => {
    const json = prompt('Paste theme JSON here:');
    if (json) {
      importTheme(json);
    }
  };

  const handleExport = () => {
    const json = exportTheme();
    navigator.clipboard.writeText(json);
    alert('Theme JSON copied to clipboard!');
  };

  const filteredThemes = availableThemes.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto custom-scrollbar text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Palette className="w-6 h-6 text-[var(--color-primary-accent)]" />
            Theme Studio
          </h1>
          <p className="text-white/50 text-sm mt-1">Design and customize your IDE experience</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleImport} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={resetToDefaults} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm">
            <RefreshCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Theme Selection */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Available Themes</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text" 
                placeholder="Search themes..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-[var(--color-primary-accent)] transition-colors text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {filteredThemes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setActiveTheme(theme.id)}
                  className={`flex flex-col items-start p-3 rounded-xl border transition-all ${
                    activeThemeId === theme.id 
                      ? 'border-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/10 shadow-[0_0_20px_rgba(124,58,237,0.15)]' 
                      : 'border-white/10 hover:border-white/30 bg-black/20'
                  }`}
                >
                  <div className="flex w-full h-8 rounded-md overflow-hidden mb-3 border border-white/5">
                    <div className="flex-1" style={{ backgroundColor: theme.colors['editor.background'] }}></div>
                    <div className="w-8" style={{ backgroundColor: theme.colors['sideBar.background'] }}></div>
                    <div className="w-4" style={{ backgroundColor: theme.colors['activityBar.background'] }}></div>
                  </div>
                  <span className="text-sm font-medium text-white/90">{theme.name}</span>
                  <span className="text-xs text-white/40">{theme.type} mode</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Customization */}
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Live Customization</h2>
          
          <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-4">
            <h3 className="text-sm text-white/80 font-medium border-b border-white/5 pb-2">Core Colors</h3>
            <div className="grid grid-cols-1 gap-4">
              {colorsToEdit.map(key => {
                const effectiveValue = userThemeOverrides[key as keyof typeof userThemeOverrides] || activeTheme?.colors[key as keyof typeof activeTheme.colors] || '#000000';
                
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/60">{key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/30 uppercase">{effectiveValue}</span>
                      <input 
                        type="color" 
                        value={effectiveValue}
                        onChange={(e) => updateThemeOverride(key as any, e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
