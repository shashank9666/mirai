import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  workspacePath: string | null;
  workspaceName: string | null;
  recentWorkspaces: string[];

  setWorkspace: (path: string, name: string) => void;
  clearWorkspace: () => void;
  addRecentWorkspace: (path: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspacePath: null,
      workspaceName: null,
      recentWorkspaces: [],

      setWorkspace: (path, name) => {
        const state = get();
        const recent = state.recentWorkspaces.filter(p => p !== path);
        const newRecent = [path, ...recent].slice(0, 10);
        set(() => ({ workspacePath: path, workspaceName: name, recentWorkspaces: newRecent }));
        try {
          localStorage.setItem('miraiRecentWorkspaces', JSON.stringify(newRecent));
          localStorage.setItem('miraiLastWorkspace', path);
        } catch { }
      },

      clearWorkspace: () => set(() => ({
        workspacePath: null,
        workspaceName: null,
      })),

      addRecentWorkspace: (path) => set((state) => {
        const recent = state.recentWorkspaces.filter(p => p !== path);
        return { recentWorkspaces: [path, ...recent].slice(0, 10) };
      }),
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
