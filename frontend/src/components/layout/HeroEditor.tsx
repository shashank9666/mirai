'use client';

import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function HeroEditor() {
  const [code, setCode] = useState('// Welcome to Mirai V2\n// A Premium Agentic Workspace\n\nfunction init() {\n  console.log("Ready to code!");\n}\n');

  return (
    <section className="flex-1 flex flex-col relative glass-panel m-4 ml-0 shadow-2xl transition-all duration-300 overflow-hidden">
      <header className="h-10 border-b border-white/5 flex items-center px-4 bg-black/40 backdrop-blur-md rounded-t-2xl z-10">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <div className="ml-4 flex gap-4">
          <div className="text-[11px] font-mono text-primary bg-primary/10 px-3 py-1 rounded-md border border-primary/20">main.ts</div>
        </div>
      </header>
      
      <div className="flex-1 relative bg-[#0f1115]/90">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            padding: { top: 16 },
            lineHeight: 24,
            roundedSelection: false,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "all",
          }}
          className="rounded-b-2xl overflow-hidden"
        />
      </div>
    </section>
  );
}
