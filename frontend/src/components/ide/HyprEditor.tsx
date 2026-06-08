'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useIdeStore } from '@/store/ideStore';
import { X } from 'lucide-react';

export default function HyprEditor() {
  const {
    tabs, activeFile, activeFileContent,
    closeTab, updateFileContent, setActiveFile,
    saveFile, revertFile, reopenClosedTab,
  } = useIdeStore();

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      updateFileContent(value);
    }
  }, [updateFileContent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          useIdeStore.getState().saveAllFiles();
        } else {
          saveFile();
        }
      }
      if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        revertFile();
      }
      if (mod && e.key === 'w') {
        e.preventDefault();
        if (activeFile) closeTab(activeFile);
      }
      if (mod && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        reopenClosedTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, closeTab, saveFile, revertFile, reopenClosedTab]);

  const editorRef = useRef<any>(null);

  const handleEditorDidMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    const handleRevealLine = (e: CustomEvent) => {
      const line = e.detail?.line;
      if (line && editorRef.current) {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus();
      }
    };
    window.addEventListener('editor:revealLine', handleRevealLine as EventListener);
    return () => window.removeEventListener('editor:revealLine', handleRevealLine as EventListener);
  }, []);

  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
      {/* Tabs Bar */}
      <div className="flex bg-[#0a0a0a]/50 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0">
        {tabs.length === 0 ? (
          <div className="px-4 py-2 text-[11px] font-mono text-white/25 italic">No editors open</div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-[6px] border-r border-white/5 text-[11px] font-mono cursor-pointer transition-all duration-150 group ${
                activeFile === tab.path
                  ? 'bg-white/5 text-white border-t-2 border-t-[var(--color-primary-accent)]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
              }`}
              onClick={() => setActiveFile(tab.path, tab.name, tab.savedContent)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
            >
              {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
              <span>{tab.name}</span>
              <X
                className="w-3 h-3 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-all cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              />
            </div>
          ))
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 relative min-h-0">
        {activeFile ? (
          <Editor
            height="100%"
            theme="vs-dark"
            path={activeFile}
            value={activeFileContent}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true, scale: 1 },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              fontLigatures: true,
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              formatOnPaste: true,
              renderLineHighlight: 'gutter',
              guides: { bracketPairs: true },
              stickyScroll: { enabled: true },
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-white/15">
              <svg className="w-20 h-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="font-mono text-sm">Mirai Workspace</span>
              <span className="text-[11px] font-mono text-white/10">Press Ctrl+K to open Command Palette</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
