import { create } from 'zustand';
import { api } from '@/lib/api';

interface Tab {
  id: string;
  name: string;
  path: string;
  dirty: boolean;
  savedContent: string;
  editedContent: string;
}

interface ClosedTab {
  name: string;
  path: string;
}

interface IdeState {
  activeFile: string | null;
  activeFileContent: string;
  tabs: Tab[];
  closedTabs: ClosedTab[];
  setActiveFile: (path: string, name: string, content: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  reopenClosedTab: () => void;
  updateFileContent: (content: string) => void;
  saveFile: (path?: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  revertFile: (path?: string) => Promise<void>;
  renameTab: (oldPath: string, newPath: string) => void;
}

export const useIdeStore = create<IdeState>((set, get) => ({
  activeFile: null,
  activeFileContent: '',
  tabs: [],
  closedTabs: [],

  setActiveFile: (path, name, content) => set((state) => {
    const existingTab = state.tabs.find((t) => t.path === path);
    if (existingTab) {
      return {
        activeFile: path,
        activeFileContent: existingTab.editedContent || content,
      };
    }
    return {
      activeFile: path,
      activeFileContent: content,
      tabs: [...state.tabs, { id: path, name, path, dirty: false, savedContent: content, editedContent: content }],
    };
  }),

  closeTab: (id) => set((state) => {
    const closedTab = state.tabs.find((t) => t.id === id);
    const newTabs = state.tabs.filter((t) => t.id !== id);
    const newActiveFile = state.activeFile === id
      ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null)
      : state.activeFile;
    const newActiveContent = newActiveFile
      ? (newTabs.find(t => t.path === newActiveFile)?.editedContent || '')
      : '';
    return {
      tabs: newTabs,
      activeFile: newActiveFile,
      activeFileContent: newActiveContent,
      closedTabs: closedTab
        ? [{ name: closedTab.name, path: closedTab.path }, ...state.closedTabs].slice(0, 50)
        : state.closedTabs,
    };
  }),

  closeAllTabs: () => set(() => ({
    tabs: [],
    activeFile: null,
    activeFileContent: '',
  })),

  closeOtherTabs: (id) => set((state) => {
    const kept = state.tabs.find(t => t.id === id);
    return {
      tabs: kept ? [kept] : [],
      activeFile: kept ? kept.path : null,
      activeFileContent: kept ? kept.editedContent : '',
    };
  }),

  reopenClosedTab: () => set((state) => {
    if (state.closedTabs.length === 0) return {};
    const [next, ...rest] = state.closedTabs;
    const exists = state.tabs.find(t => t.path === next.path);
    if (exists) return { closedTabs: rest };
    return {
      closedTabs: rest,
      tabs: [...state.tabs, { id: next.path, name: next.name, path: next.path, dirty: false, savedContent: '', editedContent: '' }],
      activeFile: next.path,
    };
  }),

  updateFileContent: (content) => set((state) => {
    const newTabs = state.tabs.map(t =>
      t.path === state.activeFile
        ? { ...t, dirty: content !== t.savedContent, editedContent: content }
        : t
    );
    return { activeFileContent: content, tabs: newTabs };
  }),

  saveFile: async (path?: string) => {
    const state = get();
    const targetPath = path || state.activeFile;
    if (!targetPath) return;
    const tab = state.tabs.find(t => t.path === targetPath);
    if (!tab) return;
    const content = targetPath === state.activeFile ? state.activeFileContent : tab.editedContent;
    try {
      await api.writeFile(targetPath, content);
      set((s) => ({
        tabs: s.tabs.map(t => t.path === targetPath ? { ...t, dirty: false, savedContent: content, editedContent: content } : t),
      }));
    } catch (err) {
      console.error('Save failed:', err);
    }
  },

  saveAllFiles: async () => {
    const state = get();
    for (const tab of state.tabs) {
      if (tab.dirty) {
        const content = tab.path === state.activeFile ? state.activeFileContent : tab.editedContent;
        try {
          await api.writeFile(tab.path, content);
        } catch (err) {
          console.error(`Save failed for ${tab.path}:`, err);
        }
      }
    }
    set((s) => ({
      tabs: s.tabs.map(t => ({ ...t, dirty: false, savedContent: t.path === s.activeFile ? s.activeFileContent : t.editedContent })),
    }));
  },

  revertFile: async (path?: string) => {
    const state = get();
    const targetPath = path || state.activeFile;
    if (!targetPath) return;
    try {
      const { content } = await api.readFile(targetPath);
      set((s) => ({
        activeFileContent: targetPath === s.activeFile ? content : s.activeFileContent,
        tabs: s.tabs.map(t => t.path === targetPath ? { ...t, dirty: false, savedContent: content, editedContent: content } : t),
      }));
    } catch (err) {
      console.error('Revert failed:', err);
    }
  },

  renameTab: (oldPath, newPath) => set((state) => ({
    tabs: state.tabs.map(t =>
      t.path === oldPath ? { ...t, id: newPath, path: newPath } : t
    ),
    activeFile: state.activeFile === oldPath ? newPath : state.activeFile,
  })),
}));
