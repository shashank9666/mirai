'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileCode, Terminal, Sparkles, Settings } from 'lucide-react';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-white/30"
              />
              <div className="px-2 py-1 bg-white/10 rounded text-[10px] text-white/50 font-mono">ESC</div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              <div className="px-3 py-2 text-[10px] font-mono text-white/40 uppercase tracking-wider">AI Actions</div>
              <button className="w-full flex items-center px-3 py-3 hover:bg-white/5 rounded-xl transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mr-3 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm text-white/90">Ask AI to generate code...</span>
                  <span className="text-xs text-white/40">Use the active editor context</span>
                </div>
              </button>

              <div className="px-3 py-2 mt-2 text-[10px] font-mono text-white/40 uppercase tracking-wider">Files</div>
              <button className="w-full flex items-center px-3 py-2 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <FileCode className="w-4 h-4 text-blue-400 mr-3" />
                <span className="text-sm text-white/80 group-hover:text-white">src/app/page.tsx</span>
              </button>
              <button className="w-full flex items-center px-3 py-2 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <FileCode className="w-4 h-4 text-yellow-400 mr-3" />
                <span className="text-sm text-white/80 group-hover:text-white">src/components/ide/CommandPalette.tsx</span>
              </button>

              <div className="px-3 py-2 mt-2 text-[10px] font-mono text-white/40 uppercase tracking-wider">System</div>
              <button className="w-full flex items-center px-3 py-2 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <Terminal className="w-4 h-4 text-white/50 mr-3" />
                <span className="text-sm text-white/80 group-hover:text-white">Toggle Terminal</span>
              </button>
              <button className="w-full flex items-center px-3 py-2 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <Settings className="w-4 h-4 text-white/50 mr-3" />
                <span className="text-sm text-white/80 group-hover:text-white">Preferences: Open Settings</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
