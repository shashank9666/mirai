import { create } from 'zustand';

interface Tab {
  id: string;
  name: string;
  path: string;
}

interface IdeState {
  activeFile: string | null;
  activeFileContent: string;
  tabs: Tab[];
  setActiveFile: (path: string, name: string, content: string) => void;
  closeTab: (id: string) => void;
  updateFileContent: (content: string) => void;
}

export const useIdeStore = create<IdeState>((set) => ({
  activeFile: null,
  activeFileContent: '// Welcome to Mirai IDE\n\nfunction main() {\n  console.log("Ready to code.");\n}',
  tabs: [],
  
  setActiveFile: (path, name, content) => set((state) => {
    const existingTab = state.tabs.find((t) => t.path === path);
    const newTabs = existingTab ? state.tabs : [...state.tabs, { id: path, name, path }];
    return {
      activeFile: path,
      activeFileContent: content,
      tabs: newTabs
    };
  }),

  closeTab: (id) => set((state) => {
    const newTabs = state.tabs.filter((t) => t.id !== id);
    const newActiveFile = state.activeFile === id 
      ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null) 
      : state.activeFile;
      
    // Ideally we would fetch the content for the newly active file here,
    // but we'll let the component handle it for now or just set a placeholder.
    return {
      tabs: newTabs,
      activeFile: newActiveFile,
      activeFileContent: newActiveFile ? state.activeFileContent : '', // Simplify
    };
  }),

  updateFileContent: (content) => set({ activeFileContent: content }),
}));
