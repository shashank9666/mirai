/**
 * Chat Store — persistent chat history with token tracking and context management.
 * Messages survive page refreshes via zustand persist middleware.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { estimateTokenCount } from '@/lib/agent/policies';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount?: number;
  cost?: number;
  pendingChangeIds?: string[];
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'tokenCount'>) => ChatMessage;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  removeMessage: (id: string) => void;
  setSessionId: (id: string) => void;
  getContextMessages: (maxTokens: number) => ChatMessage[];
  getTokenBreakdown: () => { input: number; output: number; total: number; cost: number };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      sessionId: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,

      addMessage: (msg) => {
        const now = Date.now();
        const tokenCount = estimateTokenCount(msg.content);
        const newMsg: ChatMessage = {
          ...msg,
          id: crypto.randomUUID(),
          timestamp: now,
          tokenCount,
        };
        set((state) => {
          const updates: Partial<ChatState> = {
            messages: [...state.messages, newMsg],
          };
          if (msg.role === 'user') {
            updates.totalInputTokens = state.totalInputTokens + tokenCount;
          } else if (msg.role === 'assistant') {
            updates.totalOutputTokens = state.totalOutputTokens + tokenCount;
          }
          return updates;
        });
        return newMsg;
      },

      updateMessage: (id, updates) =>
        set((state) => {
          let oldTokenCount = 0;
          let newTokenCount = 0;
          let role: 'user' | 'assistant' | 'system' = 'user';

          const newMessages = state.messages.map((m) => {
            if (m.id === id) {
              oldTokenCount = m.tokenCount || 0;
              role = m.role;
              const nextMsg = { ...m, ...updates };
              newTokenCount = updates.content ? estimateTokenCount(updates.content) : (m.tokenCount || 0);
              nextMsg.tokenCount = newTokenCount;
              return nextMsg;
            }
            return m;
          });

          const diff = newTokenCount - oldTokenCount;
          const storeUpdates: Partial<ChatState> = {
            messages: newMessages,
          };

          if (diff !== 0) {
            if (role === 'user') {
              storeUpdates.totalInputTokens = state.totalInputTokens + diff;
            } else if (role === 'assistant') {
              storeUpdates.totalOutputTokens = state.totalOutputTokens + diff;
            }
          }

          return storeUpdates;
        }),

      clearMessages: () =>
        set({
          messages: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
        }),

      removeMessage: (id) =>
        set((state) => {
          const msg = state.messages.find((m) => m.id === id);
          if (!msg) return {};
          return {
            messages: state.messages.filter((m) => m.id !== id),
            totalInputTokens: state.totalInputTokens - (msg.role === 'user' ? (msg.tokenCount || 0) : 0),
            totalOutputTokens: state.totalOutputTokens - (msg.role === 'assistant' ? (msg.tokenCount || 0) : 0),
          };
        }),

      setSessionId: (id) => set({ sessionId: id }),

      getContextMessages: (maxTokens) => {
        const { messages } = get();
        const result: ChatMessage[] = [];
        let totalTokens = 0;
        const systemMessages = messages.filter((m) => m.role === 'system');
        for (const msg of systemMessages) {
          result.push(msg);
          totalTokens += msg.tokenCount || 0;
        }
        const nonSystem = messages.filter((m) => m.role !== 'system');
        for (let i = nonSystem.length - 1; i >= 0; i--) {
          const msg = nonSystem[i];
          const tokens = msg.tokenCount || 0;
          if (totalTokens + tokens > maxTokens) break;
          result.splice(result.length - systemMessages.length, 0, msg);
          totalTokens += tokens;
        }
        return result;
      },

      getTokenBreakdown: () => {
        const { totalInputTokens, totalOutputTokens, totalCost } = get();
        return {
          input: totalInputTokens,
          output: totalOutputTokens,
          total: totalInputTokens + totalOutputTokens,
          cost: totalCost,
        };
      },
    }),
    {
      name: 'mirai-chat-storage',
      partialize: (state) => ({
        messages: state.messages,
        sessionId: state.sessionId,
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens,
        totalCost: state.totalCost,
      }),
    }
  )
);