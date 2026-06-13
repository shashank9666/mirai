'use client';

import React, { useCallback, useRef } from 'react';
import { DiffEditor as MonacoDiffEditor, loader } from '@monaco-editor/react';
import { X, GitCompareArrows, Check, XCircle, FileCode } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useSettingsStore } from '@/store/settingsStore';
import { motion, AnimatePresence } from 'framer-motion';

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
  const {
    diffMode, diffFilePath, diffOriginal, diffModified, closeDiff,
    reviewingChangeId, pendingChanges, acceptChange, rejectChange,
  } = useEditorStore();
  const { editorSettings } = useSettingsStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const [isAccepting, setIsAccepting] = React.useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // Dispose editor before React unmounts the DOM to prevent the
  // "TextModel got disposed before DiffEditorWidget model got reset" error
  React.useEffect(() => {
    return () => {
      if (editorRef.current) {
        try { editorRef.current.dispose(); } catch { /* ignore */ }
        editorRef.current = null;
      }
    };
  }, []);

  if (!diffMode) return null;

  const fileName = diffFilePath.split(/[/\\]/).pop() || diffFilePath;
  const reviewingChange = reviewingChangeId
    ? pendingChanges.find((c) => c.id === reviewingChangeId)
    : null;

  const handleAccept = async () => {
    if (!reviewingChangeId) return;
    setIsAccepting(true);
    await acceptChange(reviewingChangeId);
    setIsAccepting(false);
  };

  const handleReject = () => {
    if (reviewingChangeId) {
      rejectChange(reviewingChangeId);
    } else {
      closeDiff();
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
      {/* Diff Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ background: 'var(--panel-bg)', borderBottom: '1px solid var(--color-glass-border)' }}>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <GitCompareArrows className="w-3.5 h-3.5 text-[var(--color-secondary-accent)]" />
          <FileCode className="w-3.5 h-3.5 text-white/40" />
          <span style={{ color: 'var(--text-active)' }}>{fileName}</span>
          <span style={{ color: 'var(--text-muted)' }}>— AI Change Review</span>
        </div>

        <div className="flex items-center gap-2">
          {reviewingChange && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                {/* Reject Button */}
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/70"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>

                {/* Accept Button */}
                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 hover:border-emerald-500/70 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isAccepting ? 'Applying...' : 'Accept'}
                </button>
              </motion.div>
            </AnimatePresence>
          )}

          <button
            onClick={closeDiff}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Labels */}
      <div className="flex items-center px-4 py-1 shrink-0 text-[10px] font-mono" style={{ background: 'var(--editor-bg)', borderBottom: '1px solid var(--color-glass-border)' }}>
        <div className="w-1/2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400/70 inline-block" />
          <span className="text-red-400/80">Original</span>
        </div>
        <div className="w-1/2 flex items-center gap-1.5 pl-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400/70 inline-block" />
          <span className="text-emerald-400/80">Proposed by AI</span>
        </div>
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
