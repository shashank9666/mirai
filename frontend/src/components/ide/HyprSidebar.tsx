'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, FileEntry } from '@/lib/api';
import { useIdeStore } from '@/store/ideStore';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';

const FILE_ICONS: Record<string, string> = {
  '.tsx': '\u269B\uFE0F', '.ts': '\uD83D\uDD37', '.js': '\uD83D\uDFE1', '.jsx': '\u269B\uFE0F',
  '.css': '\uD83C\uDFA8', '.json': '\uD83D\uDCCB', '.md': '\uD83D\uDCDD', '.py': '\uD83D\uDC0D',
  '.html': '\uD83C\uDF10', '.env': '\uD83D\uDD12', '.gitignore': '\uD83D\uDE48',
};

const getFileIcon = (name: string) => {
  const ext = '.' + name.split('.').pop();
  return FILE_ICONS[ext] || '\uD83D\uDCC4';
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
    { label: 'Rename', action: 'rename', key: 'r' },
    { label: 'Delete', action: 'delete', key: 'del', danger: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px]"
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
    </div>
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
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
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
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}

const TreeItem = ({
  node, depth = 0, onContextMenu, onRefresh,
}: {
  node: FileEntry; depth?: number;
  onContextMenu: (e: React.MouseEvent, path: string, name: string, isDir: boolean) => void;
  onRefresh: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const { setActiveFile, getActiveGroup } = useIdeStore();
  const activeFile = getActiveGroup()?.activeFile || null;

  const handleToggle = async () => {
    if (node.isDirectory) {
      if (!isOpen && children.length === 0) {
        const { entries } = await api.readDir(node.path);
        setChildren(entries);
      }
      setIsOpen(!isOpen);
    } else {
      const { content } = await api.readFile(node.path);
      setActiveFile(node.path, node.name, content);
    }
  };

  const isSelected = activeFile === node.path;

  return (
    <div>
      <div
        className={`flex items-center py-[3px] cursor-pointer text-[12px] font-mono whitespace-nowrap transition-all duration-150 rounded-md mx-1 group
          ${isSelected
            ? 'bg-[var(--color-primary-accent)]/15 text-white'
            : 'text-white/55 hover:bg-white/5 hover:text-white/85'}`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node.path, node.name, node.isDirectory);
        }}
      >
        <span className="mr-1 w-4 h-4 flex items-center justify-center shrink-0">
          {node.isDirectory ? (
            isOpen ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />
          ) : <span className="w-3" />}
        </span>
        <span className="mr-1.5 text-[11px] shrink-0">
          {node.isDirectory
            ? (isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> : <Folder className="w-3.5 h-3.5 text-blue-400/70" />)
            : <span>{getFileIcon(node.name)}</span>
          }
        </span>
        <span className="truncate">{node.name}</span>
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function HyprSidebar() {
  const [rootNodes, setRootNodes] = useState<FileEntry[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renameTarget, setRenameTarget] = useState<ContextMenu | null>(null);
  const [newItemTarget, setNewItemTarget] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const { renameTab } = useIdeStore();

  const refresh = useCallback(() => {
    api.readDir().then(({ entries }) => setRootNodes(entries));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
      case 'newFile':
        setNewItemTarget({ parentPath: target.path, type: 'file' });
        break;
      case 'newFolder':
        setNewItemTarget({ parentPath: target.path, type: 'folder' });
        break;
    }
  }, [refresh]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0 flex items-center justify-between">
        <span>Explorer</span>
        <button onClick={refresh} className="text-white/30 hover:text-white/70 transition-colors" title="Refresh">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto custom-scrollbar py-1"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, type: 'explorer', path: rootNodes[0]?.path || '', name: '', isDir: true });
        }}
      >
        {rootNodes.map(node => (
          <TreeItem
            key={node.path}
            node={node}
            onContextMenu={handleContextMenu}
            onRefresh={refresh}
          />
        ))}
        {rootNodes.length === 0 && (
          <div className="text-white/30 text-xs px-4 py-3 font-mono animate-pulse">Loading project...</div>
        )}
      </div>

      {contextMenu && (
        <ContextMenuComponent
          menu={contextMenu}
          onAction={handleAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {renameTarget && (
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

      {newItemTarget && (
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
    </div>
  );
}
