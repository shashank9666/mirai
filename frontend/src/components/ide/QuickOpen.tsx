'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileCode, File, Clock } from 'lucide-react';
import { useIdeStore } from '@/store/ideStore';
import { useEditorStore } from '@/store/editorStore';

import { api } from '@/lib/api';

interface FileItem {
  path: string;
  score: number;
}

const EXT_ICON_MAP: Record<string, typeof FileCode> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  py: FileCode, go: FileCode, rs: FileCode, java: FileCode,
  rb: FileCode, php: FileCode, c: FileCode, cpp: FileCode,
  h: FileCode, hpp: FileCode, cs: FileCode, swift: FileCode,
  kt: FileCode, scala: FileCode, sh: FileCode, bash: FileCode,
  zsh: FileCode, ps1: FileCode, bat: FileCode, cmd: FileCode,
  html: FileCode, css: FileCode, scss: FileCode, less: FileCode,
  json: FileCode, yaml: FileCode, yml: FileCode, toml: FileCode,
  xml: FileCode, md: FileCode, txt: FileCode, sql: FileCode,
  graphql: FileCode, proto: FileCode, env: FileCode, gitignore: FileCode,
  dockerfile: FileCode, makefile: FileCode, cargo: FileCode,
  vue: FileCode, svelte: FileCode,
};

function getExtIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const name = filename.split(/[\\/]/).pop()?.toLowerCase() || '';
  if (name === 'dockerfile') return EXT_ICON_MAP.dockerfile || File;
  if (name === 'makefile') return EXT_ICON_MAP.makefile || File;
  if (name === 'cargo.toml') return EXT_ICON_MAP.cargo || File;
  if (name === '.gitignore') return EXT_ICON_MAP.gitignore || File;
  return EXT_ICON_MAP[ext] || File;
}

function getExtColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const name = filename.split(/[\\/]/).pop()?.toLowerCase() || '';
  if (name === 'dockerfile') return 'text-blue-400';
  if (name === 'makefile') return 'text-red-400';
  if (name === '.gitignore') return 'text-orange-400';
  if (['ts', 'tsx'].includes(ext)) return 'text-blue-400';
  if (['js', 'jsx'].includes(ext)) return 'text-yellow-400';
  if (ext === 'py') return 'text-green-400';
  if (['rs'].includes(ext)) return 'text-orange-400';
  if (['go'].includes(ext)) return 'text-cyan-400';
  if (['html', 'htm'].includes(ext)) return 'text-orange-300';
  if (['css', 'scss', 'less'].includes(ext)) return 'text-blue-300';
  if (['json'].includes(ext)) return 'text-yellow-200';
  if (['md', 'txt'].includes(ext)) return 'text-white/50';
  if (['yaml', 'yml', 'toml'].includes(ext)) return 'text-pink-400';
  return 'text-white/50';
}

function fuzzyScore(query: string, path: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const filename = path.split(/[\\/]/).pop()?.toLowerCase() || '';
  const fullPath = path.toLowerCase();

  if (filename === q) return 1000;
  if (filename.startsWith(q)) return 800;
  if (fullPath.endsWith(q)) return 700;

  let score = 0;
  let qi = 0;
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;
  let wordBoundaryMatches = 0;

  for (let fi = 0; fi < fullPath.length && qi < q.length; fi++) {
    if (fullPath[fi] === q[qi]) {
      score += 10;
      const isFilename = fi >= fullPath.length - filename.length;
      if (isFilename) score += 20;
      if (fi === 0 || ['/', '\\', '.', '-', '_', ' '].includes(fullPath[fi - 1])) {
        score += 30;
        wordBoundaryMatches++;
      }
      if (lastMatchIndex === fi - 1) {
        consecutiveBonus += 15;
        score += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }
      score -= Math.floor(fi / 5);
      lastMatchIndex = fi;
      qi++;
    }
  }

  if (qi < q.length) return 0;
  score += wordBoundaryMatches * 10;
  score -= Math.floor(path.length / 20);
  return score;
}

export default function QuickOpen() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const store = useIdeStore();
  const { activeGroupId } = store;
  const activeGroup = store.getGroupById(activeGroupId);
  const tabs = activeGroup?.tabs || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'p') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && allFiles.length === 0) {
      setIsLoading(true);
      api.listFiles(undefined, 10)
        .then((res) => {
          setAllFiles(res.results || []);
        })
        .catch((err) => {
          console.error('Failed to list files:', err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, allFiles.length]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const results = useMemo<FileItem[]>(() => {
    if (!query) {
      return [...tabs].reverse().map((tab) => ({
        path: tab.path,
        score: 1000,
      }));
    }

    return allFiles
      .map((path) => ({ path, score: fuzzyScore(query, path) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [query, allFiles, tabs]);

  const handleOpen = async (filePath: string) => {
    try {
      const { content } = await api.readFile(filePath);
      const name = filePath.split(/[\\/]/).pop() || filePath;
      useEditorStore.getState().setActiveFile(filePath, name, content);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleOpen(results[selectedIndex].path);
    }
  };

  const highlightMatch = (text: string, q: string) => {
    if (!q) return text;
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;

    let qi = 0;
    for (let fi = 0; fi < text.length && qi < ql.length; fi++) {
      if (lower[fi] === ql[qi]) {
        if (fi > lastIdx) {
          parts.push(<span key={`t${fi}`}>{text.slice(lastIdx, fi)}</span>);
        }
        parts.push(
          <span key={`m${fi}`} className="text-white font-semibold">{text[fi]}</span>
        );
        lastIdx = fi + 1;
        qi++;
      }
    }
    if (lastIdx < text.length) {
      parts.push(<span key="rest">{text.slice(lastIdx)}</span>);
    }
    return parts.length > 0 ? parts : text;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed z-50 left-1/2 top-[15%] -translate-x-1/2 w-full max-w-2xl bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(124,58,237,0.15)] overflow-hidden flex flex-col"
          >
            <div className="flex items-center px-4 py-4 border-b border-white/10">
              <Search className="w-5 h-5 text-white/50 mr-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search files by name..."
                className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-white/30"
              />
              <div className="px-2 py-1 bg-white/10 rounded text-[10px] text-white/50 font-mono">ESC</div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {!query && tabs.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-mono text-white/30 uppercase tracking-wider">
                  Recently Opened
                </div>
              )}
              {isLoading && (
                <div className="px-4 py-8 text-center text-white/30 text-sm font-mono">
                  Loading files...
                </div>
              )}
              {!isLoading && results.length === 0 && (
                <div className="px-4 py-8 text-center text-white/30 text-sm font-mono">
                  {query ? 'No matching files' : 'No recently opened files'}
                </div>
              )}
              {results.map((item, idx) => {
                const filename = item.path.split(/[\\/]/).pop() || item.path;
                const dir = item.path.replace(/[\\/][^\\/]+$/, '').split(/[\\/]/).pop() || '';
                const Icon = getExtIcon(item.path);
                const color = getExtColor(item.path);
                return (
                  <button
                    key={item.path}
                    className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-colors text-left group ${
                      idx === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                    onClick={() => handleOpen(item.path)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mr-3 shrink-0 ${color} group-hover:text-white transition-colors`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/90 group-hover:text-white truncate">
                        {highlightMatch(filename, query)}
                      </div>
                      <div className="text-[10px] text-white/30 truncate">{dir}</div>
                    </div>
                    {!query && (
                      <Clock className="w-3.5 h-3.5 text-white/20 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
