import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileEntry } from '@/lib/api';

interface WorkspaceState {
  workspacePath: string | null;
  workspaceName: string | null;
  recentWorkspaces: string[];
  fileTree: FileEntry[];
  workspaceRefreshKey: number;

  setWorkspace: (path: string, name: string) => void;
  setWorkspacePath: (path: string) => void;
  clearWorkspace: () => void;
  addRecentWorkspace: (path: string) => void;
  setFileTree: (tree: FileEntry[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspacePath: null,
      workspaceName: null,
      recentWorkspaces: [],
      fileTree: [],
      workspaceRefreshKey: 0,

      setWorkspace: (path, name) => {
        const state = get();
        const recent = state.recentWorkspaces.filter(p => p !== path);
        const newRecent = [path, ...recent].slice(0, 10);
        set((s) => ({ workspacePath: path, workspaceName: name, recentWorkspaces: newRecent, workspaceRefreshKey: s.workspaceRefreshKey + 1 }));
        try {
          localStorage.setItem('miraiRecentWorkspaces', JSON.stringify(newRecent));
          localStorage.setItem('miraiLastWorkspace', path);
        } catch { }
      },

      setWorkspacePath: (path) => set((s) => ({ workspacePath: path, workspaceRefreshKey: s.workspaceRefreshKey + 1 })),

      clearWorkspace: () => set(() => ({
        workspacePath: null,
        workspaceName: null,
        fileTree: [],
        workspaceRefreshKey: 0
      })),

      addRecentWorkspace: (path) => set((state) => {
        const recent = state.recentWorkspaces.filter(p => p !== path);
        return { recentWorkspaces: [path, ...recent].slice(0, 10) };
      }),

      setFileTree: (tree) => set(() => ({ fileTree: tree })),
    }),
    {
      name: 'mirai-workspace-storage',
      partialize: (state) => ({
        workspacePath: state.workspacePath,
        workspaceName: state.workspaceName,
        recentWorkspaces: state.recentWorkspaces,
      }),
    }
  )
);
