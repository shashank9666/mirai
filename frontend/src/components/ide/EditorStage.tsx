'use client';

import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function EditorStage() {
  const [code, setCode] = useState('// Welcome to Mirai IDE\n\nfunction main() {\n  console.log("VS Code layout is active!");\n}\n');

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'var(--color-editor-bg)' }}>
      {/* Tab Bar */}
      <div className="h-9 flex items-end border-b border-[var(--color-border)]" style={{ backgroundColor: 'var(--color-title-bar)' }}>
        <div className="flex h-full items-center px-3 bg-[var(--color-editor-bg)] text-[var(--color-text-active)] border-t-2 border-t-[var(--color-accent)] border-r border-r-[var(--color-border)] border-l border-l-[var(--color-border)] min-w-[120px] text-[13px] cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2 text-yellow-500">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          main.ts
          <div className="ml-auto opacity-0 hover:opacity-100 hover:bg-white/10 p-0.5 rounded">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Editor Content */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            padding: { top: 16 },
            lineHeight: 22,
            roundedSelection: false,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "all",
          }}
        />
      </div>
    </div>
  );
}
