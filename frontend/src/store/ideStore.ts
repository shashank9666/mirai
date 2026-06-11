import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface Tab {
  id: string;
  name: string;
  path: string;
  dirty: boolean;
  savedContent: string;
  editedContent: string;
  language?: string;
  pinned?: boolean;
}

export interface Extension {
  name: string;
  enabled: boolean;
  desc: string;
  builtin: boolean;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isCustom: boolean;
}

interface ClosedTab {
  name: string;
  path: string;
}

export interface EditorGroup {
  id: string;
  activeFile: string | null;
  activeFileContent: string;
  tabs: Tab[];
  closedTabs: ClosedTab[];
}

export interface EditorSettings {
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  wordWrapColumn: number;
  minimap: boolean;
  minimapScale: number;
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  renderWhitespace: 'none' | 'boundary' | 'all';
  showIndentGuides: boolean;
  bracketPairColorization: boolean;
  autoClosingBrackets: boolean;
  autoClosingQuotes: boolean;
  formatOnSave: boolean;
  formatOnPaste: boolean;
  stickyScroll: boolean;
  smoothScrolling: boolean;
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  cursorStyle: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
  cursorWidth: number;
  fontSizeMinimap: number;
  renderLineHighlight: 'none' | 'gutter' | 'all';
  showFoldingControls: 'always' | 'mouseover';
  folding: boolean;
  rulers: number[];
  padding: { top: number; bottom: number };
  scrollBeyondLastLine: boolean;
  links: boolean;
  colorDecorators: boolean;
  contextmenu: boolean;
  mouseWheelZoom: boolean;
  quickSuggestions: boolean;
  suggestOnTriggerCharacters: boolean;
  acceptSuggestionOnEnter: 'on' | 'smart' | 'off';
  tabCompletion: 'on' | 'off' | 'onlySnippets';
  wordBasedSuggestions: 'off' | 'allDocuments' | 'currentDocument';
  overviewRulerBorder: boolean;
  hideCursorInOverviewRuler: boolean;
  automaticLayout: boolean;
  theme: string;
  backgroundImage: string;
  backgroundOpacity: number;
  accentColor?: string;
}

const defaultEditorSettings: EditorSettings = {
  wordWrap: 'off',
  wordWrapColumn: 80,
  minimap: true,
  minimapScale: 1,
  fontSize: 13,
  lineHeight: 20,
  tabSize: 2,
  renderWhitespace: 'none',
  showIndentGuides: true,
  bracketPairColorization: true,
  autoClosingBrackets: true,
  autoClosingQuotes: true,
  formatOnSave: false,
  formatOnPaste: true,
  stickyScroll: true,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorStyle: 'line',
  cursorWidth: 2,
  fontSizeMinimap: 12,
  renderLineHighlight: 'gutter',
  showFoldingControls: 'mouseover',
  folding: true,
  rulers: [],
  padding: { top: 16, bottom: 16 },
  scrollBeyondLastLine: false,
  links: true,
  colorDecorators: true,
  contextmenu: true,
  mouseWheelZoom: true,
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'smart',
  tabCompletion: 'on',
  wordBasedSuggestions: 'currentDocument',
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: false,
  automaticLayout: true,
  theme: 'vs-dark',
  backgroundImage: '',
  backgroundOpacity: 0.1,
  accentColor: '#3b82f6',
};

const DEFAULT_EXTENSIONS: Extension[] = [
  { name: 'Tailwind CSS IntelliSense', enabled: true, desc: 'Autocomplete & linting for Tailwind', builtin: true },
  { name: 'ESLint', enabled: true, desc: 'JavaScript/TypeScript linting', builtin: true },
  { name: 'Prettier', enabled: true, desc: 'Code formatting', builtin: true },
  { name: 'Error Lens', enabled: true, desc: 'Inline error display', builtin: true },
  { name: 'GitLens', enabled: false, desc: 'Git history & blame', builtin: false },
  { name: 'GitHub Copilot', enabled: false, desc: 'AI-powered code suggestions', builtin: false },
  { name: 'Docker', enabled: false, desc: 'Docker container management', builtin: false },
  { name: 'Python', enabled: false, desc: 'Python language support', builtin: false },
];

const DEFAULT_AI_PROVIDERS: AIProviderConfig[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: '', apiKey: '', model: 'gpt-4o', isCustom: false },
  { id: 'anthropic', name: 'Anthropic', baseUrl: '', apiKey: '', model: 'claude-3-opus-20240229', isCustom: false },
  { id: 'gemini', name: 'Google Gemini', baseUrl: '', apiKey: '', model: 'gemini-1.5-pro', isCustom: false },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: '', apiKey: '', model: 'deepseek-chat', isCustom: false },
  { id: 'xai', name: 'xAI', baseUrl: '', apiKey: '', model: 'grok-beta', isCustom: false },
  { id: 'groq', name: 'Groq', baseUrl: '', apiKey: '', model: 'llama3-70b-8192', isCustom: false },
  { id: 'mistral', name: 'Mistral', baseUrl: '', apiKey: '', model: 'mistral-large-latest', isCustom: false },
  { id: 'cohere', name: 'Cohere', baseUrl: '', apiKey: '', model: 'command-r-plus', isCustom: false },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', model: '', isCustom: true },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', apiKey: '', model: '', isCustom: true },
  { id: 'fireworks', name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1', apiKey: '', model: '', isCustom: true },
  { id: 'huggingface', name: 'Hugging Face', baseUrl: '', apiKey: '', model: '', isCustom: false },
  { id: 'ollama', name: 'Ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', model: 'llama3', isCustom: true },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', apiKey: '', model: '', isCustom: true },
  { id: 'custom', name: 'Custom OpenAI Compatible', baseUrl: '', apiKey: '', model: '', isCustom: true }
];

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
    md: 'markdown', txt: 'plaintext', sql: 'sql', sh: 'shell', bash: 'shell',
    vue: 'html', svelte: 'html', graphql: 'graphql',
  };
  return langMap[ext] || 'plaintext';
}

interface IdeState {
  workspacePath: string | null;
  workspaceName: string | null;
  recentWorkspaces: string[];
  activeGroupId: string;
  groups: EditorGroup[];
  editorSettings: EditorSettings;
  zenMode: boolean;
  fullscreenMode: boolean;
  splitDirection: 'horizontal' | 'vertical';
  diffMode: boolean;
  diffOriginal: string;
  diffModified: string;
  diffFilePath: string;
  extensions: Extension[];
  
  aiProviders: AIProviderConfig[];
  activeAiProviderId: string | null;

  setExtensions: (exts: Extension[] | ((prev: Extension[]) => Extension[])) => void;
  setAiProviderConfig: (id: string, config: Partial<AIProviderConfig>) => void;
  setActiveAiProvider: (id: string) => void;

  getActiveGroup: () => EditorGroup | undefined;
  getGroupById: (id: string) => EditorGroup | undefined;

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
  reorderTabs: (groupId: string, draggedPath: string, targetPath: string) => void;
  toggleTabPin: (groupId: string, tabPath: string) => void;

  addGroup: (direction: 'horizontal' | 'vertical') => string;
  removeGroup: (groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  moveTabToGroup: (tabPath: string, fromGroupId: string, toGroupId: string) => void;

  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  toggleZenMode: () => void;
  toggleFullscreenMode: () => void;
  toggleWordWrap: () => void;
  toggleMinimap: () => void;
  toggleStickyScroll: () => void;
  toggleFormatOnSave: () => void;
  toggleBracketPairColorization: () => void;
  toggleFolding: () => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  toggleMouseWheelZoom: () => void;
  setSplitDirection: (dir: 'horizontal' | 'vertical') => void;

  openDiff: (filePath: string, original: string, modified: string) => void;
  closeDiff: () => void;

  setWorkspace: (path: string, name: string) => void;
  clearWorkspace: () => void;
  addRecentWorkspace: (path: string) => void;
}

let groupCounter = 1;

export const useIdeStore = create<IdeState>()(
  persist(
    (set, get) => ({
  workspacePath: null,
  workspaceName: null,
  recentWorkspaces: [],
  extensions: DEFAULT_EXTENSIONS,
  aiProviders: DEFAULT_AI_PROVIDERS,
  activeAiProviderId: 'openai',
  activeGroupId: 'group-1',
  groups: [
    {
      id: 'group-1',
      activeFile: null,
      activeFileContent: '',
      tabs: [],
      closedTabs: [],
    },
  ],
  editorSettings: { ...defaultEditorSettings },
  zenMode: false,
  fullscreenMode: false,
  splitDirection: 'horizontal',
  diffMode: false,
  diffOriginal: '',
  diffModified: '',
  diffFilePath: '',

  getActiveGroup: () => {
    const state = get();
    return state.groups.find((g) => g.id === state.activeGroupId);
  },

  getGroupById: (id: string) => {
    return get().groups.find((g) => g.id === id);
  },

  setActiveFile: (path, name, content) => set((state) => {
    const lang = getLanguageFromPath(path);
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return {};

    const group = state.groups[groupIndex];
    const existingTab = group.tabs.find((t) => t.path === path);
    const newTabs = existingTab
      ? group.tabs
      : [...group.tabs, { id: path, name, path, dirty: false, savedContent: content, editedContent: content, language: lang }];
    const newContent = existingTab ? (existingTab.editedContent || content) : content;

    const newGroups = [...state.groups];
    newGroups[groupIndex] = { ...group, tabs: newTabs, activeFile: path, activeFileContent: newContent };

    return { groups: newGroups };
  }),

  closeTab: (id) => set((state) => {
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return {};

    const group = state.groups[groupIndex];
    const closedTab = group.tabs.find((t) => t.id === id);
    const newTabs = group.tabs.filter((t) => t.id !== id);
    const newActiveFile = group.activeFile === id
      ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null)
      : group.activeFile;
    const newActiveContent = newActiveFile
      ? (newTabs.find(t => t.path === newActiveFile)?.editedContent || '')
      : '';
    const newClosedTabs = closedTab
      ? [{ name: closedTab.name, path: closedTab.path }, ...group.closedTabs].slice(0, 50)
      : group.closedTabs;

    const newGroups = [...state.groups];
    newGroups[groupIndex] = { ...group, tabs: newTabs, activeFile: newActiveFile, activeFileContent: newActiveContent, closedTabs: newClosedTabs };

    return { groups: newGroups };
  }),

  closeAllTabs: () => set((state) => {
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return {};
    const newGroups = [...state.groups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], tabs: [], activeFile: null, activeFileContent: '' };
    return { groups: newGroups };
  }),

  closeOtherTabs: (id) => set((state) => {
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return {};
    const group = state.groups[groupIndex];
    const kept = group.tabs.find(t => t.id === id);
    const newGroups = [...state.groups];
    newGroups[groupIndex] = {
      ...group,
      tabs: kept ? [kept] : [],
      activeFile: kept ? kept.path : null,
      activeFileContent: kept ? kept.editedContent : '',
    };
    return { groups: newGroups };
  }),

  reopenClosedTab: () => set((state) => {
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return {};
    const group = state.groups[groupIndex];
    if (group.closedTabs.length === 0) return {};
    const [next, ...rest] = group.closedTabs;
    const exists = group.tabs.find(t => t.path === next.path);
    if (exists) {
      const newGroups = [...state.groups];
      newGroups[groupIndex] = { ...group, closedTabs: rest };
      return { groups: newGroups };
    }
    const lang = getLanguageFromPath(next.path);
    const newGroups = [...state.groups];
    newGroups[groupIndex] = {
      ...group,
      closedTabs: rest,
      tabs: [...group.tabs, { id: next.path, name: next.name, path: next.path, dirty: false, savedContent: '', editedContent: '', language: lang }],
      activeFile: next.path,
    };
    return { groups: newGroups };
  }),

  updateFileContent: (content) => set((state) => {
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return {};
    const group = state.groups[groupIndex];
    const newTabs = group.tabs.map(t =>
      t.path === group.activeFile
        ? { ...t, dirty: content !== t.savedContent, editedContent: content }
        : t
    );
    const newGroups = [...state.groups];
    newGroups[groupIndex] = { ...group, activeFileContent: content, tabs: newTabs };
    return { groups: newGroups };
  }),

  saveFile: async (path?: string) => {
    const state = get();
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return;
    const group = state.groups[groupIndex];
    const targetPath = path || group.activeFile;
    if (!targetPath) return;
    const tab = group.tabs.find(t => t.path === targetPath);
    if (!tab) return;
    const content = targetPath === group.activeFile ? group.activeFileContent : tab.editedContent;
    try {
      await api.writeFile(targetPath, content);
      set((s) => {
        const gi = s.groups.findIndex((g) => g.id === s.activeGroupId);
        if (gi === -1) return {};
        const newGroups = [...s.groups];
        newGroups[gi] = {
          ...newGroups[gi],
          tabs: newGroups[gi].tabs.map(t => t.path === targetPath ? { ...t, dirty: false, savedContent: content, editedContent: content } : t),
        };
        return { groups: newGroups };
      });
    } catch (err) {
      console.error('Save failed:', err);
    }
  },

  saveAllFiles: async () => {
    const state = get();
    const group = state.groups.find(g => g.id === state.activeGroupId);
    if (!group) return;
    for (const tab of group.tabs) {
      if (tab.dirty) {
        const content = tab.path === group.activeFile ? group.activeFileContent : tab.editedContent;
        try {
          await api.writeFile(tab.path, content);
        } catch (err) {
          console.error(`Save failed for ${tab.path}:`, err);
        }
      }
    }
    set((s) => {
      const gi = s.groups.findIndex((g) => g.id === s.activeGroupId);
      if (gi === -1) return {};
      const newGroups = [...s.groups];
      newGroups[gi] = {
        ...newGroups[gi],
        tabs: newGroups[gi].tabs.map(t => ({ ...t, dirty: false, savedContent: t.path === newGroups[gi].activeFile ? newGroups[gi].activeFileContent : t.editedContent })),
      };
      return { groups: newGroups };
    });
  },

  revertFile: async (path?: string) => {
    const state = get();
    const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
    if (groupIndex === -1) return;
    const group = state.groups[groupIndex];
    const targetPath = path || group.activeFile;
    if (!targetPath) return;
    try {
      const { content } = await api.readFile(targetPath);
      set((s) => {
        const gi = s.groups.findIndex((g) => g.id === s.activeGroupId);
        if (gi === -1) return {};
        const newGroups = [...s.groups];
        newGroups[gi] = {
          ...newGroups[gi],
          activeFileContent: targetPath === newGroups[gi].activeFile ? content : newGroups[gi].activeFileContent,
          tabs: newGroups[gi].tabs.map(t => t.path === targetPath ? { ...t, dirty: false, savedContent: content, editedContent: content } : t),
        };
        return { groups: newGroups };
      });
    } catch (err) {
      console.error('Revert failed:', err);
    }
  },

  renameTab: (oldPath, newPath) => set((state) => {
    const newGroups = state.groups.map(g => ({
      ...g,
      tabs: g.tabs.map(t => t.path === oldPath ? { ...t, id: newPath, path: newPath, language: getLanguageFromPath(newPath) } : t),
      activeFile: g.activeFile === oldPath ? newPath : g.activeFile,
    }));
    return { groups: newGroups };
  }),

  reorderTabs: (groupId, draggedPath, targetPath) => set((state) => {
    if (draggedPath === targetPath) return {};
    const groupIndex = state.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return {};
    const group = state.groups[groupIndex];
    const newTabs = [...group.tabs];
    const draggedIdx = newTabs.findIndex(t => t.path === draggedPath);
    const targetIdx = newTabs.findIndex(t => t.path === targetPath);
    if (draggedIdx === -1 || targetIdx === -1) return {};
    
    const [draggedTab] = newTabs.splice(draggedIdx, 1);
    newTabs.splice(targetIdx, 0, draggedTab);
    
    // Sort so pinned are always first
    newTabs.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

    const newGroups = [...state.groups];
    newGroups[groupIndex] = { ...group, tabs: newTabs };
    return { groups: newGroups };
  }),

  toggleTabPin: (groupId, tabPath) => set((state) => {
    const groupIndex = state.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return {};
    const group = state.groups[groupIndex];
    const newTabs = group.tabs.map(t => t.path === tabPath ? { ...t, pinned: !t.pinned } : t);
    
    newTabs.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
    
    const newGroups = [...state.groups];
    newGroups[groupIndex] = { ...group, tabs: newTabs };
    return { groups: newGroups };
  }),

  addGroup: (direction) => {
    const newId = `group-${++groupCounter}`;
    set((state) => {
      const newGroup: EditorGroup = {
        id: newId,
        activeFile: null,
        activeFileContent: '',
        tabs: [],
        closedTabs: [],
      };
      return {
        groups: [...state.groups, newGroup],
        activeGroupId: newId,
        splitDirection: direction,
      };
    });
    return newId;
  },

  removeGroup: (groupId) => set((state) => {
    if (state.groups.length <= 1) return {};
    const newGroups = state.groups.filter(g => g.id !== groupId);
    const newActiveId = state.activeGroupId === groupId
      ? newGroups[newGroups.length - 1].id
      : state.activeGroupId;
    return { groups: newGroups, activeGroupId: newActiveId };
  }),

  setActiveGroup: (groupId) => set(() => ({ activeGroupId: groupId })),

  moveTabToGroup: (tabPath, fromGroupId, toGroupId) => set((state) => {
    const fromIndex = state.groups.findIndex(g => g.id === fromGroupId);
    const toIndex = state.groups.findIndex(g => g.id === toGroupId);
    if (fromIndex === -1 || toIndex === -1) return {};

    const fromGroup = state.groups[fromIndex];
    const tab = fromGroup.tabs.find(t => t.path === tabPath);
    if (!tab) return {};

    const newGroups = [...state.groups];
    newGroups[fromIndex] = {
      ...fromGroup,
      tabs: fromGroup.tabs.filter(t => t.path !== tabPath),
      activeFile: fromGroup.activeFile === tabPath
        ? (fromGroup.tabs.filter(t => t.path !== tabPath).length > 0
          ? fromGroup.tabs.filter(t => t.path !== tabPath)[fromGroup.tabs.filter(t => t.path !== tabPath).length - 1].path
          : null)
        : fromGroup.activeFile,
    };

    const toGroup = newGroups[toIndex];
    const existsInTarget = toGroup.tabs.find(t => t.path === tabPath);
    if (!existsInTarget) {
      newGroups[toIndex] = {
        ...toGroup,
        tabs: [...toGroup.tabs, tab],
      };
    }

    return { groups: newGroups };
  }),

  setEditorSettings: (settings) => set((state) => ({
    editorSettings: { ...state.editorSettings, ...settings },
  })),

  toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
  toggleFullscreenMode: () => set((state) => ({ fullscreenMode: !state.fullscreenMode })),

  toggleWordWrap: () => set((state) => ({
    editorSettings: {
      ...state.editorSettings,
      wordWrap: state.editorSettings.wordWrap === 'off' ? 'on' : 'off',
    },
  })),

  toggleMinimap: () => set((state) => ({
    editorSettings: { ...state.editorSettings, minimap: !state.editorSettings.minimap },
  })),

  toggleStickyScroll: () => set((state) => ({
    editorSettings: { ...state.editorSettings, stickyScroll: !state.editorSettings.stickyScroll },
  })),

  toggleFormatOnSave: () => set((state) => ({
    editorSettings: { ...state.editorSettings, formatOnSave: !state.editorSettings.formatOnSave },
  })),

  toggleBracketPairColorization: () => set((state) => ({
    editorSettings: { ...state.editorSettings, bracketPairColorization: !state.editorSettings.bracketPairColorization },
  })),

  toggleFolding: () => set((state) => ({
    editorSettings: { ...state.editorSettings, folding: !state.editorSettings.folding },
  })),

  increaseFontSize: () => set((state) => ({
    editorSettings: { ...state.editorSettings, fontSize: Math.min(state.editorSettings.fontSize + 1, 40) },
  })),

  decreaseFontSize: () => set((state) => ({
    editorSettings: { ...state.editorSettings, fontSize: Math.max(state.editorSettings.fontSize - 1, 8) },
  })),

  resetFontSize: () => set((state) => ({
    editorSettings: { ...state.editorSettings, fontSize: 13 },
  })),

  toggleMouseWheelZoom: () => set((state) => ({
    editorSettings: { ...state.editorSettings, mouseWheelZoom: !state.editorSettings.mouseWheelZoom },
  })),

  setSplitDirection: (dir) => set(() => ({ splitDirection: dir })),

  openDiff: (filePath, original, modified) => set(() => ({
    diffMode: true,
    diffFilePath: filePath,
    diffOriginal: original,
    diffModified: modified,
  })),

  closeDiff: () => set(() => ({
    diffMode: false,
    diffFilePath: '',
    diffOriginal: '',
    diffModified: '',
  })),

  setWorkspace: (path, name) => {
    const state = get();
    const recent = state.recentWorkspaces.filter(p => p !== path);
    const newRecent = [path, ...recent].slice(0, 10);
    set(() => ({ workspacePath: path, workspaceName: name, recentWorkspaces: newRecent }));
    try {
      localStorage.setItem('miraiRecentWorkspaces', JSON.stringify(newRecent));
      localStorage.setItem('miraiLastWorkspace', path);
    } catch {}
  },

  clearWorkspace: () => set(() => ({
    workspacePath: null,
    workspaceName: null,
    groups: [{
      id: 'group-1',
      activeFile: null,
      activeFileContent: '',
      tabs: [],
      closedTabs: [],
    }],
    activeGroupId: 'group-1',
  })),

  addRecentWorkspace: (path) => set((state) => {
    const recent = state.recentWorkspaces.filter(p => p !== path);
    return { recentWorkspaces: [path, ...recent].slice(0, 10) };
  }),

  setExtensions: (exts) => set((state) => ({
    extensions: typeof exts === 'function' ? exts(state.extensions) : exts,
  })),

  setAiProviderConfig: (id, config) => set((state) => ({
    aiProviders: state.aiProviders.map(p => p.id === id ? { ...p, ...config } : p)
  })),

  setActiveAiProvider: (id) => set(() => ({ activeAiProviderId: id })),
    }),
    {
      name: 'mirai-ide-storage',
      partialize: (state) => ({
        workspacePath: state.workspacePath,
        workspaceName: state.workspaceName,
        recentWorkspaces: state.recentWorkspaces,
        editorSettings: state.editorSettings,
        extensions: state.extensions,
        aiProviders: state.aiProviders,
        activeAiProviderId: state.activeAiProviderId,
      }),
    }
  )
);
