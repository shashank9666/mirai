import React, { useEffect, useState, useCallback } from 'react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useWindowManagerStore } from '@/store/useWindowManagerStore';
import { useApprovalStore } from '@/store/useApprovalStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { api } from '@/lib/api';
import EditorTabs from './EditorTabs';
import MonacoEditor from './MonacoEditor';
import Image from 'next/image';
import { FileUp, Check, X, Map, AlignLeft, WrapText, Wand2 } from 'lucide-react';

const getLanguage = (path: string) => {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.rs')) return 'rust';
  if (path.endsWith('.go')) return 'go';
  if (path.endsWith('.java')) return 'java';
  if (path.endsWith('.rb')) return 'ruby';
  if (path.endsWith('.php')) return 'php';
  if (path.endsWith('.c') || path.endsWith('.cpp') || path.endsWith('.h') || path.endsWith('.hpp')) return 'cpp';
  return 'plaintext';
};

export default function EditorContainer({ nodeId }: { nodeId: string }) {
  const { editorGroups, ensureGroup, updateActiveFileContent, setActiveGroup, openFile } = useWorkspaceStore();
  const [isDragOver, setIsDragOver] = useState(false);
  
  useEffect(() => {
    ensureGroup(nodeId);
  }, [nodeId, ensureGroup]);

  const pendingApproval = useApprovalStore(state => state.pending);
  const isPendingFileEdit = pendingApproval && ['writeFile', 'replaceInFile'].includes(pendingApproval.call.name);

  const group = editorGroups.find(g => g.id === nodeId);
  const { editorMinimapEnabled, editorWordWrap, setEditorMinimapEnabled, setEditorWordWrap } = useSettingsStore();

  const handleFormat = () => {
    window.dispatchEvent(new CustomEvent('mirai-format-document'));
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];

    // Electron: file.path gives the full system path
    const filePath = (file as File & { path?: string }).path;
    if (filePath) {
      try {
        const content = await api.readFile(filePath);
        openFile({
          path: filePath,
          content,
          originalContent: content,
          language: getLanguage(filePath)
        });
        useWindowManagerStore.getState().focusWindow(nodeId);
        return;
      } catch {
        // Fall through to browser FileReader
      }
    }

    // Browser fallback: read file content via FileReader
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string || '';
      const name = file.name;
      const fakePath = name;
      openFile({
        path: fakePath,
        content,
        originalContent: content,
        language: getLanguage(name)
      });
      useWindowManagerStore.getState().focusWindow(nodeId);
    };
    reader.readAsText(file);
  }, [nodeId, openFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  if (!group) {
    return <div className="h-full w-full bg-background" />;
  }

  const activeFile = group.activeFileIndex >= 0 ? group.openFiles[group.activeFileIndex] : null;

  return (
    <div 
      className="flex flex-col h-full w-full bg-background relative" 
      onClick={() => setActiveGroup(group.id)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <FileUp size={40} />
            <span className="text-sm font-semibold">Drop file to open</span>
          </div>
        </div>
      )}

      <EditorTabs groupId={group.id} />
      
      <div className="flex-1 overflow-hidden relative group">
        {pendingApproval && isPendingFileEdit ? (
          <div className="h-full w-full relative">
            {(() => {
              let pendingLanguage = 'plaintext';
              let pendingPath = 'pending-diff';
              try {
                const args = typeof pendingApproval.call.arguments === 'string' 
                  ? JSON.parse(pendingApproval.call.arguments) 
                  : pendingApproval.call.arguments;
                if (args && args.path) {
                  pendingLanguage = getLanguage(args.path);
                  pendingPath = args.path;
                }
              } catch {
                pendingLanguage = getLanguage(activeFile?.path || '');
              }
              return (
                <MonacoEditor
                  value={pendingApproval.newContent || ''}
                  originalValue={pendingApproval.oldContent || ''}
                  language={pendingLanguage}
                  path={pendingPath}
                  groupId={group.id}
                  onChange={() => {}}
                />
              );
            })()}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-popover/90 backdrop-blur-md border border-border rounded-full flex items-center gap-3 z-20 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300">
              <span className="text-xs text-muted-foreground mr-1 font-medium hidden md:inline">Diff Pending</span>
              <button
                onClick={() => pendingApproval.resolve(false)}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border cursor-pointer"
                title="Reject changes (Ctrl+Backspace)"
              >
                <X size={13} />
                Reject <span className="text-[9px] opacity-50 ml-0.5 hidden sm:inline">Ctrl+⌫</span>
              </button>
              <button
                onClick={() => pendingApproval.resolve(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md cursor-pointer"
                title="Accept changes (Ctrl+Enter)"
              >
                <Check size={13} />
                Accept <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">Ctrl+↵</span>
              </button>
            </div>
          </div>
        ) : activeFile ? (
          <>
            <div className="absolute top-4 right-6 z-10 flex items-center gap-1.5 p-1 rounded-md bg-popover/80 backdrop-blur-sm border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditorMinimapEnabled(!editorMinimapEnabled)}
                className={`p-1.5 rounded-sm hover:bg-muted transition-colors ${editorMinimapEnabled ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                title="Toggle Minimap"
              >
                {editorMinimapEnabled ? <Map size={14} /> : <AlignLeft size={14} />}
              </button>
              <button
                onClick={() => setEditorWordWrap(!editorWordWrap)}
                className={`p-1.5 rounded-sm hover:bg-muted transition-colors ${editorWordWrap ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                title="Toggle Word Wrap"
              >
                <WrapText size={14} />
              </button>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
              <button
                onClick={handleFormat}
                className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground transition-colors"
                title="Format Document (Ctrl+Shift+F)"
              >
                <Wand2 size={14} />
              </button>
            </div>
            <MonacoEditor
              key={activeFile.path}
              value={activeFile.content}
              language={activeFile.language}
              path={activeFile.path}
              groupId={group.id}
              onChange={(val) => updateActiveFileContent(group.id, val || '')}
            />
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center pointer-events-none select-none">
             <div className="flex flex-col items-center opacity-10">
                <div className="relative w-[150px] h-[150px] mb-6 opacity-30">
                  <Image src="/logo.png" alt="Mirai Logo" fill className="object-cover grayscale" unoptimized />
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
