'use client';

import React from 'react';
import Editor from '@monaco-editor/react';
import { useIdeStore } from '@/store/ideStore';
import { X } from 'lucide-react';

export default function HyprEditor() {
  const { tabs, activeFile, activeFileContent, closeTab, updateFileContent, setActiveFile } = useIdeStore();

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      updateFileContent(value);
    }
  };

  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex bg-[#0a0a0a]/50 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0">
        {tabs.length === 0 ? (
          <div className="px-4 py-2 text-xs font-mono text-white/30 italic">No editors open</div>
        ) : (
          tabs.map((tab) => (
            <div 
              key={tab.id}
              className={`flex items-center px-4 py-2 border-r border-white/5 text-xs font-mono cursor-pointer transition-colors ${
                activeFile === tab.path ? 'bg-[var(--color-primary-accent)]/20 text-white border-t-2 border-t-[var(--color-primary-accent)]' : 'text-white/50 hover:bg-white/5'
              }`}
              onClick={() => setActiveFile(tab.path, tab.name, activeFileContent)} // Ideally fetch again, but relying on state for now
            >
              <span className="mr-3">{tab.name}</span>
              <X 
                className="w-3 h-3 hover:text-red-400" 
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }} 
              />
            </div>
          ))
        )}
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 relative">
        {activeFile ? (
          <Editor
            height="100%"
            theme="vs-dark"
            path={activeFile} // Helps Monaco with syntax highlighting
            value={activeFileContent}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              formatOnPaste: true,
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 font-mono text-sm">
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              <span>Mirai Workspace</span>
              <span className="text-xs opacity-50">Press Ctrl+K to open Command Palette</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
