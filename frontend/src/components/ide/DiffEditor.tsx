'use client';

import React, { useCallback, useRef } from 'react';
import { DiffEditor as MonacoDiffEditor, loader } from '@monaco-editor/react';
import { X, GitCompareArrows } from 'lucide-react';
import { useIdeStore } from '@/store/ideStore';

loader.config({ paths: { vs: '/vs' } });

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
    md: 'markdown', txt: 'plaintext', sql: 'sql', sh: 'shell', bash: 'shell',
  };
  return langMap[ext] || 'plaintext';
}

export default function DiffEditorPanel() {
  const { diffMode, diffFilePath, diffOriginal, diffModified, closeDiff, editorSettings } = useIdeStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  if (!diffMode) return null;

  const fileName = diffFilePath.split(/[\\/]/).pop() || diffFilePath;

  return (
    <div className="h-full flex flex-col border-t border-white/10">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0a0a]/60 border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <GitCompareArrows className="w-3.5 h-3.5 text-[var(--color-secondary-accent)]" />
          <span className="text-white/70">{fileName}</span>
          <span className="text-white/30">— Diff View</span>
        </div>
        <button
          onClick={closeDiff}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Monaco Diff Editor */}
      <div className="flex-1 min-h-0">
        <MonacoDiffEditor
          height="100%"
          language={getLanguageFromPath(diffFilePath)}
          original={diffOriginal}
          modified={diffModified}
          theme="vs-dark"
          onMount={handleMount}
          options={{
            readOnly: true,
            renderSideBySide: true,
            automaticLayout: true,
            fontSize: editorSettings.fontSize,
            fontFamily: "'JetBrains Mono', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: editorSettings.smoothScrolling,
            padding: editorSettings.padding,
            renderLineHighlight: 'none',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            folding: editorSettings.folding,
            glyphMargin: false,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 4,
          }}
        />
      </div>
    </div>
  );
}
