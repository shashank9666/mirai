import React, { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useEditorStore } from '@/store/editorStore';
import { Folder, FolderOpen, FileCode, File, ChevronRight, ChevronDown, Edit2, Trash2, FilePlus, FolderPlus, RotateCw } from 'lucide-react';
import { api, FileEntry, getWsBase } from '../../lib/api';
import { cn } from '../../lib/utils';

// eslint-disable-next-line prefer-const
let globalRevealPath: string | null = null;



export interface ContextMenuHandlers {
  startRename: () => void;
  startCreateFile: () => void;
  startCreateFolder: () => void;
  handleDelete: (e: React.MouseEvent) => void;
}

const FileTreeNode = ({ 
  entry, 
  depth = 0, 
  onRefresh,
  onContextMenu
}: { 
  entry: FileEntry; 
  depth?: number; 
  onRefresh: () => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry, handlers: ContextMenuHandlers) => void;
}) => {
  const separator = entry.path.includes('\\') ? '\\' : '/';
  const isParentOfReveal = React.useMemo(() => {
    const revealPath = globalRevealPath as string | null;
    if (!revealPath || !entry.isDirectory) return false;
    return revealPath.startsWith(entry.path + separator);
  }, [entry.path, entry.isDirectory, separator]);

  const [isOpen, setIsOpen] = useState(() => {
    if (isParentOfReveal) return true;
    try {
      return localStorage.getItem(`mirai-explorer-open-${entry.path}`) === 'true';
    } catch {
      return false;
    }
  });
  const [isHighlighted, setIsHighlighted] = useState(() => {
    return globalRevealPath === entry.path;
  });
  const [children, setChildren] = useState<FileEntry[]>([]);
  const { setActiveFile, renameTab, closeTab } = useEditorStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);

  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [createValue, setCreateValue] = useState('');

  const loadChildren = React.useCallback(async () => {
    try {
      const result = await api.readDir(entry.path);
      setChildren(result.entries);
    } catch (error) {
      console.error("Failed to read directory", error);
    }
  }, [entry.path]);

  React.useEffect(() => {
    if (entry.isDirectory && isOpen && children.length === 0) {
      const fetchInitial = async () => {
        try {
          const result = await api.readDir(entry.path);
          setChildren(result.entries);
        } catch (error) {
          console.error("Failed to read directory", error);
        }
      };
      fetchInitial();
    }
    try {
      if (isOpen) {
        localStorage.setItem(`mirai-explorer-open-${entry.path}`, 'true');
      } else {
        localStorage.removeItem(`mirai-explorer-open-${entry.path}`);
      }
    } catch {}
  }, [isOpen, entry.isDirectory, entry.path, children.length]);

  React.useEffect(() => {
    if (!entry.isDirectory || !isOpen) return;

    const handleFsChange = (e: Event) => {
      const data = (e as CustomEvent).detail;
      const targetPath = data.path || data.newPath || data.oldPath;
      if (targetPath) {
        // If the path starts with this directory path, refresh its children
        const isChildOrSelf = targetPath.startsWith(entry.path);
        if (isChildOrSelf) {
          loadChildren();
        }
      }
    };

    window.addEventListener('workspace-fs-change', handleFsChange);
    return () => {
      window.removeEventListener('workspace-fs-change', handleFsChange);
    };
  }, [entry.path, isOpen, entry.isDirectory, loadChildren]);

  React.useEffect(() => {
    const handleReveal = (e: Event) => {
      const targetPath = (e as CustomEvent).detail.path;
      if (targetPath) {
        const sep = entry.path.includes('\\') ? '\\' : '/';
        const isParent = entry.isDirectory && targetPath.startsWith(entry.path + sep);
        if (isParent) {
          setIsOpen(true);
        }
        
        const matches = targetPath === entry.path;
        setIsHighlighted(matches);
        if (matches) {
          setTimeout(() => {
            const el = document.getElementById(`explorer-node-${entry.path.replace(/[^a-zA-Z0-9]/g, '-')}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 100);
        }
      }
    };
    window.addEventListener('mirai-reveal-in-explorer', handleReveal);
    return () => {
      window.removeEventListener('mirai-reveal-in-explorer', handleReveal);
    };
  }, [entry.path, entry.isDirectory]);

  const handleClick = async () => {
    if (isRenaming) return;

    if (entry.isDirectory) {
      if (!isOpen && children.length === 0) {
        await loadChildren();
      }
      setIsOpen(!isOpen);
    } else {
      try {
        const { content } = await api.readFile(entry.path);
        setActiveFile(entry.path, entry.name, content);
      } catch (err) {
        if (err instanceof Error && err.message.includes('binary_file_not_supported')) {
          setActiveFile(entry.path, entry.name, '');
        } else {
          console.error("Failed to read file", err);
        }
      }
    }
  };

  const handleRename = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      try {
        const separator = entry.path.includes('\\') ? '\\' : '/';
        const finalNewPath = entry.path.substring(0, entry.path.lastIndexOf(separator) + 1) + renameValue;

        await api.renameItem(entry.path, finalNewPath);
        renameTab(entry.path, finalNewPath);
        setIsRenaming(false);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setRenameValue(entry.name);
    }
  };

  const handleCreate = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      try {
        const separator = entry.path.includes('\\') ? '\\' : '/';
        const newPath = entry.path + separator + createValue;
        if (isCreating === 'file') {
          await api.createFile(newPath);
          setActiveFile(newPath, createValue, '');
        } else {
          await api.createDir(newPath);
        }
        setIsCreating(null);
        setCreateValue('');
        await loadChildren();
        if (!isOpen) setIsOpen(true);
      } catch (err) {
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setIsCreating(null);
      setCreateValue('');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${entry.name}?`)) {
      try {
        await api.deleteItem(entry.path);
        closeTab(entry.path);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div>
      <div
        id={`explorer-node-${entry.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
        className={cn(
          "group flex items-center justify-between px-2 py-1 hover:bg-mirai-surface-hover cursor-pointer text-mirai-text-dim hover:text-mirai-text transition-colors select-none",
          isHighlighted && "bg-primary/20 text-primary border-l-2 border-primary font-semibold"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        draggable={!entry.isDirectory}
        onDragStart={(e) => {
          if (!entry.isDirectory) {
            e.dataTransfer.setData('application/mirai-file-path', entry.path);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, entry, {
            startRename: () => setIsRenaming(true),
            startCreateFile: () => { setIsCreating('file'); setIsOpen(true); },
            startCreateFolder: () => { setIsCreating('folder'); setIsOpen(true); },
            handleDelete: (me: React.MouseEvent) => handleDelete(me)
          });
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
          {entry.isDirectory ? (
            <>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {isOpen ? <FolderOpen size={14} className="text-mirai-accent flex-shrink-0" /> : <Folder size={14} className="text-mirai-accent flex-shrink-0" />}
            </>
          ) : (
            <>
              <span className="w-[14px]"></span>
              {entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? (
                <FileCode size={14} className="text-blue-400 flex-shrink-0" />
              ) : (
                <File size={14} className="flex-shrink-0" />
              )}
            </>
          )}
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRename}
              onBlur={() => setIsRenaming(false)}
              className="bg-background text-[13px] border border-border px-1 w-full text-foreground"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-[13px] truncate">{entry.name}</span>
          )}
        </div>

        {isHovered && !isRenaming && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
            {entry.isDirectory && (
              <>
                <button title="New File" onClick={(e) => { e.stopPropagation(); setIsCreating('file'); setIsOpen(true); }} className="hover:text-foreground">
                  <FilePlus size={13} />
                </button>
                <button title="New Folder" onClick={(e) => { e.stopPropagation(); setIsCreating('folder'); setIsOpen(true); }} className="hover:text-foreground">
                  <FolderPlus size={13} />
                </button>
              </>
            )}
            <button title="Rename" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }} className="hover:text-foreground">
              <Edit2 size={13} />
            </button>
            <button title="Delete" onClick={handleDelete} className="hover:text-red-400">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Render create input if active */}
      {isCreating && (
        <div style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }} className="flex items-center gap-1.5 px-2 py-1 bg-black/10">
          {isCreating === 'folder' ? <Folder size={14} className="text-mirai-accent" /> : <File size={14} />}
          <input
            autoFocus
            value={createValue}
            onChange={(e) => setCreateValue(e.target.value)}
            onKeyDown={handleCreate}
            onBlur={() => setIsCreating(null)}
            className="bg-background text-[13px] border border-border px-1 w-full text-foreground"
          />
        </div>
      )}

      {/* Render children */}
      {isOpen && entry.isDirectory && (
        <div className="flex flex-col">
          {children.map(child => (
            <FileTreeNode 
              key={child.path} 
              entry={child} 
              depth={depth + 1} 
              onRefresh={loadChildren}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Explorer() {
  const { workspacePath, fileTree, setWorkspacePath, setFileTree } = useWorkspaceStore();
  const { setActiveFile } = useEditorStore();

  const [isCreatingRoot, setIsCreatingRoot] = useState<'file' | 'folder' | null>(null);
  const [createRootValue, setCreateRootValue] = useState('');
  
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
    handlers: ContextMenuHandlers;
  } | null>(null);

  React.useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const checkBackend = React.useCallback(async () => {
    try {
      await api.healthCheck();
    } catch {
      // Handle error
    }
  }, []);

  React.useEffect(() => {
    setTimeout(() => { void checkBackend(); }, 0);
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  const loadRoot = React.useCallback(async (path?: string) => {
    try {
      const target = path || useWorkspaceStore.getState().workspacePath;
      if (!target) return;
      const result = await api.readDir(target);
      if (useWorkspaceStore.getState().workspacePath !== result.path) {
        setWorkspacePath(result.path);
      }
      setFileTree(result.entries);
    } catch (error) {
      console.error("Error reading root folder:", error);
    }
  }, [setWorkspacePath, setFileTree]);

  React.useEffect(() => {
    if (workspacePath) {
      setTimeout(() => { void loadRoot(workspacePath); }, 0);
    }
  }, [workspacePath, loadRoot]);

  React.useEffect(() => {
    const currentWorkspacePath = useWorkspaceStore.getState().workspacePath;
    if (!currentWorkspacePath) return;

    const ws = new WebSocket(`${getWsBase()}/ws/watcher`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'watch-workspace', data: { workspacePath: currentWorkspacePath } }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'workspace:change') {
          const data = msg.data;
          loadRoot(currentWorkspacePath);
          window.dispatchEvent(new CustomEvent('workspace-fs-change', { detail: data }));

          if (data.path && (data.type === 'writeFile' || data.type === 'createFile')) {
            const editorState = useEditorStore.getState();
            const normalizePath = (p: string) => p ? p.replace(/[/\\]/g, '/').toLowerCase() : '';
            const normDataPath = normalizePath(data.path);
            const isFileOpen = editorState.groups.some(group => 
              group.tabs.some(tab => normalizePath(tab.path) === normDataPath)
            );
            if (isFileOpen) {
              try {
                await editorState.revertFile(data.path);
              } catch (err) {
                console.error("Failed to read updated file content:", err);
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parsing websocket message", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [workspacePath, loadRoot]);

  const handleOpenFolder = async () => {
    const p = prompt('Enter workspace path:');
    if (p) {
      await loadRoot(p);
    }
  };

  const handleCreateRoot = async (e: React.KeyboardEvent) => {
    if (!workspacePath) return;

    if (e.key === 'Enter') {
      try {
        const value = createRootValue.trim();
        if (!value) {
          setIsCreatingRoot(null);
          setCreateRootValue('');
          return;
        }
        const separator = workspacePath.includes('\\') ? '\\' : '/';
        const newPath = workspacePath + separator + value;
        if (isCreatingRoot === 'file') {
          await api.createFile(newPath);
          setActiveFile(newPath, value, '');
        } else {
          await api.createDir(newPath);
        }
        setIsCreatingRoot(null);
        setCreateRootValue('');
        await loadRoot();
      } catch (err) {
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setIsCreatingRoot(null);
      setCreateRootValue('');
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {workspacePath && (
        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-border/50 flex justify-between items-center group sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-xs font-medium text-foreground truncate max-w-[150px]">{workspacePath.split(/[\/\\]/).pop()}</span>
          <div className="flex items-center gap-2">
            <button title="New File" onClick={() => setIsCreatingRoot('file')} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <FilePlus size={14} />
            </button>
            <button title="New Folder" onClick={() => setIsCreatingRoot('folder')} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <FolderPlus size={14} />
            </button>
            <button title="Refresh Explorer" onClick={() => loadRoot()} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <RotateCw size={14} />
            </button>
            <button onClick={handleOpenFolder} className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">Change</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {!workspacePath ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-4">
            <FolderOpen size={48} className="text-muted-foreground/30 mb-2" />
            <p className="text-[13px] text-muted-foreground">No folder opened</p>
            <button
              onClick={handleOpenFolder}
              className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity rounded-md text-[13px] font-medium w-full shadow-sm"
            >
              Open Folder
            </button>
          </div>
        ) : (
          <div className="flex flex-col py-2">
            {isCreatingRoot && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-black/5 dark:bg-white/5" style={{ paddingLeft: '8px' }}>
                {isCreatingRoot === 'folder' ? <Folder size={14} className="text-mirai-accent flex-shrink-0" /> : <File size={14} className="flex-shrink-0" />}
                <input
                  autoFocus
                  value={createRootValue}
                  onChange={(e) => setCreateRootValue(e.target.value)}
                  onKeyDown={handleCreateRoot}
                  onBlur={() => setIsCreatingRoot(null)}
                  className="bg-background text-[13px] border border-border px-1 w-full text-foreground"
                />
              </div>
            )}

            {fileTree.map(entry => (
              <FileTreeNode 
                key={entry.path} 
                entry={entry} 
                onRefresh={() => loadRoot()} 
                onContextMenu={(e, entry, handlers) => {
                  setContextMenu({ x: e.clientX, y: e.clientY, entry, handlers });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <div 
          className="fixed z-50 w-48 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.entry.isDirectory && (
            <>
              <button 
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => { contextMenu.handlers.startCreateFile(); setContextMenu(null); }}
              >
                New File
              </button>
              <button 
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => { contextMenu.handlers.startCreateFolder(); setContextMenu(null); }}
              >
                New Folder
              </button>
              <div className="h-px bg-border/50 my-1 w-full" />
            </>
          )}
          <button 
            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => { contextMenu.handlers.startRename(); setContextMenu(null); }}
          >
            Rename
          </button>
          <div className="h-px bg-border/50 my-1 w-full" />
          <button 
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500 hover:text-white transition-colors"
            onClick={(e) => { contextMenu.handlers.handleDelete(e); setContextMenu(null); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
