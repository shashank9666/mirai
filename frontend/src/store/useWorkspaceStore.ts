import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FileEntry } from '../types/electron';
import { useWindowManagerStore } from './useWindowManagerStore';
import type { LayoutNode } from './useWindowManagerStore';

const normalizePath = (p: string): string => {
  if (!p) return '';
  return p.replace(/[/\\]/g, '/').toLowerCase();
};

const findNode = (node: LayoutNode, id: string): LayoutNode | null => {
  if (node.id === id) return node;
  if (node.type === 'split') {
    for (const child of node.children) {
      const result = findNode(child, id);
      if (result) return result;
    }
  }
  return null;
};

const findFirstEditorId = (node: LayoutNode): string | null => {
  if (node.type === 'leaf' && node.windowType === 'editor') return node.id;
  if (node.type === 'split') {
    for (const child of node.children) {
      const id = findFirstEditorId(child);
      if (id) return id;
    }
  }
  return null;
};

export interface ActiveFile {
  path: string;
  content: string;
  originalContent?: string;
  language: string;
  cursorPosition?: { line: number, column: number };
  pinned?: boolean;
  scrollTargetLine?: number;
}

export interface EditorGroup {
  id: string;
  openFiles: ActiveFile[];
  activeFileIndex: number;
}

interface WorkspaceState {
  workspacePath: string | null;
  fileTree: FileEntry[];
  
  editorGroups: EditorGroup[];
  activeGroupId: string;
  
  setWorkspacePath: (path: string | null) => void;
  setFileTree: (tree: FileEntry[]) => void;
  
  openFile: (file: ActiveFile) => void;
  closeFile: (groupId: string, index: number) => void;
  setActiveFileIndex: (groupId: string, index: number) => void;
  updateActiveFileContent: (groupId: string, content: string) => void;
  updateCursorPosition: (groupId: string, path: string, position: { line: number, column: number }) => void;
  
  setActiveGroup: (groupId: string) => void;
  splitEditor: (direction: 'right' | 'down') => void;
  closeGroup: (groupId: string) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  
  ensureGroup: (groupId: string) => void;
  renameOpenFiles: (oldPath: string, newPath: string) => void;
  closeFileByPath: (path: string) => void;
  updateOpenFileContent: (path: string, content: string) => void;

  reorderFiles: (groupId: string, srcIndex: number, targetIndex: number) => void;
  togglePinFile: (groupId: string, index: number) => void;
  closeOthers: (groupId: string, index: number) => void;
  closeToTheRight: (groupId: string, index: number) => void;
  closeSaved: (groupId: string) => void;
  closeAll: (groupId: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspacePath: null,
      fileTree: [],
      
      editorGroups: [],
      activeGroupId: '',
      isCommandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

      setWorkspacePath: (path) => set({ workspacePath: path }),
      setFileTree: (tree) => set({ fileTree: tree }),
      
      ensureGroup: (groupId) => set((state) => {
        if (state.editorGroups.some(g => g.id === groupId)) return state;
        return {
          editorGroups: [
            ...state.editorGroups,
            { id: groupId, openFiles: [], activeFileIndex: -1 }
          ],
          activeGroupId: state.activeGroupId ? state.activeGroupId : groupId
        };
      }),

      openFile: (file) => set((state) => {
        const getLanguageForFile = (p: string) => {
          const ext = p.split('.').pop()?.toLowerCase();
          switch (ext) {
            case 'ts': case 'tsx': return 'typescript';
            case 'js': case 'jsx': return 'javascript';
            case 'json': return 'json';
            case 'html': return 'html';
            case 'css': return 'css';
            case 'md': return 'markdown';
            case 'py': return 'python';
            case 'go': return 'go';
            case 'rs': return 'rust';
            case 'java': return 'java';
            case 'c': case 'cpp': case 'h': case 'hpp': return 'cpp';
            case 'sh': case 'bash': return 'shell';
            case 'yaml': case 'yml': return 'yaml';
            case 'xml': return 'xml';
            case 'sql': return 'sql';
            default: return 'plaintext';
          }
        };

        const resolvedLanguage = (!file.language || file.language === 'plaintext') ? getLanguageForFile(file.path) : file.language;
        const finalFile = { ...file, language: resolvedLanguage, originalContent: file.originalContent || file.content, pinned: false };

        let groupId = state.activeGroupId;
        
        if (!groupId || !state.editorGroups.some(g => g.id === groupId)) {
          const wmState = useWindowManagerStore.getState();
          const activeNodeId = wmState.activeNodeId;
          
          if (activeNodeId && wmState.rootNode) {
            const node = findNode(wmState.rootNode, activeNodeId);
            if (node && node.type === 'leaf' && node.windowType === 'editor') {
              groupId = activeNodeId;
            }
          }
          
          if (!groupId && wmState.rootNode) {
            groupId = findFirstEditorId(wmState.rootNode) || '';
          }
          
          if (!groupId) {
            groupId = 'default-editor';
          }
        }

        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        const newGroups = [...state.editorGroups];
        
        if (groupIndex === -1) {
          const newGroup: EditorGroup = {
            id: groupId,
            openFiles: [{ ...finalFile, originalContent: finalFile.originalContent || finalFile.content }],
            activeFileIndex: 0
          };
          return {
            editorGroups: [...state.editorGroups, newGroup],
            activeGroupId: groupId
          };
        }

        const group = state.editorGroups[groupIndex];
        const fileNorm = normalizePath(finalFile.path);
        const existingIndex = group.openFiles.findIndex(f => normalizePath(f.path) === fileNorm);
        
        if (existingIndex >= 0) {
          const updatedFiles = [...group.openFiles];
          updatedFiles[existingIndex] = {
            ...updatedFiles[existingIndex],
            content: finalFile.content,
            originalContent: finalFile.originalContent || finalFile.content,
            scrollTargetLine: finalFile.scrollTargetLine,
            language: finalFile.language
          };
          newGroups[groupIndex] = { ...group, openFiles: updatedFiles, activeFileIndex: existingIndex };
        } else {
          newGroups[groupIndex] = { 
            ...group, 
            openFiles: [...group.openFiles, { ...finalFile, originalContent: finalFile.originalContent || finalFile.content, pinned: false }],
            activeFileIndex: group.openFiles.length
          };
        }
        return { editorGroups: newGroups, activeGroupId: groupId };
      }),
      
      closeFile: (groupId, index) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        
        const group = state.editorGroups[groupIndex];
        const newFiles = [...group.openFiles];
        newFiles.splice(index, 1);
        
        let newIndex = group.activeFileIndex;
        if (index === group.activeFileIndex) {
          newIndex = Math.max(0, index - 1);
        } else if (index < group.activeFileIndex) {
          newIndex = group.activeFileIndex - 1;
        }
        
        if (newFiles.length === 0) newIndex = -1;
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = { ...group, openFiles: newFiles, activeFileIndex: newIndex };
        
        return { editorGroups: newGroups };
      }),

      setActiveFileIndex: (groupId, index) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = { ...state.editorGroups[groupIndex], activeFileIndex: index };
        
        return { editorGroups: newGroups, activeGroupId: groupId };
      }),

      updateActiveFileContent: (groupId, content) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        
        const group = state.editorGroups[groupIndex];
        if (group.activeFileIndex >= 0 && group.activeFileIndex < group.openFiles.length) {
          const newFiles = [...group.openFiles];
          newFiles[group.activeFileIndex] = { ...newFiles[group.activeFileIndex], content };
          
          const newGroups = [...state.editorGroups];
          newGroups[groupIndex] = { ...group, openFiles: newFiles };
          return { editorGroups: newGroups };
        }
        return state;
      }),
      
      updateCursorPosition: (groupId, path, position) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        
        const group = state.editorGroups[groupIndex];
        const pathNorm = normalizePath(path);
        const fileIndex = group.openFiles.findIndex(f => normalizePath(f.path) === pathNorm);
        if (fileIndex !== -1) {
          const newFiles = [...group.openFiles];
          newFiles[fileIndex] = { ...newFiles[fileIndex], cursorPosition: position };
          const newGroups = [...state.editorGroups];
          newGroups[groupIndex] = { ...group, openFiles: newFiles };
          return { editorGroups: newGroups };
        }
        return state;
      }),
      
      setActiveGroup: (groupId) => set({ activeGroupId: groupId }),
      
      splitEditor: () => set((state) => {
        const activeGroup = state.editorGroups.find(g => g.id === state.activeGroupId);
        if (!activeGroup) return state;
        
        const activeFile = activeGroup.activeFileIndex >= 0 ? activeGroup.openFiles[activeGroup.activeFileIndex] : null;
        
        const newGroupId = generateId();
        const newGroup: EditorGroup = {
          id: newGroupId,
          openFiles: activeFile ? [activeFile] : [],
          activeFileIndex: activeFile ? 0 : -1,
        };
        
        setTimeout(() => {
          useWindowManagerStore.getState().spawnWindow('editor', 'Code Editor', undefined, newGroupId);
        }, 0);
        
        return {
          editorGroups: [...state.editorGroups, newGroup],
          activeGroupId: newGroupId
        };
      }),
      
      closeGroup: (groupId) => set((state) => {
        if (state.editorGroups.length <= 1) return state; // Don't close the last group
        
        const newGroups = state.editorGroups.filter(g => g.id !== groupId);
        let newActiveId = state.activeGroupId;
        
        if (state.activeGroupId === groupId) {
          newActiveId = newGroups[newGroups.length - 1].id;
        }
        
        setTimeout(() => {
          useWindowManagerStore.getState().closeWindow(groupId);
        }, 0);
        
        return {
          editorGroups: newGroups,
          activeGroupId: newActiveId
        };
      }),

      renameOpenFiles: (oldPath, newPath) => set((state) => {
        const getLanguage = (p: string) => {
          if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript';
          if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
          if (p.endsWith('.json')) return 'json';
          if (p.endsWith('.html')) return 'html';
          if (p.endsWith('.css')) return 'css';
          if (p.endsWith('.md')) return 'markdown';
          return 'plaintext';
        };

        const normOld = normalizePath(oldPath);
        const newGroups = state.editorGroups.map((group) => {
          let hasChange = false;
          const openFiles = group.openFiles.map((file) => {
            const normFile = normalizePath(file.path);
            if (normFile === normOld) {
              hasChange = true;
              return {
                ...file,
                path: newPath,
                language: getLanguage(newPath),
              };
            } else if (normFile.startsWith(normOld + '/')) {
              hasChange = true;
              const relativePart = file.path.substring(oldPath.length);
              const updatedPath = newPath + relativePart;
              return {
                ...file,
                path: updatedPath,
                language: getLanguage(updatedPath),
              };
            }
            return file;
          });
          if (hasChange) {
            return { ...group, openFiles };
          }
          return group;
        });

        return { editorGroups: newGroups };
      }),

      closeFileByPath: (path) => set((state) => {
        const normPath = normalizePath(path);
        const newGroups = state.editorGroups.map((group) => {
          const filesToKeep = group.openFiles.filter(file => {
            const normFile = normalizePath(file.path);
            return normFile !== normPath && !normFile.startsWith(normPath + '/');
          });
          
          if (filesToKeep.length === group.openFiles.length) {
            return group;
          }
          
          let newIndex = group.activeFileIndex;
          const activeFile = group.activeFileIndex >= 0 ? group.openFiles[group.activeFileIndex] : null;
          if (activeFile) {
            const normActive = normalizePath(activeFile.path);
            const isClosed = normActive === normPath || normActive.startsWith(normPath + '/');
            if (isClosed) {
              newIndex = Math.max(0, filesToKeep.length - 1);
            } else {
              newIndex = filesToKeep.findIndex(f => normalizePath(f.path) === normActive);
            }
          }
          if (filesToKeep.length === 0) newIndex = -1;
          
          return {
            ...group,
            openFiles: filesToKeep,
            activeFileIndex: newIndex
          };
        });
        
        return { editorGroups: newGroups };
      }),

      updateOpenFileContent: (path, content) => set((state) => {
        const normPath = normalizePath(path);
        const newGroups = state.editorGroups.map((group) => {
          let hasChange = false;
          const openFiles = group.openFiles.map((file) => {
            if (normalizePath(file.path) === normPath) {
              hasChange = true;
              return { ...file, content, originalContent: content };
            }
            return file;
          });
          if (hasChange) {
            return { ...group, openFiles };
          }
          return group;
        });

        return { editorGroups: newGroups };
      }),

      reorderFiles: (groupId, srcIndex, targetIndex) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        const group = state.editorGroups[groupIndex];
        const newFiles = [...group.openFiles];
        
        const [removed] = newFiles.splice(srcIndex, 1);
        newFiles.splice(targetIndex, 0, removed);
        
        const numPinned = newFiles.filter((f, idx) => idx !== targetIndex && f.pinned).length;
        if (targetIndex < numPinned) {
          removed.pinned = true;
        } else if (targetIndex > numPinned) {
          removed.pinned = false;
        }
        
        const pinnedFiles = newFiles.filter(f => f.pinned);
        const unpinnedFiles = newFiles.filter(f => !f.pinned);
        const sortedFiles = [...pinnedFiles, ...unpinnedFiles];
        
        const activeFile = group.openFiles[group.activeFileIndex];
        let newActiveIndex = group.activeFileIndex;
        if (activeFile) {
          newActiveIndex = sortedFiles.findIndex(f => f.path === activeFile.path);
        }
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = { ...group, openFiles: sortedFiles, activeFileIndex: newActiveIndex };
        return { editorGroups: newGroups };
      }),

      togglePinFile: (groupId, index) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        const group = state.editorGroups[groupIndex];
        const newFiles = [...group.openFiles];
        
        const file = { ...newFiles[index], pinned: !newFiles[index].pinned };
        newFiles.splice(index, 1);
        
        if (file.pinned) {
          const firstUnpinnedIdx = newFiles.findIndex(f => !f.pinned);
          if (firstUnpinnedIdx === -1) {
            newFiles.push(file);
          } else {
            newFiles.splice(firstUnpinnedIdx, 0, file);
          }
        } else {
          const firstUnpinnedIdx = newFiles.findIndex(f => !f.pinned);
          if (firstUnpinnedIdx === -1) {
            newFiles.push(file);
          } else {
            newFiles.splice(firstUnpinnedIdx, 0, file);
          }
        }
        
        const activeFile = group.openFiles[group.activeFileIndex];
        let newActiveIndex = group.activeFileIndex;
        if (activeFile) {
          newActiveIndex = newFiles.findIndex(f => f.path === activeFile.path);
        }
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = { ...group, openFiles: newFiles, activeFileIndex: newActiveIndex };
        return { editorGroups: newGroups };
      }),

      closeOthers: (groupId, index) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        const group = state.editorGroups[groupIndex];
        
        const fileToKeep = group.openFiles[index];
        if (!fileToKeep) return state;
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = {
          ...group,
          openFiles: [fileToKeep],
          activeFileIndex: 0
        };
        return { editorGroups: newGroups };
      }),

      closeToTheRight: (groupId, index) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        const group = state.editorGroups[groupIndex];
        
        const filesToKeep = group.openFiles.slice(0, index + 1);
        
        let newActiveIndex = group.activeFileIndex;
        if (newActiveIndex > index) {
          newActiveIndex = index;
        }
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = {
          ...group,
          openFiles: filesToKeep,
          activeFileIndex: newActiveIndex
        };
        return { editorGroups: newGroups };
      }),

      closeSaved: (groupId) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        const group = state.editorGroups[groupIndex];
        
        const filesToKeep = group.openFiles.filter(f => f.pinned || f.content !== (f.originalContent || ''));
        
        let newIndex = -1;
        if (filesToKeep.length > 0) {
          const activeFile = group.openFiles[group.activeFileIndex];
          if (activeFile) {
            newIndex = filesToKeep.findIndex(f => f.path === activeFile.path);
          }
          if (newIndex === -1) newIndex = 0;
        }
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = {
          ...group,
          openFiles: filesToKeep,
          activeFileIndex: newIndex
        };
        return { editorGroups: newGroups };
      }),

      closeAll: (groupId) => set((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return state;
        
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = {
          ...state.editorGroups[groupIndex],
          openFiles: [],
          activeFileIndex: -1
        };
        return { editorGroups: newGroups };
      })
    }),
    {
      name: 'mirai-workspace',
      partialize: (state) => ({
        workspacePath: state.workspacePath,
        editorGroups: state.editorGroups,
        activeGroupId: state.activeGroupId,
      }),
    }
  )
);
