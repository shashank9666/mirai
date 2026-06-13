import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EditorSettings, Extension } from './ideStore';

export interface SettingsState {
  editorSettings: EditorSettings;
  zoom: number;
  extensions: Extension[];
  zenMode: boolean;
  fullscreenMode: boolean;
  notificationsEnabled: boolean;

  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  setZoom: (z: number) => void;
  setExtensions: (exts: Extension[] | ((prev: Extension[]) => Extension[])) => void;
  toggleZenMode: () => void;
  toggleFullscreenMode: () => void;
  toggleNotifications: () => void;
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
  backgroundImage: null,
  backgroundOpacity: 0.8,
  accentColor: '#3b82f6',
  explorerIndentGuides: true,
  panelOpacity: 0.6,
  panelBlur: 16,
  appTheme: 'glass',
};

const DEFAULT_EXTENSIONS: Extension[] = [
  { name: 'Tailwind CSS IntelliSense', enabled: true, desc: 'Autocomplete & linting for Tailwind', builtin: true },
  { name: 'ESLint', enabled: true, desc: 'JavaScript/TypeScript linting', builtin: true },
  { name: 'Prettier', enabled: true, desc: 'Code formatting', builtin: true },
  { name: 'Error Lens', enabled: true, desc: 'Inline error display', builtin: true },
  { name: 'GitLens', enabled: true, desc: 'Git history & blame', builtin: false },
  { name: 'GitHub Copilot', enabled: true, desc: 'AI-powered code suggestions', builtin: false },
  { name: 'Docker', enabled: true, desc: 'Docker container management', builtin: false },
  { name: 'Python', enabled: true, desc: 'Python language support', builtin: false },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      editorSettings: { ...defaultEditorSettings },
      zoom: 1,
      extensions: DEFAULT_EXTENSIONS,
      zenMode: false,
      fullscreenMode: false,
      notificationsEnabled: true,

      setEditorSettings: (settings) => set((state) => ({
        editorSettings: { ...state.editorSettings, ...settings },
      })),

      setZoom: (z) => set(() => ({ zoom: z })),

      setExtensions: (exts) => set((state) => ({
        extensions: typeof exts === 'function' ? exts(state.extensions) : exts,
      })),

      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
      toggleFullscreenMode: () => set((state) => ({ fullscreenMode: !state.fullscreenMode })),
      toggleNotifications: () => set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

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
        zoom: 1,
      })),

      toggleMouseWheelZoom: () => set((state) => ({
        editorSettings: { ...state.editorSettings, mouseWheelZoom: !state.editorSettings.mouseWheelZoom },
      })),
    }),
    {
      name: 'mirai-settings-storage',
      partialize: (state) => ({
        editorSettings: state.editorSettings,
        zoom: state.zoom,
        extensions: state.extensions,
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);
