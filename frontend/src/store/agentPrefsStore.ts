import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgentPreferences, DEFAULT_AGENT_PREFERENCES } from '@/lib/agent/policies';

interface AgentPrefsState {
    prefs: AgentPreferences;
    updatePrefs: (partial: Partial<AgentPreferences>) => void;
    resetPrefs: () => void;
}

export const useAgentPrefsStore = create<AgentPrefsState>()(
    persist(
        (set) => ({
            prefs: { ...DEFAULT_AGENT_PREFERENCES },
            updatePrefs: (partial) => set((state) => ({
                prefs: { ...state.prefs, ...partial }
            })),
            resetPrefs: () => set({ prefs: { ...DEFAULT_AGENT_PREFERENCES } }),
        }),
        { name: 'mirai-agent-prefs' }
    )
);