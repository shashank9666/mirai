'use client';

import React from 'react';
import { useWindowManagerStore } from '@/store/useWindowManagerStore';
import type { LayoutNode } from '@/store/useWindowManagerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useApprovalStore } from '@/store/useApprovalStore';
import { api } from '@/lib/api';
import { ShieldAlert, Check, X } from 'lucide-react';

import ActivityBar from '@/components/layout/ActivityBar';
import StatusBar from '@/components/layout/StatusBar';
import TitleBar from '@/components/layout/TitleBar';
import TilingGrid from '@/components/layout/TilingGrid';
import CommandPalette from '@/components/layout/CommandPalette';

const hasEditorWindow = (node: LayoutNode | null): boolean => {
  if (!node) return false;
  if (node.type === 'leaf') return node.windowType === 'editor';
  return node.children.some(hasEditorWindow);
};

export default function Home() {
  const { rootNode } = useWindowManagerStore();
  const zoom = useSettingsStore((state) => state.zoom) || 1.0;

  // Global approval modal for non-file tool calls (or file edits when no editor is open)
  const pendingApproval = useApprovalStore(state => state.pending);
  const isFileEdit = pendingApproval && ['writeFile', 'replaceInFile'].includes(pendingApproval.call.name);
  const editorExists = hasEditorWindow(rootNode);
  // Show the global modal when: it's a non-file tool, OR it's a file edit but no editor window is mounted
  const showGlobalApproval = pendingApproval && (!isFileEdit || !editorExists);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.setZoom) {
      window.electronAPI.setZoom(zoom);
    } else if (typeof document !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document.body.style as any).zoom = zoom;
    }
  }, [zoom]);

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Save: Ctrl+S / Cmd+S
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const workspaceState = useWorkspaceStore.getState();
        const activeGroupId = workspaceState.activeGroupId;
        const group = workspaceState.editorGroups.find(g => g.id === activeGroupId);
        if (group && group.activeFileIndex >= 0 && group.activeFileIndex < group.openFiles.length) {
          const activeFile = group.openFiles[group.activeFileIndex];
          try {
            await api.writeFile(activeFile.path, activeFile.content);
            workspaceState.updateOpenFileContent(activeFile.path, activeFile.content);
            console.log('Saved file via global shortcut:', activeFile.path);
          } catch (err) {
            console.error('Failed to save file:', err);
          }
        }
      }

      // Zoom In: Ctrl + Plus / Ctrl + Equals
      if (isCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const settingsState = useSettingsStore.getState();
        const currentZoom = settingsState.zoom || 1.0;
        settingsState.setZoom(Math.min(2.0, currentZoom + 0.1));
      }

      // Zoom Out: Ctrl + Minus
      if (isCtrl && e.key === '-') {
        e.preventDefault();
        const settingsState = useSettingsStore.getState();
        const currentZoom = settingsState.zoom || 1.0;
        settingsState.setZoom(Math.max(0.6, currentZoom - 0.1));
      }

      // Reset Zoom: Ctrl + 0
      if (isCtrl && e.key === '0') {
        e.preventDefault();
        useSettingsStore.getState().setZoom(1.0);
      }

      // Toggle Command Palette: Ctrl+P or Ctrl+Shift+P
      if (isCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        const workspaceState = useWorkspaceStore.getState();
        workspaceState.setCommandPaletteOpen(!workspaceState.isCommandPaletteOpen);
      }

      // Prevent Ctrl+R reloading
      if (isCtrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
      }

      // Handle pending approvals
      const approval = useApprovalStore.getState().pending;
      if (approval) {
        if (isCtrl && e.key === 'Enter') {
          e.preventDefault();
          approval.resolve(true);
        }
        if (isCtrl && e.key === 'Backspace') {
          e.preventDefault();
          approval.resolve(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      console.log('GLOBAL CLICK TARGET:', target.tagName, 'ID:', target.id, 'CLASS:', target.className);
    };
    document.addEventListener('click', handleGlobalClick, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  return (
    <>
      <div className="h-full w-full overflow-hidden bg-background text-foreground font-sans selection:bg-blue-500/30 flex flex-col">
        
        {/* Header Layer */}
        <TitleBar />

        {/* Middle IDE Layer */}
        <div className="flex-1 flex overflow-hidden w-full">
          {/* Left Action Launcher */}
          <ActivityBar />
          
          {/* Base Layer: Edge-to-Edge Tiling Grid */}
          <div className="flex-1 w-full h-full relative">
            {rootNode ? (
              <TilingGrid node={rootNode} />
            ) : (
              <div className="flex-1 w-full h-full flex items-center justify-center text-muted-foreground">
                No windows open.
              </div>
            )}
          </div>
        </div>

        {/* Footer Layer */}
        <StatusBar />
        
        {/* Command Palette Modal */}
        <CommandPalette />

        {/* Global Tool Approval Modal (for non-file tools or when no editor is open) */}
        {showGlobalApproval && pendingApproval && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-popover border border-border rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/50">
                <ShieldAlert size={20} className="text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold">Approve Tool Execution</h3>
                  <p className="text-xs text-muted-foreground">The agent wants to run: <strong className="text-foreground">{pendingApproval.call.name}</strong></p>
                </div>
              </div>
              <div className="px-6 py-4 max-h-96 overflow-auto">
                <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono text-muted-foreground border border-border/50">
                  {typeof pendingApproval.call.arguments === 'string'
                    ? pendingApproval.call.arguments
                    : JSON.stringify(pendingApproval.call.arguments, null, 2)}
                </pre>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-border bg-muted/30">
                <button
                  onClick={() => pendingApproval.resolve(false)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors border border-border"
                >
                  <X size={14} />
                  Reject
                </button>
                <button
                  onClick={() => pendingApproval.resolve(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Check size={14} />
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
