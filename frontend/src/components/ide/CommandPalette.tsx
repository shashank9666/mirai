'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Terminal, Sparkles, Settings, Save, RotateCcw,
  FilePlus, FolderPlus, X, Copy, Layout, GitBranch, SearchCode,
  Maximize2, Columns2, Rows2, WrapText, Map, Pin,
  Braces, Pilcrow, MousePointer2, Type, UnfoldVertical, FoldVertical,
  ZoomIn, ZoomOut, RefreshCw, Scissors,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useSettingsStore } from '@/store/settingsStore';


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

  const { saveFile, saveAllFiles, revertFile, closeTab, closeAllTabs, closeOtherTabs, getActiveGroup } = useEditorStore();
  const activeFile = getActiveGroup()?.activeFile || null;

  const commands: Command[] = useMemo(() => [
    // File commands
    { id: 'save', label: 'Save File', category: 'File', icon: <Save className="w-4 h-4" />, shortcut: 'Ctrl+S', action: () => saveFile() },
    { id: 'saveAll', label: 'Save All Files', category: 'File', icon: <Save className="w-4 h-4 text-green-400" />, shortcut: 'Ctrl+Shift+S', action: () => saveAllFiles() },
    { id: 'revert', label: 'Revert File', category: 'File', icon: <RotateCcw className="w-4 h-4" />, shortcut: 'Ctrl+Shift+Z', action: () => revertFile() },
    { id: 'closeTab', label: 'Close Editor Tab', category: 'File', icon: <X className="w-4 h-4" />, shortcut: 'Ctrl+W', action: () => activeFile && closeTab(activeFile) },
    { id: 'closeAll', label: 'Close All Tabs', category: 'File', icon: <X className="w-4 h-4 text-red-400" />, action: () => closeAllTabs() },
    { id: 'closeOthers', label: 'Close Other Tabs', category: 'File', icon: <Copy className="w-4 h-4" />, action: () => activeFile && closeOtherTabs(activeFile) },
    { id: 'newFile', label: 'New File', category: 'File', icon: <FilePlus className="w-4 h-4" />, action: () => emit('newFile') },
    { id: 'newFolder', label: 'New Folder', category: 'File', icon: <FolderPlus className="w-4 h-4" />, action: () => emit('newFolder') },

    // View commands
    { id: 'toggleTerminal', label: 'Toggle Terminal Panel', category: 'View', icon: <Terminal className="w-4 h-4" />, shortcut: 'Ctrl+`', action: () => emit('toggleTerminal') },
    { id: 'toggleSidebar', label: 'Toggle Explorer Sidebar', category: 'View', icon: <Layout className="w-4 h-4" />, shortcut: 'Ctrl+B', action: () => emit('toggleSidebar') },
    { id: 'toggleChat', label: 'Toggle AI Chat Panel', category: 'View', icon: <Sparkles className="w-4 h-4" />, shortcut: 'Ctrl+J', action: () => emit('toggleChat') },
    { id: 'focusExplorer', label: 'Show Explorer', category: 'View', icon: <Layout className="w-4 h-4" />, action: () => emit('view:explorer') },
    { id: 'focusSearch', label: 'Show Search', category: 'View', icon: <Search className="w-4 h-4" />, shortcut: 'Ctrl+Shift+F', action: () => emit('view:search') },
    { id: 'focusGit', label: 'Show Source Control', category: 'View', icon: <GitBranch className="w-4 h-4" />, action: () => emit('view:git') },

    // Editor - Layout
    { id: 'zenMode', label: 'Toggle Zen Mode', category: 'Editor', icon: <Maximize2 className="w-4 h-4" />, shortcut: 'Ctrl+K Z', action: () => emit('toggleZenMode') },
    { id: 'fullscreen', label: 'Toggle Fullscreen', category: 'Editor', icon: <Maximize2 className="w-4 h-4 text-blue-400" />, shortcut: 'F11', action: () => emit('toggleFullscreen') },
    { id: 'splitRight', label: 'Split Editor Right', category: 'Editor', icon: <Columns2 className="w-4 h-4" />, shortcut: 'Ctrl+\\', action: () => emit('splitHorizontal') },
    { id: 'splitDown', label: 'Split Editor Down', category: 'Editor', icon: <Rows2 className="w-4 h-4" />, action: () => emit('splitVertical') },
    { id: 'closeGroup', label: 'Close Editor Group', category: 'Editor', icon: <X className="w-4 h-4" />, action: () => emit('closeGroup') },

    // Editor - Display
    { id: 'toggleWordWrap', label: 'Toggle Word Wrap', category: 'Editor', icon: <WrapText className="w-4 h-4" />, shortcut: 'Alt+Z', action: () => emit('toggleWordWrap') },
    { id: 'toggleMinimap', label: 'Toggle Minimap', category: 'Editor', icon: <Map className="w-4 h-4" />, action: () => emit('toggleMinimap') },
    { id: 'toggleStickyScroll', label: 'Toggle Sticky Scroll', category: 'Editor', icon: <Pin className="w-4 h-4" />, action: () => emit('toggleStickyScroll') },
    { id: 'toggleFolding', label: 'Toggle Code Folding', category: 'Editor', icon: <FoldVertical className="w-4 h-4" />, action: () => emit('toggleFolding') },
    { id: 'foldAll', label: 'Fold All', category: 'Editor', icon: <FoldVertical className="w-4 h-4" />, shortcut: 'Ctrl+Shift+O', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.foldAll')?.run();
    }},
    { id: 'unfoldAll', label: 'Unfold All', category: 'Editor', icon: <UnfoldVertical className="w-4 h-4" />, shortcut: 'Ctrl+Shift+J', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.unfoldAll')?.run();
    }},

    // Editor - Formatting
    { id: 'toggleBracketColor', label: 'Toggle Bracket Pair Colorization', category: 'Editor', icon: <Braces className="w-4 h-4" />, action: () => emit('toggleBracketColorization') },
    { id: 'toggleFormatOnSave', label: 'Toggle Format on Save', category: 'Editor', icon: <Pilcrow className="w-4 h-4" />, action: () => emit('toggleFormatOnSave') },
    { id: 'formatDocument', label: 'Format Document', category: 'Editor', icon: <Pilcrow className="w-4 h-4 text-blue-400" />, shortcut: 'Shift+Alt+F', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.formatDocument')?.run();
    }},
    { id: 'formatSelection', label: 'Format Selection', category: 'Editor', icon: <Pilcrow className="w-4 h-4 text-green-400" />, shortcut: 'Ctrl+K Ctrl+F', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.formatSelection')?.run();
    }},

    // Editor - Font
    { id: 'zoomIn', label: 'Increase Font Size', category: 'Editor', icon: <ZoomIn className="w-4 h-4" />, shortcut: 'Ctrl+=', action: () => emit('increaseFontSize') },
    { id: 'zoomOut', label: 'Decrease Font Size', category: 'Editor', icon: <ZoomOut className="w-4 h-4" />, shortcut: 'Ctrl+-', action: () => emit('decreaseFontSize') },
    { id: 'resetZoom', label: 'Reset Font Size', category: 'Editor', icon: <RefreshCw className="w-4 h-4" />, shortcut: 'Ctrl+0', action: () => emit('resetFontSize') },
    { id: 'toggleMouseZoom', label: 'Toggle Mouse Wheel Zoom', category: 'Editor', icon: <MousePointer2 className="w-4 h-4" />, action: () => useSettingsStore.getState().toggleMouseWheelZoom() },

    // Editor - Cursor & Selection
    { id: 'addCursorAbove', label: 'Add Cursor Above', category: 'Editor', icon: <Scissors className="w-4 h-4" />, shortcut: 'Ctrl+Alt+Up', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.insertCursorAbove')?.run();
    }},
    { id: 'addCursorBelow', label: 'Add Cursor Below', category: 'Editor', icon: <Scissors className="w-4 h-4" />, shortcut: 'Ctrl+Alt+Down', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.insertCursorBelow')?.run();
    }},
    { id: 'selectAllOccurrences', label: 'Select All Occurrences', category: 'Editor', icon: <Scissors className="w-4 h-4 text-yellow-400" />, shortcut: 'Ctrl+Shift+L', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.selectHighlights')?.run();
    }},
    { id: 'multiCursorSelect', label: 'Column Selection Mode', category: 'Editor', icon: <Scissors className="w-4 h-4 text-purple-400" />, shortcut: 'Shift+Alt+Mouse', action: () => {
      const editor = (window as any).__miraiEditor;
      if (editor) {
        const current = editor.getOption(117); // EditorOption.columnSelection
        editor.updateOptions({ columnSelection: !current });
      }
    }},

    // Editor - Navigation
    { id: 'goToLine', label: 'Go to Line', category: 'Editor', icon: <Type className="w-4 h-4" />, shortcut: 'Ctrl+G', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.gotoLine')?.run();
    }},
    { id: 'goToDefinition', label: 'Go to Definition', category: 'Editor', icon: <Type className="w-4 h-4 text-blue-400" />, shortcut: 'F12', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.revealDefinition')?.run();
    }},
    { id: 'peekDefinition', label: 'Peek Definition', category: 'Editor', icon: <Type className="w-4 h-4 text-green-400" />, shortcut: 'Alt+F12', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.peekDefinition')?.run();
    }},
    { id: 'goToReferences', label: 'Go to References', category: 'Editor', icon: <Type className="w-4 h-4 text-orange-400" />, shortcut: 'Shift+F12', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.goToReferences')?.run();
    }},
    { id: 'findReferences', label: 'Find All References', category: 'Editor', icon: <SearchCode className="w-4 h-4 text-cyan-400" />, action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.findReferences')?.run();
    }},
    { id: 'renameSymbol', label: 'Rename Symbol', category: 'Editor', icon: <Type className="w-4 h-4 text-pink-400" />, shortcut: 'F2', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.rename')?.run();
    }},
    { id: 'toggleParameterHints', label: 'Toggle Parameter Hints', category: 'Editor', icon: <Type className="w-4 h-4" />, shortcut: 'Ctrl+Shift+Space', action: () => {
      const editor = (window as any).__miraiEditor;
      editor?.getAction('editor.action.triggerParameterHints')?.run();
    }},

    // AI commands
    { id: 'aiGenerate', label: 'AI: Generate Code', category: 'AI', icon: <Sparkles className="w-4 h-4 text-purple-400" />, action: () => emit('ai:generate') },
    { id: 'aiExplain', label: 'AI: Explain Code', category: 'AI', icon: <Sparkles className="w-4 h-4 text-purple-400" />, action: () => emit('ai:explain') },
    { id: 'aiRefactor', label: 'AI: Refactor Code', category: 'AI', icon: <Sparkles className="w-4 h-4 text-purple-400" />, action: () => emit('ai:refactor') },

    // System
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
