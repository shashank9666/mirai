import React from 'react';
import { Search, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useWindowManagerStore } from "@/store/useWindowManagerStore";
import Image from "next/image";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuPortal } from '@radix-ui/react-dropdown-menu';
import { api } from '@/lib/api';

export default function TitleBar() {
  const { setCommandPaletteOpen } = useWorkspaceStore();
  const { zoom, setZoom } = useSettingsStore();
  const { spawnWindow } = useWindowManagerStore();

  const handleZoomIn = () => { console.log('Action: Zoom In'); setZoom(Math.min(2.0, (zoom || 1.0) + 0.1)); };
  const handleZoomOut = () => { console.log('Action: Zoom Out'); setZoom(Math.max(0.6, (zoom || 1.0) - 0.1)); };
  const handleZoomReset = () => { console.log('Action: Reset Zoom'); setZoom(1.0); };

  const handleNewFile = async () => {
    console.log('Action: New File');
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    if (!workspacePath) {
      alert('Please open a folder first.');
      return;
    }
    const name = prompt('Enter new file name (e.g. index.js):');
    if (name) {
      const fullPath = workspacePath + '/' + name.replace(/^[/\\]/, '');
      try {
        await api.createFile(fullPath);
        let language = 'plaintext';
        if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) language = 'typescript';
        else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) language = 'javascript';
        else if (fullPath.endsWith('.json')) language = 'json';
        else if (fullPath.endsWith('.css')) language = 'css';
        else if (fullPath.endsWith('.html')) language = 'html';
        else if (fullPath.endsWith('.md')) language = 'markdown';
        
        useWorkspaceStore.getState().openFile({ path: fullPath, content: '', language });
        spawnWindow('editor', 'Code Editor');
      } catch (err) {
        alert(`Failed to create file: ${err}`);
      }
    }
  };

  const handleNewFolder = async () => {
    console.log('Action: New Folder');
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    if (!workspacePath) {
      alert('Please open a folder first.');
      return;
    }
    const name = prompt('Enter new folder name:');
    if (name) {
      const fullPath = workspacePath + '/' + name.replace(/^[/\\]/, '');
      try {
        await api.createDir(fullPath);
      } catch (err) {
        alert(`Failed to create folder: ${err}`);
      }
    }
  };

  const handleSave = async () => {
    console.log('Action: Save File');
    const workspaceState = useWorkspaceStore.getState();
    const activeGroupId = workspaceState.activeGroupId;
    const group = workspaceState.editorGroups.find(g => g.id === activeGroupId);
    if (group && group.activeFileIndex >= 0 && group.activeFileIndex < group.openFiles.length) {
      const activeFile = group.openFiles[group.activeFileIndex];
      try {
        await api.writeFile(activeFile.path, activeFile.content);
        workspaceState.updateOpenFileContent(activeFile.path, activeFile.content);
      } catch (err) {
        alert(`Failed to save file: ${err}`);
      }
    } else {
      alert('No active file to save.');
    }
  };

  const handleSaveAll = async () => {
    const workspaceState = useWorkspaceStore.getState();
    let count = 0;
    for (const group of workspaceState.editorGroups) {
      for (const file of group.openFiles) {
        const isDirty = file.content !== (file.originalContent || '');
        if (isDirty) {
          try {
            await api.writeFile(file.path, file.content);
            workspaceState.updateOpenFileContent(file.path, file.content);
            count++;
          } catch (err) {
            console.error(`Failed to save ${file.path}:`, err);
          }
        }
      }
    }
    alert(`Saved ${count} modified file(s).`);
  };

  const handleUndo = () => {
    window.dispatchEvent(new CustomEvent('mirai-undo'));
  };

  const handleRedo = () => {
    window.dispatchEvent(new CustomEvent('mirai-redo'));
  };

  const handleSelectAll = () => {
    window.dispatchEvent(new CustomEvent('mirai-select-all'));
  };

  const handleGoToLine = () => {
    const lineStr = prompt('Go to Line:');
    if (lineStr) {
      const line = parseInt(lineStr, 10);
      if (!isNaN(line) && line > 0) {
        const ws = useWorkspaceStore.getState();
        const group = ws.editorGroups.find(g => g.id === ws.activeGroupId);
        if (group && group.activeFileIndex >= 0) {
          const file = group.openFiles[group.activeFileIndex];
          ws.openFile({ ...file, scrollTargetLine: line });
        }
      }
    }
  };

  const handleSplitTerminal = () => {
    window.dispatchEvent(new CustomEvent('mirai-terminal-split'));
  };

  return (
    <div className="w-full h-10 bg-titlebar border-b border-border flex items-center shrink-0 z-50 drag-region">
      <div className="flex items-center h-full w-full px-2">
        {/* Logo / Drag Handle */}
        <div className="flex items-center gap-1 cursor-default text-muted-foreground hover:text-foreground">
          <div className="relative w-6 h-6 mx-1 shrink-0 no-drag">
            <Image src="/logo.png" alt="Mirai Logo" fill className="object-contain" unoptimized />
          </div>
        </div>

        <div className="flex items-center flex-1 overflow-hidden">
                {/* Menus */}
                <div className="flex gap-2 text-xs font-medium text-muted-foreground ml-3 shrink-0 relative z-50 no-drag">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">File</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-48 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={handleNewFile} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">New File</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleNewFolder} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">New Folder</DropdownMenuItem>
                        <DropdownMenuSeparator className="h-px bg-border/50 my-1" />
                        <DropdownMenuItem onClick={handleSave} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Save</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSaveAll} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Save All</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">Edit</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-48 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={handleUndo} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Undo</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleRedo} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Redo</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">View</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-56 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={handleZoomIn} className="flex items-center justify-between px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">
                          <span className="flex items-center gap-2"><ZoomIn size={14} /> Zoom In</span>
                          <span className="text-muted-foreground/60">Ctrl+=</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleZoomOut} className="flex items-center justify-between px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">
                          <span className="flex items-center gap-2"><ZoomOut size={14} /> Zoom Out</span>
                          <span className="text-muted-foreground/60">Ctrl+-</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="h-px bg-border/50 my-1" />
                        <DropdownMenuItem onClick={handleZoomReset} className="flex items-center justify-between px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">
                          <span className="flex items-center gap-2"><RotateCcw size={14} /> Reset Zoom</span>
                          <span className="text-muted-foreground/60">Ctrl+0</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>

                  {/* Selection Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">Selection</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-48 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={handleSelectAll} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Select All</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>

                  {/* Go Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">Go</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-48 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={() => setCommandPaletteOpen(true)} className="flex items-center justify-between px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">
                          <span>Go to File...</span>
                          <span className="text-muted-foreground/60">Ctrl+P</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleGoToLine} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Go to Line...</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>

                  {/* Run Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">Run</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-56 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={() => spawnWindow('terminal', 'Terminal', { command: 'npm run dev' })} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Run Project (dev)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => spawnWindow('terminal', 'Terminal', { command: 'npm run build' })} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Build Project</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>

                  {/* Terminal Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">Terminal</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-48 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={() => spawnWindow('terminal')} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">New Terminal</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSplitTerminal} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">Split Terminal</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>

                  {/* Help Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground cursor-pointer transition-colors px-1 outline-none">Help</DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent className="w-56 bg-[#1f1e1b] border border-border/50 rounded-md shadow-xl text-foreground text-xs py-1 z-[100]" align="start">
                        <DropdownMenuItem onClick={() => alert('Mirai Editor - A Premium Agentic Code IDE built on Next.js and Electron.')} className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors">About Mirai</DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => { 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            if (typeof window !== 'undefined' && (window as any).electronAPI?.toggleDevTools) {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              (window as any).electronAPI.toggleDevTools();
                            }
                          }} 
                          className="px-3 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer outline-none transition-colors"
                        >
                          Toggle Developer Tools
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>
                </div>

                {/* Search Bar & Window Controls Padding */}
                <div className="flex-1 px-3 pr-[200px] flex justify-end items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 no-drag">
                    <button
                      onClick={handleZoomOut}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Zoom Out (Ctrl+-)"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <span className="text-[11px] text-muted-foreground font-medium tabular-nums min-w-[3ch] text-center">
                      {Math.round((zoom || 1.0) * 100)}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Zoom In (Ctrl+=)"
                    >
                      <ZoomIn size={13} />
                    </button>
                    <button
                      onClick={handleZoomReset}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                      title="Reset Zoom (Ctrl+0)"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="w-7 h-7 flex items-center justify-center bg-muted/50 hover:bg-muted border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors no-drag"
                    title="Command Palette (Ctrl+P)"
                  >
                    <Search size={14} />
                  </button>
                </div>
        </div>
      </div>
    </div>
  );
}
