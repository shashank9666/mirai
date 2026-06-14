/**
 * Chat Store — persistent chat history with token tracking and context management.
 * Messages survive page refreshes via zustand persist middleware.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { estimateTokenCount } from '@/lib/agent/policies';
import { useWorkspaceStore } from './workspaceStore';

export interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'waiting_approval' | 'failed';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: any;
}

export interface AgentStep {
  id: string;
  title: string;
  status: 'running' | 'completed' | 'waiting_approval' | 'failed';
  detail?: string;
  timestamp: number;
  category?: 'read' | 'edit' | 'command' | 'search' | 'tool' | 'plan';
  toolName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount?: number;
  cost?: number;
  pendingChangeIds?: string[];
  toolCalls?: ToolCall[];
  steps?: AgentStep[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  workspaceName: string;
  status: 'running' | 'blocked' | 'completed';
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  conversations: Conversation[];
  activeConversationId: string | null;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'tokenCount'>) => ChatMessage;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  removeMessage: (id: string) => void;
  setSessionId: (id: string) => void;
  getContextMessages: (maxTokens: number) => ChatMessage[];
  getTokenBreakdown: () => { input: number; output: number; total: number; cost: number };

  createConversation: (workspaceName?: string) => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  updateConversationStatus: (id: string, status: Conversation['status']) => void;
  updateConversationTitle: (id: string, title: string) => void;
  migrateLegacyMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      sessionId: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      conversations: [],
      activeConversationId: null,

      migrateLegacyMessages: () => {
        const { messages, conversations } = get();
        if (messages.length > 0 && (!conversations || conversations.length === 0)) {
          const wName = useWorkspaceStore.getState().workspaceName || 'Unknown Workspace';
          const firstUserMsg = messages.find((m) => m.role === 'user')?.content;
          const title = firstUserMsg ? firstUserMsg.slice(0, 45) : 'Previous Chat';
          const now = Date.now();
          const legacyConvo: Conversation = {
            id: crypto.randomUUID(),
            title,
            messages,
            workspaceName: wName,
            status: 'completed',
            createdAt: now,
            updatedAt: now,
          };
          set({
            conversations: [legacyConvo],
            activeConversationId: legacyConvo.id,
          });
        }
      },

      addMessage: (msg) => {
        // Run migration if needed
        get().migrateLegacyMessages();

        const now = Date.now();
        const tokenCount = estimateTokenCount(msg.content);
        const newMsg: ChatMessage = {
          ...msg,
          id: crypto.randomUUID(),
          timestamp: now,
          tokenCount,
        };
        set((state) => {
          let conversations = [...(state.conversations || [])];
          let activeId = state.activeConversationId;

          // Ensure active conversation exists
          if (conversations.length === 0 || !activeId) {
            const wName = useWorkspaceStore.getState().workspaceName || 'Unknown Workspace';
            const newConvo: Conversation = {
              id: crypto.randomUUID(),
              title: msg.role === 'user' ? (msg.content.slice(0, 40) || 'New Chat') : 'New Chat',
              messages: [],
              workspaceName: wName,
              status: 'completed',
              createdAt: now,
              updatedAt: now,
            };
            conversations.push(newConvo);
            activeId = newConvo.id;
          }

          const updatedMessages = [...state.messages, newMsg];

          // Find active conversation and update it
          conversations = conversations.map((c) => {
            if (c.id === activeId) {
              let nextTitle = c.title;
              if ((c.title === 'New Chat' || c.title === '') && msg.role === 'user') {
                nextTitle = msg.content.slice(0, 40) || 'New Chat';
              }
              return {
                ...c,
                messages: updatedMessages,
                title: nextTitle,
                updatedAt: now,
              };
            }
            return c;
          });

          const updates: Partial<ChatState> = {
            messages: updatedMessages,
            conversations,
            activeConversationId: activeId,
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

          let conversations = [...(state.conversations || [])];
          if (state.activeConversationId) {
            conversations = conversations.map((c) => {
              if (c.id === state.activeConversationId) {
                return {
                  ...c,
                  messages: newMessages,
                  updatedAt: Date.now(),
                };
              }
              return c;
            });
          }

          const storeUpdates: Partial<ChatState> = {
            messages: newMessages,
            conversations,
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
        set((state) => {
          let conversations = [...(state.conversations || [])];
          if (state.activeConversationId) {
            conversations = conversations.map((c) => {
              if (c.id === state.activeConversationId) {
                return {
                  ...c,
                  messages: [],
                  updatedAt: Date.now(),
                };
              }
              return c;
            });
          }
          return {
            messages: [],
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCost: 0,
            conversations,
          };
        }),

      removeMessage: (id) =>
        set((state) => {
          const msg = state.messages.find((m) => m.id === id);
          if (!msg) return {};
          const newMessages = state.messages.filter((m) => m.id !== id);

          let conversations = [...(state.conversations || [])];
          if (state.activeConversationId) {
            conversations = conversations.map((c) => {
              if (c.id === state.activeConversationId) {
                return {
                  ...c,
                  messages: newMessages,
                  updatedAt: Date.now(),
                };
              }
              return c;
            });
          }

          return {
            messages: newMessages,
            conversations,
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

      createConversation: (workspaceName) => {
        const now = Date.now();
        const wName = workspaceName || useWorkspaceStore.getState().workspaceName || 'Unknown Workspace';
        const newConvo: Conversation = {
          id: crypto.randomUUID(),
          title: 'New Chat',
          messages: [],
          workspaceName: wName,
          status: 'completed',
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          conversations: [newConvo, ...(state.conversations || [])],
          activeConversationId: newConvo.id,
          messages: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
        }));
        return newConvo.id;
      },

      switchConversation: (id) => {
        set((state) => {
          const conversations = state.conversations || [];
          const convo = conversations.find((c) => c.id === id);
          if (!convo) return {};

          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          convo.messages.forEach((m) => {
            const count = m.tokenCount || 0;
            if (m.role === 'user') totalInputTokens += count;
            else if (m.role === 'assistant') totalOutputTokens += count;
          });

          return {
            activeConversationId: id,
            messages: convo.messages,
            totalInputTokens,
            totalOutputTokens,
            totalCost: 0,
          };
        });
      },

      deleteConversation: (id) => {
        set((state) => {
          const conversations = (state.conversations || []).filter((c) => c.id !== id);
          let activeId = state.activeConversationId;
          let messages = state.messages;
          let totalInputTokens = state.totalInputTokens;
          let totalOutputTokens = state.totalOutputTokens;
          let totalCost = state.totalCost;

          if (activeId === id) {
            if (conversations.length > 0) {
              activeId = conversations[0].id;
              const nextConvo = conversations[0];
              messages = nextConvo.messages;
              totalInputTokens = 0;
              totalOutputTokens = 0;
              nextConvo.messages.forEach((m) => {
                const count = m.tokenCount || 0;
                if (m.role === 'user') totalInputTokens += count;
                else if (m.role === 'assistant') totalOutputTokens += count;
              });
              totalCost = 0;
            } else {
              activeId = null;
              messages = [];
              totalInputTokens = 0;
              totalOutputTokens = 0;
              totalCost = 0;
            }
          }

          return {
            conversations,
            activeConversationId: activeId,
            messages,
            totalInputTokens,
            totalOutputTokens,
            totalCost,
          };
        });
      },

      updateConversationStatus: (id, status) => {
        set((state) => ({
          conversations: (state.conversations || []).map((c) =>
            c.id === id ? { ...c, status, updatedAt: Date.now() } : c
          ),
        }));
      },

      updateConversationTitle: (id, title) => {
        set((state) => ({
          conversations: (state.conversations || []).map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
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
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
