import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeType = 'light' | 'dark' | 'hc-light' | 'hc-dark';

export interface SemanticColors {
  // Base UI
  'focusBorder': string;
  'foreground': string;
  'widget.shadow': string;
  
  // Backgrounds
  'editor.background': string;
  'editor.foreground': string;
  'sideBar.background': string;
  'sideBar.foreground': string;
  'activityBar.background': string;
  'activityBar.foreground': string;
  'titleBar.activeBackground': string;
  'titleBar.activeForeground': string;
  'statusBar.background': string;
  'statusBar.foreground': string;
  
  // Panels & Tabs
  'panel.background': string;
  'tab.activeBackground': string;
  'tab.inactiveBackground': string;
  'tab.activeForeground': string;
  
  // Terminal
  'terminal.background': string;
  'terminal.foreground': string;
  'terminal.ansiBlack': string;
  'terminal.ansiRed': string;
  'terminal.ansiGreen': string;
  'terminal.ansiYellow': string;
  'terminal.ansiBlue': string;
  'terminal.ansiMagenta': string;
  'terminal.ansiCyan': string;
  'terminal.ansiWhite': string;
  'terminal.ansiBrightBlack': string;
  'terminal.ansiBrightRed': string;
  'terminal.ansiBrightGreen': string;
  'terminal.ansiBrightYellow': string;
  'terminal.ansiBrightBlue': string;
  'terminal.ansiBrightMagenta': string;
  'terminal.ansiBrightCyan': string;
  'terminal.ansiBrightWhite': string;

  // Glassmorphism (Mirai Specific)
  'glass.opacity': string;
  'glass.blur': string;
  'glass.borderOpacity': string;
}

export interface IDETheme {
  id: string;
  name: string;
  author: string;
  version: string;
  type: ThemeType;
  colors: Partial<SemanticColors>;
}

interface ThemeState {
  activeThemeId: string;
  availableThemes: IDETheme[];
  userThemeOverrides: Partial<SemanticColors>;
  layoutSettings: {
    compactMode: boolean;
    panelRadius: number;
    borderThickness: number;
  };
  glassmorphism: {
    enabled: boolean;
    noiseTexture: boolean;
    opacity: number;
    blur: number;
  };
  
  // Actions
  setActiveTheme: (id: string) => void;
  updateThemeOverride: (key: keyof SemanticColors, value: string) => void;
  importTheme: (json: string) => void;
  exportTheme: () => string;
  resetToDefaults: () => void;
  registerThemes: (themes: IDETheme[]) => void;
  _applyThemeVariables: () => void;
}

const DEFAULT_THEME_ID = 'catppuccin-mocha';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activeThemeId: DEFAULT_THEME_ID,
      availableThemes: [], // Populated on boot
      userThemeOverrides: {},
      layoutSettings: {
        compactMode: false,
        panelRadius: 12,
        borderThickness: 1,
      },
      glassmorphism: {
        enabled: true,
        noiseTexture: false,
        opacity: 0.85,
        blur: 24,
      },

      setActiveTheme: (id) => {
        set({ activeThemeId: id });
        get()._applyThemeVariables();
      },

      updateThemeOverride: (key, value) => {
        set((state) => ({
          userThemeOverrides: {
            ...state.userThemeOverrides,
            [key]: value,
          },
        }));
        get()._applyThemeVariables();
      },

      importTheme: (jsonString) => {
        try {
          const parsed = JSON.parse(jsonString) as IDETheme;
          // Validate basic structure
          if (!parsed.id || !parsed.name || !parsed.colors) {
            throw new Error('Invalid theme format');
          }
          set((state) => ({
            availableThemes: [...state.availableThemes.filter(t => t.id !== parsed.id), parsed],
            activeThemeId: parsed.id,
          }));
          get()._applyThemeVariables();
        } catch (e) {
          console.error("Failed to import theme", e);
        }
      },

      exportTheme: () => {
        const state = get();
        const activeTheme = state.availableThemes.find(t => t.id === state.activeThemeId);
        if (!activeTheme) return '{}';
        
        // Merge with user overrides to export their custom version
        const exportedTheme: IDETheme = {
          ...activeTheme,
          id: `${activeTheme.id}-custom`,
          name: `${activeTheme.name} (Custom)`,
          colors: {
            ...activeTheme.colors,
            ...state.userThemeOverrides,
          }
        };
        
        return JSON.stringify(exportedTheme, null, 2);
      },

      resetToDefaults: () => {
        set({
          userThemeOverrides: {},
          layoutSettings: {
            compactMode: false,
            panelRadius: 12,
            borderThickness: 1,
          },
          glassmorphism: {
            enabled: true,
            noiseTexture: false,
            opacity: 0.85,
            blur: 24,
          }
        });
        get()._applyThemeVariables();
      },
      
      registerThemes: (themes: IDETheme[]) => {
        set({ availableThemes: themes });
        // If the active theme is not in the list, fallback
        if (!themes.find(t => t.id === get().activeThemeId)) {
          set({ activeThemeId: themes[0]?.id || DEFAULT_THEME_ID });
        }
        get()._applyThemeVariables();
      },

      // Internal method to apply CSS variables to the document
      _applyThemeVariables: () => {
        if (typeof document === 'undefined') return;
        
        const state = get();
        const activeTheme = state.availableThemes.find(t => t.id === state.activeThemeId);
        if (!activeTheme) return;

        const mergedColors = {
          ...activeTheme.colors,
          ...state.userThemeOverrides,
        };

        const root = document.documentElement;

        // Apply HTML classes for light/dark specific tailwind utilities
        root.classList.remove('light', 'dark', 'hc-light', 'hc-dark');
        root.classList.add(activeTheme.type);

        // Apply semantic colors as CSS variables
        Object.entries(mergedColors).forEach(([key, value]) => {
          if (value) {
            // Convert 'editor.background' -> '--editor-background'
            const cssVar = `--${key.replace(/\./g, '-')}`;
            root.style.setProperty(cssVar, value as string);
          }
        });

        // Apply layout & glassmorphism variables
        root.style.setProperty('--panel-radius', `${state.layoutSettings.panelRadius}px`);
        root.style.setProperty('--border-thickness', `${state.layoutSettings.borderThickness}px`);
        root.style.setProperty('--glass-opacity', `${state.glassmorphism.opacity}`);
        root.style.setProperty('--glass-blur', `${state.glassmorphism.blur}px`);
        
        // Dispatch event for Monaco/Xterm to pick up if they are mounted
        window.dispatchEvent(new Event('mirai:themeChanged'));
      }
    }),
    {
      name: 'mirai-theme-storage',
      // We don't want to persist availableThemes since they are injected on boot
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        userThemeOverrides: state.userThemeOverrides,
        layoutSettings: state.layoutSettings,
        glassmorphism: state.glassmorphism,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Defer applying variables until the dom is ready and themes are registered
          setTimeout(() => {
            state._applyThemeVariables();
          }, 50);
        }
      }
    }
  )
);
