'use client';

import React, { useState } from 'react';
import {
  Maximize2, Minimize2, Columns2, Rows2, WrapText, Map,
  Pin, MousePointer2, Braces, Pilcrow, Settings,
  Undo2, Redo2,
} from 'lucide-react';
import { useIdeStore, type EditorSettings } from '@/store/ideStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useEditorStore } from '@/store/editorStore';


function ToolbarButton({
  active,
  onClick,
  title,
  children,
  size = 'sm',
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center rounded transition-all duration-150 ${
        size === 'sm' ? 'w-6 h-6 text-[11px]' : 'w-7 h-7 text-xs'
      } ${
        active
          ? 'bg-white/15 text-white'
          : 'text-white/40 hover:text-white/80 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-white/10 mx-1" />;
}

export default function EditorToolbar() {
  const { editorSettings, zenMode, toggleZenMode, toggleWordWrap, toggleMinimap, toggleStickyScroll, toggleFormatOnSave, toggleBracketPairColorization, toggleFolding, increaseFontSize, decreaseFontSize, resetFontSize, toggleMouseWheelZoom } = useSettingsStore();
  const { addGroup, setSplitDirection, splitDirection } = useEditorStore();

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const s = editorSettings;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-[#0a0a0a]/30 border-b border-white/5">
      {/* Zen Mode */}
      <ToolbarButton active={zenMode} onClick={toggleZenMode} title="Toggle Zen Mode (Ctrl+K Z)">
        {zenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </ToolbarButton>

      <ToolbarDivider />

      {/* Undo/Redo */}
      <ToolbarButton onClick={() => (window as any).__miraiEditor?.trigger('keyboard', 'undo', null)} title="Undo (Ctrl+Z)">
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => (window as any).__miraiEditor?.trigger('keyboard', 'redo', null)} title="Redo (Ctrl+Y)">
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Word Wrap */}
      <ToolbarButton active={s.wordWrap === 'on'} onClick={toggleWordWrap} title="Toggle Word Wrap (Alt+Z)">
        <WrapText className="w-3.5 h-3.5" />
      </ToolbarButton>

      {/* Minimap */}
      <ToolbarButton active={s.minimap} onClick={toggleMinimap} title="Toggle Minimap">
        <Map className="w-3.5 h-3.5" />
      </ToolbarButton>

      {/* Sticky Scroll */}
      <ToolbarButton active={s.stickyScroll} onClick={toggleStickyScroll} title="Toggle Sticky Scroll">
        <Pin className="w-3.5 h-3.5" />
      </ToolbarButton>

      {/* Folding */}
      <ToolbarButton active={s.folding} onClick={toggleFolding} title="Toggle Code Folding">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h2v2H2V3zm4 0h8v2H6V3zM2 7h2v2H2V7zm4 0h8v2H6V7zm-4 4h2v2H2v-2zm4 0h8v2H6v-2z" opacity="0.8"/>
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Font Size */}
      <ToolbarButton onClick={decreaseFontSize} title="Decrease Font Size (Ctrl+-)">
        <span className="text-[10px] font-mono">A-</span>
      </ToolbarButton>
      <span className="text-[10px] font-mono text-white/40 w-6 text-center cursor-pointer" onClick={resetFontSize} title="Reset Font Size (Ctrl+0)">
        {s.fontSize}
      </span>
      <ToolbarButton onClick={increaseFontSize} title="Increase Font Size (Ctrl+=)">
        <span className="text-[10px] font-mono">A+</span>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Mouse Wheel Zoom */}
      <ToolbarButton active={s.mouseWheelZoom} onClick={toggleMouseWheelZoom} title="Mouse Wheel Zoom">
        <MousePointer2 className="w-3.5 h-3.5" />
      </ToolbarButton>

      {/* Format on Save */}
      <ToolbarButton active={s.formatOnSave} onClick={toggleFormatOnSave} title="Format on Save">
        <Pilcrow className="w-3.5 h-3.5" />
      </ToolbarButton>

      {/* Bracket Pair Colorization */}
      <ToolbarButton active={s.bracketPairColorization} onClick={toggleBracketPairColorization} title="Bracket Pair Colorization">
        <Braces className="w-3.5 h-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Split Editor */}
      <ToolbarButton onClick={() => addGroup('horizontal')} title="Split Editor Right (Ctrl+\)">
        <Columns2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => addGroup('vertical')} title="Split Editor Down">
        <Rows2 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* More Settings Dropdown */}
      <div className="relative">
        <ToolbarButton active={showSettingsMenu} onClick={() => setShowSettingsMenu(!showSettingsMenu)} title="Editor Settings">
          <Settings className="w-3.5 h-3.5" />
        </ToolbarButton>

        {showSettingsMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSettingsMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-2 overflow-y-auto max-h-96 custom-scrollbar">
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider px-2 py-1.5">Editor Settings</div>

              <SettingsItem label="Font Size" value={`${s.fontSize}px`}>
                <div className="flex items-center gap-1">
                  <button onClick={decreaseFontSize} className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-white/50 text-[10px]">-</button>
                  <button onClick={increaseFontSize} className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-white/50 text-[10px]">+</button>
                </div>
              </SettingsItem>

              <SettingsItem label="Line Height" value={`${s.lineHeight}px`}>
                <div className="flex items-center gap-1">
                  <button onClick={() => useSettingsStore.getState().setEditorSettings({ lineHeight: Math.max(12, s.lineHeight - 2) })} className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-white/50 text-[10px]">-</button>
                  <button onClick={() => useSettingsStore.getState().setEditorSettings({ lineHeight: Math.min(40, s.lineHeight + 2) })} className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-white/50 text-[10px]">+</button>
                </div>
              </SettingsItem>

              <SettingsItem label="Tab Size" value={`${s.tabSize}`}>
                <div className="flex items-center gap-1">
                  {[2, 4, 8].map(v => (
                    <button key={v} onClick={() => useSettingsStore.getState().setEditorSettings({ tabSize: v })}
                      className={`w-5 h-5 rounded text-[10px] ${s.tabSize === v ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </SettingsItem>

              <SettingsToggle label="Word Wrap" active={s.wordWrap === 'on'} onClick={toggleWordWrap} />
              <SettingsToggle label="Minimap" active={s.minimap} onClick={toggleMinimap} />
              <SettingsToggle label="Sticky Scroll" active={s.stickyScroll} onClick={toggleStickyScroll} />
              <SettingsToggle label="Code Folding" active={s.folding} onClick={toggleFolding} />
              <SettingsToggle label="Format on Save" active={s.formatOnSave} onClick={toggleFormatOnSave} />
              <SettingsToggle label="Bracket Colorization" active={s.bracketPairColorization} onClick={toggleBracketPairColorization} />
              <SettingsToggle label="Mouse Wheel Zoom" active={s.mouseWheelZoom} onClick={toggleMouseWheelZoom} />
              <SettingsToggle label="Auto Closing Brackets" active={s.autoClosingBrackets}
                onClick={() => useSettingsStore.getState().setEditorSettings({ autoClosingBrackets: !s.autoClosingBrackets })} />
              <SettingsToggle label="Auto Closing Quotes" active={s.autoClosingQuotes}
                onClick={() => useSettingsStore.getState().setEditorSettings({ autoClosingQuotes: !s.autoClosingQuotes })} />
              <SettingsToggle label="Format on Paste" active={s.formatOnPaste}
                onClick={() => useSettingsStore.getState().setEditorSettings({ formatOnPaste: !s.formatOnPaste })} />
              <SettingsToggle label="Smooth Scrolling" active={s.smoothScrolling}
                onClick={() => useSettingsStore.getState().setEditorSettings({ smoothScrolling: !s.smoothScrolling })} />
              <SettingsToggle label="Quick Suggestions" active={s.quickSuggestions}
                onClick={() => useSettingsStore.getState().setEditorSettings({ quickSuggestions: !s.quickSuggestions })} />
              <SettingsToggle label="Links" active={s.links}
                onClick={() => useSettingsStore.getState().setEditorSettings({ links: !s.links })} />
              <SettingsToggle label="Color Decorators" active={s.colorDecorators}
                onClick={() => useSettingsStore.getState().setEditorSettings({ colorDecorators: !s.colorDecorators })} />
              <SettingsToggle label="Context Menu" active={s.contextmenu}
                onClick={() => useSettingsStore.getState().setEditorSettings({ contextmenu: !s.contextmenu })} />

              <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider px-2 py-1.5 mt-2">Render Whitespace</div>
              <div className="flex gap-1 px-2 mb-2">
                {(['none', 'boundary', 'all'] as const).map(v => (
                  <button key={v} onClick={() => useSettingsStore.getState().setEditorSettings({ renderWhitespace: v })}
                    className={`px-2 py-0.5 rounded text-[10px] ${s.renderWhitespace === v ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                    {v}
                  </button>
                ))}
              </div>

              <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider px-2 py-1.5 mt-2">Cursor Style</div>
              <div className="flex gap-1 px-2 mb-2 flex-wrap">
                {(['line', 'block', 'underline'] as const).map(v => (
                  <button key={v} onClick={() => useSettingsStore.getState().setEditorSettings({ cursorStyle: v })}
                    className={`px-2 py-0.5 rounded text-[10px] ${s.cursorStyle === v ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                    {v}
                  </button>
                ))}
              </div>

              <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider px-2 py-1.5 mt-2">Cursor Blinking</div>
              <div className="flex gap-1 px-2 mb-2 flex-wrap">
                {(['blink', 'smooth', 'phase', 'expand', 'solid'] as const).map(v => (
                  <button key={v} onClick={() => useSettingsStore.getState().setEditorSettings({ cursorBlinking: v })}
                    className={`px-2 py-0.5 rounded text-[10px] ${s.cursorBlinking === v ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsItem({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded">
      <span className="text-[11px] text-white/70">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-white/40">{value}</span>
        {children}
      </div>
    </div>
  );
}

function SettingsToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded">
      <span className="text-[11px] text-white/70">{label}</span>
      <div className={`w-7 h-3.5 rounded-full transition-all duration-200 relative ${active ? 'bg-[var(--color-primary-accent)]' : 'bg-white/15'}`}>
        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all duration-200 ${active ? 'left-3.5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}
