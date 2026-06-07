import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage } from '@/lib/llm';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatState {
  sessions: ChatSession[];
  activeChatId: string;
  
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  clearMessages: () => void;
  newChat: () => string;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  getActiveMessages: () => ChatMessage[];
}

const genId = () => Math.random().toString(36).substring(2, 12);

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeChatId: '',

      getActiveMessages: () => {
        const state = get();
        const session = state.sessions.find(s => s.id === state.activeChatId);
        return session?.messages || [];
      },

      setMessages: (updater) => set((state) => {
        const sessions = state.sessions.map(s => {
          if (s.id === state.activeChatId) {
            const newMessages = typeof updater === 'function' ? updater(s.messages) : updater;
            let newTitle = s.title;
            if (s.title === 'New Chat' && newMessages.length > 0) {
              newTitle = newMessages[0]?.content?.substring(0, 50) || 'New Chat';
            }
            return { ...s, messages: newMessages, title: newTitle };
          }
          return s;
        });
        return { sessions };
      }),

      clearMessages: () => set((state) => {
        const sessions = state.sessions.map(s => {
          if (s.id === state.activeChatId) {
            return { ...s, messages: [] };
          }
          return s;
        });
        return { sessions };
      }),

      newChat: () => {
        const id = genId();
        set((state) => ({
          activeChatId: id,
          sessions: [
            { id, title: 'New Chat', messages: [], createdAt: Date.now() },
            ...state.sessions
          ]
        }));
        return id;
      },

      switchChat: (id) => set({ activeChatId: id }),

      deleteChat: (id) => set((state) => {
        const sessions = state.sessions.filter(s => s.id !== id);
        const activeChatId = state.activeChatId === id
          ? (sessions[0]?.id || '')
          : state.activeChatId;
        return { sessions, activeChatId };
      }),

      renameChat: (id, title) => set((state) => {
        const sessions = state.sessions.map(s => {
          if (s.id === id) return { ...s, title };
          return s;
        });
        return { sessions };
      }),
    }),
    {
      name: 'mirai-chat',
      partialize: (state) => ({
        sessions: state.sessions,
        activeChatId: state.activeChatId,
      }),
    }
  )
);
