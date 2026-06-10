'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, ChevronRight, Folder,
  HardDrive, ArrowLeft, Sparkles,
  History, X,
} from 'lucide-react';
import { useIdeStore } from '@/store/ideStore';
import { api, type FileEntry } from '@/lib/api';

export default function WelcomeScreen({ onWorkspaceOpened }: { onWorkspaceOpened?: () => void }) {
  const { setWorkspace, recentWorkspaces } = useIdeStore();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [drives, setDrives] = useState<{ name: string; label: string }[]>([]);
  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [dirEntries, setDirEntries] = useState<FileEntry[]>([]);
  const [recentList, setRecentList] = useState<string[]>([]);

  // Load recent from both localStorage and store
  useEffect(() => {
    const stored = localStorage.getItem('miraiRecentWorkspaces');
    const localRecent: string[] = stored ? JSON.parse(stored) : [];
    const storeRecent = recentWorkspaces || [];
    const merged = [...new Set([...storeRecent, ...localRecent])];
    setRecentList(merged);
  }, [recentWorkspaces]);

  const openFolderPicker = useCallback(async () => {
    const d = await api.workspaceListDrives().catch(() => ({ drives: [] }));
    setDrives(d.drives);
    setCurrentDir(null);
    setDirEntries([]);
    setShowFolderPicker(true);
  }, []);

  const navigateDir = useCallback(async (path: string) => {
    const result = await api.workspaceListDirectory(path).catch(() => null);
    if (result) {
      setCurrentDir(result.path);
      setDirEntries(result.entries);
    }
  }, []);

  const selectFolder = useCallback(async (path: string) => {
    const result = await api.workspaceSet(path).catch(() => null);
    if (result) {
      setWorkspace(result.path, result.name);
      setShowFolderPicker(false);
      onWorkspaceOpened?.();
    }
  }, [setWorkspace, onWorkspaceOpened]);

  const openRecent = useCallback(async (path: string) => {
    const result = await api.workspaceSet(path).catch(() => null);
    if (result) {
      setWorkspace(result.path, result.name);
      onWorkspaceOpened?.();
    }
  }, [setWorkspace, onWorkspaceOpened]);

  if (showFolderPicker) {
    return (
      <FolderPicker
        drives={drives}
        currentDir={currentDir}
        entries={dirEntries}
        onNavigate={navigateDir}
        onSelect={selectFolder}
        onBack={() => {
          if (currentDir) {
            const parent = currentDir.replace(/[\\/][^\\/]+$/, '') || (currentDir.match(/^[A-Z]:\\?$/i) ? '' : '/');
            if (parent) navigateDir(parent);
            else { setCurrentDir(null); setDirEntries([]); }
          }
        }}
        onClose={() => setShowFolderPicker(false)}
        onDriveSelect={(drive) => navigateDir(drive)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full flex items-center justify-center bg-[#0a0a0a]/80"
    >
      <div className="flex flex-col items-center gap-8 max-w-lg w-full px-8">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary-accent)] to-[var(--color-secondary-accent)] flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.3)]">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-mono font-bold text-white/90 tracking-tight">
            Mirai IDE
          </h1>
          <p className="text-[11px] font-mono text-white/30 text-center">
            AI-Powered Development Environment
          </p>
        </motion.div>

        {/* Main actions */}
        <div className="w-full space-y-2">
          <button
            onClick={openFolderPicker}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-[var(--color-primary-accent)]/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-accent)]/10 flex items-center justify-center group-hover:bg-[var(--color-primary-accent)]/20 transition-colors">
              <FolderOpen className="w-5 h-5 text-[var(--color-primary-accent)]" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-[13px] font-mono text-white/80 group-hover:text-white transition-colors">Open Folder</div>
              <div className="text-[10px] font-mono text-white/30">Browse for a project directory</div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
          </button>

          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-[var(--color-secondary-accent)]/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-secondary-accent)]/10 flex items-center justify-center group-hover:bg-[var(--color-secondary-accent)]/20 transition-colors">
              <Sparkles className="w-5 h-5 text-[var(--color-secondary-accent)]" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-[13px] font-mono text-white/80 group-hover:text-white transition-colors">New Project</div>
              <div className="text-[10px] font-mono text-white/30">Create a new project from scratch</div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
          </button>
        </div>

        {/* Recent Workspaces */}
        {recentList.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-2 mb-2 px-1">
              <History className="w-3 h-3 text-white/20" />
              <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">Recent</span>
            </div>
            <div className="space-y-1">
              {recentList.slice(0, 5).map((path) => {
                const name = path.split(/[\\/]/).filter(Boolean).pop() || path;
                return (
                  <button
                    key={path}
                    onClick={() => openRecent(path)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <Folder className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
                    <span className="text-[11px] font-mono text-white/40 group-hover:text-white/70 transition-colors truncate flex-1 text-left">{name}</span>
                    <span className="text-[9px] font-mono text-white/15 truncate max-w-[150px]">{path}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-[10px] font-mono text-white/10">
          Press Ctrl+K to open Command Palette
        </div>
      </div>
    </motion.div>
  );
}

function FolderPicker({
  drives, currentDir, entries, onNavigate, onSelect, onBack, onClose, onDriveSelect,
}: {
  drives: { name: string; label: string }[];
  currentDir: string | null;
  entries: FileEntry[];
  onNavigate: (path: string) => void;
  onSelect: (path: string) => void;
  onBack: () => void;
  onClose: () => void;
  onDriveSelect: (drive: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full flex items-center justify-center bg-[#0a0a0a]/80"
    >
      <div className="bg-[#0f0f0f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(124,58,237,0.1)] w-[480px] max-h-[70vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {currentDir && (
              <button onClick={onBack} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <FolderOpen className="w-4 h-4 text-[var(--color-primary-accent)]" />
            <span className="text-[12px] font-mono text-white/70">
              {currentDir || 'Select Folder'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {!currentDir && (
            <div className="space-y-1">
              <div className="px-2 py-1.5 text-[10px] font-mono text-white/20 uppercase tracking-wider">Drives</div>
              {drives.map((drive) => (
                <button
                  key={drive.name}
                  onClick={() => onDriveSelect(drive.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <HardDrive className="w-4 h-4 text-blue-400/60" />
                  <span className="text-[12px] font-mono text-white/60 group-hover:text-white/90 transition-colors">{drive.label}</span>
                </button>
              ))}
            </div>
          )}
          {currentDir && (
            <div className="space-y-0.5">
              {entries.length === 0 && (
                <div className="text-center py-8 text-[11px] font-mono text-white/20">Empty directory</div>
              )}
              {entries.filter(e => e.isDirectory).map((entry) => (
                <div
                  key={entry.path}
                  onDoubleClick={() => onSelect(entry.path)}
                  onClick={() => onNavigate(entry.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <Folder className="w-4 h-4 text-yellow-500/60" />
                  <span className="text-[12px] font-mono text-white/60 group-hover:text-white/90 transition-colors flex-1 text-left truncate">{entry.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(entry.path); }}
                    className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] text-[10px] font-mono hover:bg-[var(--color-primary-accent)]/30 transition-all"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {currentDir && (
          <div className="px-4 py-2.5 border-t border-white/5 flex justify-end">
            <button
              onClick={() => onSelect(currentDir)}
              className="px-4 py-1.5 rounded-lg bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] text-[11px] font-mono hover:bg-[var(--color-primary-accent)]/30 transition-colors"
            >
              Open &ldquo;{currentDir.split(/[\\/]/).filter(Boolean).pop()}&rdquo;
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
