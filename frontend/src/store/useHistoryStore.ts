import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FileChangeEntry {
  id: string;
  timestamp: number;
  type: 'writeFile' | 'replaceInFile' | 'deleteItem' | 'renameItem' | 'createFile';
  filePath: string;
  summary: string;
}

export interface ChatSessionEntry {
  id: string;
  timestamp: number;
  title: string;
  messageCount: number;
  fileChanges: FileChangeEntry[];
}

interface HistoryState {
  sessions: ChatSessionEntry[];
  currentSessionId: string | null;
  addFileChange: (change: Omit<FileChangeEntry, 'id' | 'timestamp'>) => void;
  startNewSession: (title?: string) => string;
  setCurrentSession: (id: string) => void;
  incrementMessageCount: () => void;
  clearHistory: () => void;
  setSessionTitle: (title: string) => void;
}

const genId = () => Math.random().toString(36).substring(2, 12);

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      currentSessionId: null,

      addFileChange: (change) => set((state) => {
        const sessionId = state.currentSessionId;
        if (!sessionId) return state;
        const newEntry: FileChangeEntry = { ...change, id: genId(), timestamp: Date.now() };
        const sessions = state.sessions.map(s => {
          if (s.id === sessionId) {
            return { ...s, fileChanges: [...s.fileChanges, newEntry] };
          }
          return s;
        });
        return { sessions };
      }),

      startNewSession: (title) => {
        const id = genId();
        set((state) => ({
          currentSessionId: id,
          sessions: [
            { id, timestamp: Date.now(), title: title || `Session ${state.sessions.length + 1}`, messageCount: 0, fileChanges: [] },
            ...state.sessions
          ]
        }));
        return id;
      },

      setCurrentSession: (id) => set({ currentSessionId: id }),

      incrementMessageCount: () => set((state) => {
        const sessionId = state.currentSessionId;
        if (!sessionId) return state;
        const sessions = state.sessions.map(s => {
          if (s.id === sessionId) {
            return { ...s, messageCount: s.messageCount + 1 };
          }
          return s;
        });
        return { sessions };
      }),

      clearHistory: () => set({ sessions: [], currentSessionId: null }),

      setSessionTitle: (title) => set((state) => {
        const sessionId = state.currentSessionId;
        if (!sessionId) return state;
        const sessions = state.sessions.map(s => {
          if (s.id === sessionId) {
            return { ...s, title };
          }
          return s;
        });
        return { sessions };
      })
    }),
    {
      name: 'mirai-history',
    }
  )
);
