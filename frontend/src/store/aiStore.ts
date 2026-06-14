import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AIProviderConfig, AutoApproveSettings } from './ideStore';

interface AiState {
  aiProviders: AIProviderConfig[];
  activeAiProviderId: string | null;
  autoApproveSettings: AutoApproveSettings;
  activeModelId: string;

  setAiProviderConfig: (id: string, config: Partial<AIProviderConfig>) => void;
  setActiveAiProvider: (id: string) => void;
  setAutoApproveSettings: (settings: Partial<AutoApproveSettings>) => void;
  setActiveModelId: (id: string) => void;
}

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

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      aiProviders: DEFAULT_AI_PROVIDERS,
      activeAiProviderId: 'gemini',
      activeModelId: 'gemini-3.1-pro-low',
      autoApproveSettings: {
        readProjectFiles: true,
        readAllFiles: false,
        editProjectFiles: false,
        executeSafeCommands: true,
        executeAllCommands: false,
        useBrowser: false,
        useMcpServers: false,
      },

      setAiProviderConfig: (id, config) => set((state) => ({
        aiProviders: state.aiProviders.map(p => p.id === id ? { ...p, ...config } : p)
      })),

      setActiveAiProvider: (id) => set(() => ({ activeAiProviderId: id })),

      setAutoApproveSettings: (settings) => set((state) => ({
        autoApproveSettings: { ...state.autoApproveSettings, ...settings }
      })),

      setActiveModelId: (id) => set(() => ({ activeModelId: id })),
    }),
    {
      name: 'mirai-ai-storage',
      partialize: (state) => ({
        aiProviders: state.aiProviders,
        activeAiProviderId: state.activeAiProviderId,
        activeModelId: state.activeModelId,
        autoApproveSettings: state.autoApproveSettings,
      }),
    }
  )
);
