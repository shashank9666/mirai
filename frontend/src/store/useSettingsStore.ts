import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { api } from '@/lib/api';

const customStorage: StateStorage = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getItem: async (_name: string): Promise<string | null> => {
    // Skip fetching from backend during Next.js SSR
    if (typeof window === 'undefined') return null;
    try {
      const settingsStr = await api.loadSettings();
      // Returns null if backend doesn't have it yet, which tells Zustand to use defaults
      return settingsStr;
    } catch {
      // Silently ignore if backend is still starting up
      return null;
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      await api.saveSettings(value);
    } catch (e) {
      console.error('Failed to save settings to backend', e);
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeItem: async (_name: string): Promise<void> => {},
};

export type AIProvider =
  | 'openai' | 'anthropic' | 'google' | 'mistral' | 'openrouter'
  | 'groq' | 'together' | 'fireworks' | 'deepinfra' | 'novita'
  | 'cerebras' | 'perplexity' | 'ollama'
  | 'opencode' | 'deepseek';

export type ThemeMode = 'dark' | 'light';

export type TeamPersona = 'Coordinator' | 'Frontend Expert' | 'Backend Expert' | 'DevOps';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  code: string;
}

export interface NotificationPrefs {
  toolExecution: boolean;
  completion: boolean;
  fsChange: boolean;
}

interface SettingsState {
  currentView: 'chat' | 'settings';
  aiProvider: AIProvider;

  providerConfigs: Record<AIProvider, ProviderConfig>;

  // Theme settings
  themeMode: ThemeMode;
  accentColor: string;
  backgroundImage: string;
  zoom?: number;

  // Editor Settings
  formatOnSave: boolean;
  codeAutocomplete: boolean;
  editorMinimapEnabled: boolean;
  editorWordWrap: boolean;

  // Actions
  setCurrentView: (view: 'chat' | 'settings') => void;
  setAiProvider: (provider: AIProvider) => void;
  updateProviderConfig: (provider: AIProvider, config: Partial<ProviderConfig>) => void;

  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  setBackgroundImage: (url: string) => void;

  setFormatOnSave: (format: boolean) => void;
  setCodeAutocomplete: (enabled: boolean) => void;
  setEditorMinimapEnabled: (enabled: boolean) => void;
  setEditorWordWrap: (enabled: boolean) => void;
  setZoom: (zoom: number) => void;

  // Agent Settings
  autoApprove: boolean;
  checkpointsEnabled: boolean;
  currentPersona: TeamPersona;
  agentMode: 'plan' | 'auto' | 'review';
  webSearchEnabled: boolean;
  setAutoApprove: (approve: boolean) => void;
  setCheckpointsEnabled: (enabled: boolean) => void;
  setCurrentPersona: (persona: TeamPersona) => void;
  setAgentMode: (mode: 'plan' | 'auto' | 'review') => void;
  setWebSearchEnabled: (enabled: boolean) => void;

  // MCP & Skills Settings
  skills: Skill[];
  notificationPrefs: NotificationPrefs;
  addSkill: (skill: Omit<Skill, 'id'>) => void;
  editSkill: (id: string, skill: Partial<Omit<Skill, 'id'>>) => void;
  deleteSkill: (id: string) => void;
  updateNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
}

export const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  deepinfra: 'https://api.deepinfra.com/v1/openai',
  novita: 'https://api.novita.ai/v3/openai',
  cerebras: 'https://api.cerebras.ai/v1',
  perplexity: 'https://api.perplexity.ai',
  ollama: 'http://127.0.0.1:11434/v1',
  opencode: 'https://opencode.ai/zen/v1',
  deepseek: 'https://api.deepseek.com/v1',
};

const defaultConfigs: Record<AIProvider, ProviderConfig> = {
  openai: { apiKey: '', baseUrl: '', model: 'gpt-4o' },
  anthropic: { apiKey: '', baseUrl: '', model: 'claude-3-5-sonnet-20240620' },
  google: { apiKey: '', baseUrl: '', model: 'gemini-1.5-pro' },
  mistral: { apiKey: '', baseUrl: '', model: 'mistral-large-latest' },
  openrouter: { apiKey: '', baseUrl: '', model: 'meta-llama/llama-3-8b-instruct' },
  groq: { apiKey: '', baseUrl: '', model: 'llama3-8b-8192' },
  together: { apiKey: '', baseUrl: '', model: 'meta-llama/Llama-3-8b-chat-hf' },
  fireworks: { apiKey: '', baseUrl: '', model: 'accounts/fireworks/models/llama-v3-8b-instruct' },
  deepinfra: { apiKey: '', baseUrl: '', model: 'meta-llama/Meta-Llama-3-8B-Instruct' },
  novita: { apiKey: '', baseUrl: '', model: 'meta-llama/llama-3-8b-instruct' },
  cerebras: { apiKey: '', baseUrl: '', model: 'llama3-8b-8192' },
  perplexity: { apiKey: '', baseUrl: '', model: 'llama-3-sonar-large-32k-chat' },
  ollama: { apiKey: '', baseUrl: '', model: 'llama3' },
  opencode: { apiKey: '', baseUrl: '', model: 'opencode-chat' },
  deepseek: { apiKey: '', baseUrl: '', model: 'deepseek-chat' },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currentView: 'chat',
      aiProvider: 'openai',

      providerConfigs: defaultConfigs,

      themeMode: 'dark',
      accentColor: '#007acc',
      backgroundImage: '',
      zoom: 1.0,

      formatOnSave: false,
      codeAutocomplete: true,
      editorMinimapEnabled: false,
      editorWordWrap: false,

      autoApprove: false,
      checkpointsEnabled: true,
      currentPersona: 'Coordinator',
      agentMode: 'auto',
      webSearchEnabled: false,

      // Skills and Notification Settings
      skills: [
        {
          id: 'skill-git-status',
          name: 'Git Status Triage',
          description: 'Runs git status and lists modified files.',
          code: 'git status'
        },
        {
          id: 'skill-lint',
          name: 'Run Linter',
          description: 'Checks the project for syntax and linting errors.',
          code: 'npm run lint'
        }
      ],
      notificationPrefs: {
        toolExecution: true,
        completion: true,
        fsChange: false
      },

      setCurrentView: (view) => set({ currentView: view }),
      setAiProvider: (provider) => set({ aiProvider: provider }),
      updateProviderConfig: (provider, config) => set((state) => ({
        providerConfigs: {
          ...state.providerConfigs,
          [provider]: { ...state.providerConfigs[provider], ...config }
        }
      })),

      setThemeMode: (mode) => set({ themeMode: mode }),
      setAccentColor: (color) => set({ accentColor: color }),
      setBackgroundImage: (url) => set({ backgroundImage: url }),
      setFormatOnSave: (format) => set({ formatOnSave: format }),
      setCodeAutocomplete: (enabled) => set({ codeAutocomplete: enabled }),
      setEditorMinimapEnabled: (enabled) => set({ editorMinimapEnabled: enabled }),
      setEditorWordWrap: (enabled) => set({ editorWordWrap: enabled }),
      setZoom: (zoom) => set({ zoom }),
      setAutoApprove: (approve) => set({ autoApprove: approve }),
      setCheckpointsEnabled: (enabled) => set({ checkpointsEnabled: enabled }),
      setCurrentPersona: (persona) => set({ currentPersona: persona }),
      setAgentMode: (mode) => set({ agentMode: mode }),
      setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),

      addSkill: (skill) => set((state) => ({
        skills: [...state.skills, { ...skill, id: `skill-${Math.random().toString(36).substring(2, 9)}` }]
      })),
      editSkill: (id, updatedSkill) => set((state) => ({
        skills: state.skills.map(s => s.id === id ? { ...s, ...updatedSkill } : s)
      })),
      deleteSkill: (id) => set((state) => ({
        skills: state.skills.filter(s => s.id !== id)
      })),
      updateNotificationPrefs: (prefs) => set((state) => ({
        notificationPrefs: { ...state.notificationPrefs, ...prefs }
      })),
    }),
    {
      name: 'mirai-settings',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({
        aiProvider: state.aiProvider,
        providerConfigs: state.providerConfigs,
        themeMode: state.themeMode,
        accentColor: state.accentColor,
        backgroundImage: state.backgroundImage,
        formatOnSave: state.formatOnSave,
        codeAutocomplete: state.codeAutocomplete,
        editorMinimapEnabled: state.editorMinimapEnabled,
        editorWordWrap: state.editorWordWrap,
        autoApprove: state.autoApprove,
        checkpointsEnabled: state.checkpointsEnabled,
        currentPersona: state.currentPersona,
        agentMode: state.agentMode,
        webSearchEnabled: state.webSearchEnabled,
        zoom: state.zoom,
        skills: state.skills,
        notificationPrefs: state.notificationPrefs,
      }),
    }
  )
);
