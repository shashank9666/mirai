'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, FileText } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

export default function MarkdownPreview() {
  const { previewMode, previewFilePath, previewContent, closePreview } = useEditorStore();

  if (!previewMode) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/80">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-2 text-[11px] font-mono text-white/70">
          <FileText className="w-3.5 h-3.5 text-purple-400" />
          <span className="truncate max-w-[60vw]">{previewFilePath.split(/[\\/]/).pop()}</span>
        </div>
        <button
          onClick={closePreview}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <article className="prose prose-invert prose-sm max-w-none text-white/80">
          <ReactMarkdown>{previewContent}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
