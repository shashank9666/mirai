/**
 * Task Store — tracks the AI agent's task progress within the IDE.
 * Shows real-time status of what the agent is doing.
 */
import { create } from 'zustand';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    progress?: number; // 0-100
    type: 'read' | 'write' | 'edit' | 'search' | 'execute' | 'browse' | 'think' | 'other';
    createdAt: number;
    updatedAt: number;
    details?: string;
}

interface TaskState {
    tasks: Task[];
    currentTaskId: string | null;
    isAgentRunning: boolean;

    addTask: (title: string, type: Task['type'], description?: string) => string;
    updateTask: (id: string, updates: Partial<Task>) => void;
    removeTask: (id: string) => void;
    clearCompleted: () => void;
    clearAll: () => void;

    beginTask: (title: string, type: Task['type'], description?: string) => string;
    finishTask: (id: string, success?: boolean) => void;
    failTask: (id: string, error?: string) => void;

    setAgentRunning: (running: boolean) => void;
    getCurrentTask: () => Task | null;
    getActiveTasks: () => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
    tasks: [],
    currentTaskId: null,
    isAgentRunning: false,

    addTask: (title, type, description) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const task: Task = {
            id, title, type,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            description,
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
        return id;
    },

    updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
        ),
    })),

    removeTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
    })),

    clearCompleted: () => set((state) => ({
        tasks: state.tasks.filter((t) => t.status === 'pending' || t.status === 'in-progress'),
    })),

    clearAll: () => set({ tasks: [] }),

    beginTask: (title, type, description) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const task: Task = {
            id, title, type,
            status: 'in-progress',
            progress: 0,
            createdAt: now,
            updatedAt: now,
            description,
        };
        set((state) => ({
            tasks: [...state.tasks, task],
            currentTaskId: id,
            isAgentRunning: true,
        }));
        return id;
    },

    finishTask: (id, success = true) => set((state) => ({
        tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: success ? 'completed' : 'failed', progress: success ? 100 : t.progress, updatedAt: Date.now() } : t
        ),
        currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
        isAgentRunning: state.tasks.some((t) => t.id !== id && t.status === 'in-progress'),
    })),

    failTask: (id, error) => set((state) => ({
        tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: 'failed', details: error, updatedAt: Date.now() } : t
        ),
        currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
    })),

    setAgentRunning: (running) => set({ isAgentRunning: running }),

    getCurrentTask: () => {
        const { tasks, currentTaskId } = get();
        if (!currentTaskId) return null;
        return tasks.find((t) => t.id === currentTaskId) ?? null;
    },

    getActiveTasks: () => {
        return get().tasks.filter((t) => t.status === 'in-progress' || t.status === 'pending');
    },
}));