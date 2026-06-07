import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useWindowManagerStore } from '../../store/useWindowManagerStore';
import { X, PanelRightClose, Columns, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '../../lib/api';

export default function EditorTabs({ groupId }: { groupId: string }) {
  const { 
    editorGroups, 
    activeGroupId, 
    setActiveGroup, 
    closeFile, 
    setActiveFileIndex, 
    splitEditor, 
    closeGroup,
    reorderFiles,
    togglePinFile,
    closeOthers,
    closeToTheRight,
    closeSaved,
    closeAll
  } = useWorkspaceStore();
  
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);

  const group = editorGroups.find(g => g.id === groupId);
  
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  if (!group) return null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    const srcIndexStr = e.dataTransfer.getData('text/plain');
    if (srcIndexStr) {
      const srcIndex = parseInt(srcIndexStr, 10);
      if (srcIndex !== targetIndex) {
        reorderFiles(groupId, srcIndex, targetIndex);
      }
    }
  };

  const handleCopyPath = async (filePath: string) => {
    try {
      await navigator.clipboard.writeText(filePath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyRelativePath = async (filePath: string) => {
    try {
      const workspacePath = useWorkspaceStore.getState().workspacePath || '';
      let relPath = filePath;
      if (workspacePath && filePath.startsWith(workspacePath)) {
        relPath = filePath.substring(workspacePath.length);
        if (relPath.startsWith('/') || relPath.startsWith('\\')) {
          relPath = relPath.substring(1);
        }
      }
      await navigator.clipboard.writeText(relPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevealInFileExplorer = async (filePath: string) => {
    try {
      await api.revealInExplorer(filePath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevealInExplorerView = (filePath: string) => {
    window.dispatchEvent(new CustomEvent('mirai-reveal-in-explorer', { detail: { path: filePath } }));
  };

  const handleFindFileReferences = (filePath: string) => {
    const filename = filePath.split(/[/\\]/).pop() || '';
    useWindowManagerStore.getState().ensureWindow('search', 'Search');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mirai-search-trigger', { detail: { query: filename } }));
    }, 150);
  };

  return (
    <div className="flex bg-muted overflow-x-auto no-scrollbar border-b border-border flex-shrink-0 drag-region select-none relative">
      <div className="flex flex-1">
        {group.openFiles.map((file, index) => {
          const filename = file.path.split(/[/\\]/).pop();
          const isActive = group.activeFileIndex === index;
          const isDirty = file.content !== (file.originalContent || '');

          return (
            <div
              key={`${file.path}-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                "group flex items-center h-9 px-3 border-r border-border min-w-[120px] max-w-[200px] cursor-pointer no-drag transition-all duration-150 relative",
                isActive 
                  ? "bg-background text-primary border-t-2 border-t-primary" 
                  : "bg-muted text-muted-foreground border-t-2 border-t-transparent hover:bg-background hover:text-foreground",
                dragOverIndex === index && "border-l-2 border-l-primary/70 bg-primary/5",
                file.pinned && "font-semibold"
              )}
              onClick={() => {
                setActiveGroup(groupId);
                setActiveFileIndex(groupId, index);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  index
                });
              }}
            >
              {file.pinned && <Pin size={10} className="mr-1.5 text-primary rotate-45" />}
              <span className="truncate flex-1 text-[13px]">{filename}</span>
              {(() => {
                return (
                  <button
                    className={cn(
                      "ml-2 p-0.5 rounded-md hover:bg-white/10 transition-opacity flex items-center justify-center min-w-[20px] min-h-[20px]",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDirty) {
                        if (!confirm(`You have unsaved changes in ${filename}. Are you sure you want to close it?`)) {
                          return;
                        }
                      }
                      closeFile(groupId, index);
                    }}
                  >
                    {isDirty ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary block group-hover:hidden" />
                    ) : null}
                    <X size={14} className={cn(isDirty ? "hidden group-hover:block" : "block")} />
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center px-2 gap-1 no-drag">
        <button 
          onClick={() => { setActiveGroup(groupId); splitEditor('right'); }}
          className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          title="Split Editor Right"
        >
          <Columns size={14} />
        </button>
        {editorGroups.length > 1 && (
          <button 
            onClick={() => closeGroup(groupId)}
            className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title="Close Editor Group"
          >
            <PanelRightClose size={14} />
          </button>
        )}
      </div>

      {contextMenu && group.openFiles[contextMenu.index] && (() => {
        const file = group.openFiles[contextMenu.index];
        const index = contextMenu.index;
        return (
          <div 
            className="fixed z-[9999] w-72 bg-[#1f1e1b] border border-border/60 rounded-md shadow-2xl py-1 text-foreground text-[12px] font-medium"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { closeFile(groupId, index); setContextMenu(null); }}
            >
              <span>Close</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Ctrl+F4</span>
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { closeOthers(groupId, index); setContextMenu(null); }}
            >
              <span>Close Others</span>
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { closeToTheRight(groupId, index); setContextMenu(null); }}
            >
              <span>Close to the Right</span>
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { closeSaved(groupId); setContextMenu(null); }}
            >
              <span>Close Saved</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Ctrl+K U</span>
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { closeAll(groupId); setContextMenu(null); }}
            >
              <span>Close All</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Ctrl+K W</span>
            </button>
            
            <div className="h-px bg-border/50 my-1 w-full" />
            
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { handleCopyPath(file.path); setContextMenu(null); }}
            >
              <span>Copy Path</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Shift+Alt+C</span>
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { handleCopyRelativePath(file.path); setContextMenu(null); }}
            >
              <span>Copy Relative Path</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Ctrl+K Ctrl+Shift+C</span>
            </button>
            
            <div className="h-px bg-border/50 my-1 w-full" />
            
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { togglePinFile(groupId, index); setContextMenu(null); }}
            >
              <span>{file.pinned ? 'Unpin' : 'Pin'}</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Ctrl+K Shift+Enter</span>
            </button>
            
            <div className="h-px bg-[#333333] my-1 w-full" />

            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { handleRevealInFileExplorer(file.path); setContextMenu(null); }}
            >
              <span>Reveal in File Explorer</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Shift+Alt+R</span>
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { handleRevealInExplorerView(file.path); setContextMenu(null); }}
            >
              <span>Reveal in Explorer View</span>
            </button>
            
            <div className="h-px bg-[#333333] my-1 w-full" />

            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { setActiveGroup(groupId); splitEditor('right'); setContextMenu(null); }}
            >
              <span>Split Right</span>
              <span className="text-muted-foreground text-[10px] ml-auto opacity-70">Ctrl+\</span>
            </button>
            
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground flex justify-between items-center transition-colors"
              onClick={() => { handleFindFileReferences(file.path); setContextMenu(null); }}
            >
              <span>Find File References</span>
            </button>
            
            <div className="h-px bg-[#333333] my-1 w-full" />

            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-red-500/20 hover:text-red-400 flex justify-between items-center transition-colors text-muted-foreground"
              onClick={() => setContextMenu(null)}
            >
              <span>Cancel</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
}
