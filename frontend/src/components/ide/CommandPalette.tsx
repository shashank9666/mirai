'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Terminal, Sparkles, Settings, Save, RotateCcw,
  FilePlus, FolderPlus, X, Copy, Layout, GitBranch, SearchCode,
} from 'lucide-react';
import { useIdeStore } from '@/store/ideStore';
import { api } from '@/lib/api';

interface Command {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

const emit = (event: string) => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: event } }));

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const store = useIdeStore();
  const { activeFile, saveFile, saveAllFiles, revertFile, closeTab, closeAllTabs, closeOtherTabs } = store;

  const commands: Command[] = useMemo(() => [
    { id: 'save', label: 'Save File', category: 'File', icon: <Save className="w-4 h-4" />, shortcut: 'Ctrl+S', action: () => saveFile() },
    { id: 'saveAll', label: 'Save All Files', category: 'File', icon: <Save className="w-4 h-4 text-green-400" />, shortcut: 'Ctrl+Shift+S', action: () => saveAllFiles() },
    { id: 'revert', label: 'Revert File', category: 'File', icon: <RotateCcw className="w-4 h-4" />, shortcut: 'Ctrl+Shift+Z', action: () => revertFile() },
    { id: 'closeTab', label: 'Close Editor Tab', category: 'File', icon: <X className="w-4 h-4" />, shortcut: 'Ctrl+W', action: () => activeFile && closeTab(activeFile) },
    { id: 'closeAll', label: 'Close All Tabs', category: 'File', icon: <X className="w-4 h-4 text-red-400" />, action: () => closeAllTabs() },
    { id: 'closeOthers', label: 'Close Other Tabs', category: 'File', icon: <Copy className="w-4 h-4" />, action: () => activeFile && closeOtherTabs(activeFile) },
    { id: 'newFile', label: 'New File', category: 'File', icon: <FilePlus className="w-4 h-4" />, action: () => emit('newFile') },
    { id: 'newFolder', label: 'New Folder', category: 'File', icon: <FolderPlus className="w-4 h-4" />, action: () => emit('newFolder') },
    { id: 'toggleTerminal', label: 'Toggle Terminal Panel', category: 'View', icon: <Terminal className="w-4 h-4" />, shortcut: 'Ctrl+`', action: () => emit('toggleTerminal') },
    { id: 'toggleSidebar', label: 'Toggle Explorer Sidebar', category: 'View', icon: <Layout className="w-4 h-4" />, shortcut: 'Ctrl+B', action: () => emit('toggleSidebar') },
    { id: 'toggleChat', label: 'Toggle AI Chat Panel', category: 'View', icon: <Sparkles className="w-4 h-4" />, shortcut: 'Ctrl+J', action: () => emit('toggleChat') },
    { id: 'focusExplorer', label: 'Show Explorer', category: 'View', icon: <Layout className="w-4 h-4" />, action: () => emit('view:explorer') },
    { id: 'focusSearch', label: 'Show Search', category: 'View', icon: <Search className="w-4 h-4" />, shortcut: 'Ctrl+Shift+F', action: () => emit('view:search') },
    { id: 'focusGit', label: 'Show Source Control', category: 'View', icon: <GitBranch className="w-4 h-4" />, action: () => emit('view:git') },
    { id: 'aiGenerate', label: 'AI: Generate Code', category: 'AI', icon: <Sparkles className="w-4 h-4 text-purple-400" />, action: () => emit('ai:generate') },
    { id: 'aiExplain', label: 'AI: Explain Code', category: 'AI', icon: <Sparkles className="w-4 h-4 text-purple-400" />, action: () => emit('ai:explain') },
    { id: 'aiRefactor', label: 'AI: Refactor Code', category: 'AI', icon: <Sparkles className="w-4 h-4 text-purple-400" />, action: () => emit('ai:refactor') },
    { id: 'settings', label: 'Open Settings', category: 'System', icon: <Settings className="w-4 h-4" />, action: () => emit('settings') },
  ], [activeFile, saveFile, saveAllFiles, revertFile, closeTab, closeAllTabs, closeOtherTabs]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'k') {
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
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      setIsOpen(false);
    }
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
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-white/30"
              />
              <div className="px-2 py-1 bg-white/10 rounded text-[10px] text-white/50 font-mono">ESC</div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-white/30 text-sm font-mono">No commands found</div>
              )}
              {filtered.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-colors text-left group ${
                    idx === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  onClick={() => { cmd.action(); setIsOpen(false); }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mr-3 text-white/60 group-hover:text-white transition-colors shrink-0">
                    {cmd.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 group-hover:text-white">{cmd.label}</div>
                    <div className="text-[10px] text-white/30">{cmd.category}</div>
                  </div>
                  {cmd.shortcut && (
                    <div className="text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded shrink-0 ml-2">
                      {cmd.shortcut}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
