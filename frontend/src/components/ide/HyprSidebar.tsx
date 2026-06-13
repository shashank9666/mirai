'use client';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSettingsStore } from '@/store/settingsStore';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, FileEntry } from '@/lib/api';
import { useEditorStore } from '@/store/editorStore';
import PanelHeader from './PanelHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FilePlus, FolderPlus, Edit2, Monitor, FileCode2, FileJson, FileText, File, FileImage, FileTerminal, Database, Palette, Settings as SettingsIcon } from 'lucide-react';

const getFileIcon = (name: string) => {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case '.ts': case '.tsx': return <FileCode2 className="w-3.5 h-3.5 text-blue-400" />;
    case '.js': case '.jsx': return <FileCode2 className="w-3.5 h-3.5 text-yellow-400" />;
    case '.json': return <FileJson className="w-3.5 h-3.5 text-green-400" />;
    case '.css': case '.scss': return <Palette className="w-3.5 h-3.5 text-pink-400" />;
    case '.html': return <FileCode2 className="w-3.5 h-3.5 text-orange-400" />;
    case '.md': return <FileText className="w-3.5 h-3.5 text-purple-400" />;
    case '.py': return <FileTerminal className="w-3.5 h-3.5 text-emerald-400" />;
    case '.png': case '.jpg': case '.jpeg': case '.svg': return <FileImage className="w-3.5 h-3.5 text-purple-300" />;
    case '.sql': case '.db': return <Database className="w-3.5 h-3.5 text-gray-400" />;
    case '.env': case '.gitignore': return <SettingsIcon className="w-3.5 h-3.5 text-gray-400" />;
    default: return <File className="w-3.5 h-3.5 text-white/50" />;
  }
};

interface ContextMenu {
  x: number;
  y: number;
  type: 'file' | 'directory' | 'explorer';
  path: string;
  name: string;
  isDir: boolean;
}

function ContextMenuComponent({ menu, onAction, onClose }: {
  menu: ContextMenu;
  onAction: (action: string, target: ContextMenu) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    ...(menu.isDir ? [
      { label: 'New File', action: 'newFile', key: 'f' },
      { label: 'New Folder', action: 'newFolder', key: 'd' },
    ] : []),
    ...(menu.name.toLowerCase().endsWith('.md') ? [
      { label: 'Preview Markdown', action: 'previewMarkdown', key: 'md' },
    ] : []),
    { label: 'Rename', action: 'rename', key: 'r' },
    { label: 'Delete', action: 'delete', key: 'del', danger: true },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[100] bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item) => (
        <button
          key={item.action}
          className={`w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center justify-between transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/15'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          onClick={() => { onAction(item.action, menu); onClose(); }}
        >
          <span>{item.label}</span>
          <span className="text-white/20 text-[10px]">{item.key}</span>
        </button>
      ))}
    </motion.div>
  );
}

function RenameDialog({ initialName, onConfirm, onCancel }: {
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
        <div className="text-[11px] font-mono text-white/50 mb-3">Rename to:</div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
            if (e.key === 'Escape') onCancel();
          }}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-[var(--color-primary-accent)]"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="px-3 py-1 text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors">Cancel</button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} className="px-3 py-1 text-[11px] font-mono bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] rounded-lg hover:bg-[var(--color-primary-accent)]/30 transition-colors">Rename</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewItemDialog({ type, onConfirm, onCancel }: {
  type: 'file' | 'folder';
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
        <div className="text-[11px] font-mono text-white/50 mb-3">New {type === 'file' ? 'file' : 'folder'} name:</div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={type === 'file' ? 'filename.ext' : 'folder-name'}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-[var(--color-primary-accent)] placeholder:text-white/20"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="px-3 py-1 text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors">Cancel</button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} className="px-3 py-1 text-[11px] font-mono bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] rounded-lg hover:bg-[var(--color-primary-accent)]/30 transition-colors">Create</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const TreeItem = React.memo(({
  node, depth = 0, onContextMenu, onRefresh, explorerIndentGuides
}: {
  node: FileEntry; depth?: number;
  onContextMenu: (e: React.MouseEvent, path: string, name: string, isDir: boolean) => void;
  onRefresh: () => void;
  explorerIndentGuides: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const { setActiveFile, getActiveGroup } = useEditorStore();
  const activeFile = getActiveGroup()?.activeFile || null;

  const handleToggle = async () => {
    if (node.isDirectory) {
      if (!isOpen && children.length === 0) {
        const { entries } = await api.readDir(node.path);
        setChildren(entries);
      }
      setIsOpen(!isOpen);
    } else {
      try {
        const { content } = await api.readFile(node.path);
        setActiveFile(node.path, node.name, content);
      } catch (err) {
        if (err instanceof Error && err.message.includes('binary_file_not_supported')) {
          setActiveFile(node.path, node.name, '');
        } else {
          console.error('Failed to read file:', err);
        }
      }
    }
  };

  const isSelected = activeFile === node.path;

  return (
    <div>
      <div
        className={`flex items-center py-[3px] cursor-pointer text-[12px] font-mono whitespace-nowrap transition-all duration-150 rounded-md mx-1 group relative
          ${isSelected
            ? 'bg-[var(--color-primary-accent)]/15 text-white'
            : 'text-white/55 hover:bg-white/5 hover:text-white/85'}`}
        onClick={handleToggle}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/mirai-file-path', node.path);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node.path, node.name, node.isDirectory);
        }}
      >
        <div className="flex shrink-0 h-full absolute left-0 top-0 bottom-0 pointer-events-none" style={{ paddingLeft: 8 }}>
          {Array.from({ length: depth }).map((_, i) => (
            <div key={i} className={`w-3 h-full border-l ${explorerIndentGuides ? 'border-white/5 group-hover:border-white/20' : 'border-transparent'}`} />
          ))}
        </div>
        
        <div className="flex items-center w-full" style={{ paddingLeft: depth * 12 + 8 }}>
          <span className="mr-1 w-4 h-4 flex items-center justify-center shrink-0 z-10">
            {node.isDirectory ? (
              isOpen ? <ChevronDown className="w-3 h-3 text-white/40 bg-black" /> : <ChevronRight className="w-3 h-3 text-white/40 bg-black" />
            ) : <span className="w-3" />}
          </span>
          <span className="mr-1.5 text-[11px] shrink-0 flex items-center justify-center z-10">
            {node.isDirectory
              ? (isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> : <Folder className="w-3.5 h-3.5 text-blue-400/70" />)
              : getFileIcon(node.name)
            }
          </span>
          <span className="truncate z-10">{node.name}</span>
        </div>
      </div>

      {isOpen && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              onRefresh={onRefresh}
              explorerIndentGuides={explorerIndentGuides}
            />
          ))}
        </div>
      )}
    </div>
  );
});
TreeItem.displayName = 'TreeItem';

export default function HyprSidebar({ isMinimized, onMinimize, onClose, onDragStart }: { isMinimized?: boolean; onMinimize?: () => void; onClose?: () => void; onDragStart?: (e: React.DragEvent) => void }) {
  const [rootNodes, setRootNodes] = useState<FileEntry[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renameTarget, setRenameTarget] = useState<ContextMenu | null>(null);
  const [newItemTarget, setNewItemTarget] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const lastWorkspaceRefresh = useRef<string | null>(null);
  const { renameTab, getActiveGroup } = useEditorStore();
  const { workspacePath } = useWorkspaceStore();
  const { editorSettings } = useSettingsStore();

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    api.readDir()
      .then(({ entries }) => {
        setRootNodes(entries);
        setTimeout(() => setIsRefreshing(false), 400); // 400ms for smooth visual transition
      })
      .catch(() => {
        setRootNodes([]);
        setIsRefreshing(false);
      });
  }, []);

  useEffect(() => {
    if (!workspacePath || lastWorkspaceRefresh.current === workspacePath) return;
    lastWorkspaceRefresh.current = workspacePath;
    refresh();
  }, [workspacePath, refresh]);

  // Real-time file system watcher WebSocket
  useEffect(() => {
    if (!workspacePath) return;
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/watcher');
    ws.onopen = () => ws.send(JSON.stringify({ event: 'watch-workspace', data: { workspacePath } }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'workspace:change') {
          refresh();
        }
      } catch {}
    };
    return () => ws.close();
  }, [workspacePath, refresh]);

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, name: string, isDir: boolean) => {
    setContextMenu({ x: e.clientX, y: e.clientY, type: isDir ? 'directory' : 'file', path, name, isDir });
  }, []);

  const handleAction = useCallback(async (action: string, target: ContextMenu) => {
    switch (action) {
      case 'rename':
        setRenameTarget(target);
        break;
      case 'delete':
        await api.deleteItem(target.path);
        refresh();
        break;
      case 'newFile': {
        const parentPath = target.isDir ? target.path : target.path.replace(/[\\/][^\\/]+$/, '');
        setNewItemTarget({ parentPath, type: 'file' });
        break;
      }
      case 'newFolder': {
        const parentPath = target.isDir ? target.path : target.path.replace(/[\\/][^\\/]+$/, '');
        setNewItemTarget({ parentPath, type: 'folder' });
        break;
      }
      case 'previewMarkdown':
        try {
          const { content } = await api.readFile(target.path);
          useEditorStore.getState().openPreview(target.path, content);
        } catch (err) {
          console.error('Failed to open markdown preview:', err);
        }
        break;
    }
  }, [refresh]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      <PanelHeader
        title="Explorer"
        isMinimized={isMinimized}
        onMinimize={onMinimize}
        onClose={onClose}
        onDragStart={onDragStart}
      >
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setNewItemTarget({ parentPath: workspacePath || '', type: 'file' })} className="text-white/30 hover:text-white/70 transition-colors p-0.5" title="New File">
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setNewItemTarget({ parentPath: workspacePath || '', type: 'folder' })} className="text-white/30 hover:text-white/70 transition-colors p-0.5" title="New Folder">
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => {
            const active = getActiveGroup()?.activeFile;
            if (active) setRenameTarget({ path: active, name: active.split(/[\\/]/).pop() || '', isDir: false, x: 0, y: 0, type: 'file' });
          }} className="text-white/30 hover:text-white/70 transition-colors p-0.5" title="Rename Active File">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('ide:command', { detail: { command: 'openFolder' } }))} className="text-white/30 hover:text-white/70 transition-colors p-0.5" title="Open Workspace">
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button onClick={refresh} className="text-white/30 hover:text-white/70 transition-colors p-0.5" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          </button>
        </div>
      </PanelHeader>

      {!isMinimized && (
        <div
          className="flex-1 overflow-y-auto custom-scrollbar py-1 relative"
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, type: 'explorer', path: rootNodes[0]?.path || '', name: '', isDir: true });
          }}
        >
          <div className="relative min-h-[100px] h-full">
            <AnimatePresence>
              {isRefreshing && (
                <motion.div
                  key="splash"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-10 flex items-start justify-center pt-4 pointer-events-none"
                >
                  <div className="w-4 h-4 border-2 border-[var(--color-primary-accent)] border-t-transparent rounded-full animate-spin opacity-50" />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div
              key="tree"
              animate={{ opacity: isRefreshing ? 0.4 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {rootNodes.map((node) => (
                <TreeItem
                  key={node.path}
                  node={node}
                  onContextMenu={handleContextMenu}
                  onRefresh={refresh}
                  explorerIndentGuides={editorSettings.explorerIndentGuides}
                />
              ))}
              {rootNodes.length === 0 && !isRefreshing && (
                <div className="text-white/30 text-xs px-4 py-3 font-mono">Empty workspace</div>
              )}
            </motion.div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {contextMenu && (
          <ContextMenuComponent
            menu={contextMenu}
            onAction={handleAction}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {!isMinimized && renameTarget && (
          <RenameDialog
            initialName={renameTarget.name}
            onConfirm={async (newName) => {
              const sep = renameTarget.path.includes('/') ? '/' : '\\';
              const parentDir = renameTarget.path.replace(/[\\/][^\\/]+$/, '');
              const newPath = parentDir + sep + newName;
              await api.renameItem(renameTarget.path, newPath);
              renameTab(renameTarget.path, newPath);
              setRenameTarget(null);
              refresh();
            }}
            onCancel={() => setRenameTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isMinimized && newItemTarget && (
          <NewItemDialog
            type={newItemTarget.type}
            onConfirm={async (name) => {
              const sep = newItemTarget.parentPath.includes('/') ? '/' : '\\';
              const fullPath = newItemTarget.parentPath + sep + name;
              if (newItemTarget.type === 'file') {
                await api.createFile(fullPath);
              } else {
                await api.createDir(fullPath);
              }
              setNewItemTarget(null);
              refresh();
            }}
            onCancel={() => setNewItemTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
