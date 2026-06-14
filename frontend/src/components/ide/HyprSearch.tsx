'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useEditorStore } from '@/store/editorStore';

interface SearchResult {
  path: string;
  matches: {
    line: number;
    text: string;
  }[];
}

const FILE_ICONS: Record<string, string> = {
  '.tsx': '⚛️', '.ts': '🔷', '.js': '🟨', '.jsx': '⚛️',
  '.css': '🎨', '.json': '📋', '.md': '📝', '.py': '🐍',
  '.html': '🌐', '.env': '🔑', '.gitignore': '🙈',
};

const getFileIcon = (name: string) => {
  const ext = '.' + name.split('.').pop();
  return FILE_ICONS[ext] || '📄';
};

const highlightMatch = (text: string, query: string) => {
  if (!query) return <span>{text}</span>;
  // Escape query for regex
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-[var(--color-primary-accent)]/40 text-white font-medium rounded-sm px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export default function HyprSearch() {
  const [query, setQuery] = useState('');
  const [includes, setIncludes] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setActiveFile } = useEditorStore();

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await api.searchFiles(null, query.trim(), includes.trim());
      setResults(res.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, includes]);

  const handleOpen = async (filePath: string, line?: number) => {
    try {
      const { content } = await api.readFile(filePath);
      const name = filePath.split(/[\\/]/).pop() || filePath;
      setActiveFile(filePath, name, content);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('editor:revealLine', { detail: { line, filePath } }));
      }, 100);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0">
        Search
      </div>

      <div className="px-3 py-2 shrink-0 space-y-2">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-white/20 transition-colors">
          <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="Search in files..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white font-mono placeholder:text-white/20"
          />
        </div>
        <div className="flex items-center gap-2 bg-transparent border border-transparent px-2.5">
          <input
            value={includes}
            onChange={(e) => setIncludes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="Files to include (e.g. *.ts, *.py)"
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-white/50 font-mono placeholder:text-white/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
        {isLoading && (
          <div className="px-3 py-6 text-center text-white/30 text-xs font-mono animate-pulse">
            Searching...
          </div>
        )}

        {!isLoading && hasSearched && results.length === 0 && (
          <div className="px-3 py-6 text-center text-white/30 text-xs font-mono">
            No results
          </div>
        )}

        {!isLoading && !hasSearched && (
          <div className="px-3 py-6 text-center text-white/20 text-[11px] font-mono">
            Type a query and press Enter to search
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-1">
            <div className="px-2 py-1 mb-2 text-[10px] text-white/30 font-mono uppercase tracking-wider">
              {results.reduce((acc, r) => acc + r.matches.length, 0)} results in {results.length} files
            </div>
            {results.map((result) => {
              const name = result.path.split(/[\\/]/).pop() || result.path;
              const dirPath = result.path.replace(/[\\/][^\\/]+$/, '');
              const dir = dirPath.split(/[\\/]/).pop() || '';
              const icon = getFileIcon(name);
              return (
                <div key={result.path} className="rounded-md overflow-hidden">
                  <button
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-mono text-white/55 hover:bg-white/5 hover:text-white/85 transition-colors text-left group"
                    onClick={() => handleOpen(result.path, result.matches[0]?.line)}
                  >
                    <span className="text-[11px] shrink-0">{icon}</span>
                    <span className="flex-1 truncate">{name}</span>
                    <span className="text-[10px] text-white/25 shrink-0 group-hover:text-white/40 truncate">{dir}</span>
                  </button>
                  {result.matches.slice(0, 5).map((m: { line: number; text: string }) => (
                    <button
                      key={`${result.path}:${m.line}`}
                      className="w-full flex items-center gap-2 px-4 py-0.5 text-[11px] font-mono text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors text-left"
                      onClick={() => handleOpen(result.path, m.line)}
                    >
                      <span className="text-white/20 shrink-0 w-8 text-right">{m.line}</span>
                      <span className="flex-1 truncate text-white/35">{highlightMatch(m.text, query)}</span>
                    </button>
                  ))}
                  {result.matches.length > 5 && (
                    <div className="px-4 py-0.5 text-[10px] font-mono text-white/20">
                      +{result.matches.length - 5} more matches
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
