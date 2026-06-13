/**
 * Context Store — Workspace awareness for the AI agent.
 *
 * Automatically provides the agent with:
 *   - Active file and content
 *   - Open tabs
 *   - Workspace name
 *   - Git branch
 *   - Terminal running state
 *   - Diagnostics/errors
 */
import { create } from 'zustand';

export interface WorkspaceContext {
    activeFile: string | null;
    activeFileContent: string;
    openTabs: string[];
    workspace: string;
    workspacePath: string;
    gitBranch: string;
    terminalRunning: boolean;
    diagnostics: string[];
    lastFileSave: string;
    recentErrors: string[];
}

interface ContextStore {
    context: WorkspaceContext;
    updateContext: (updates: Partial<WorkspaceContext>) => void;
    setActiveFile: (path: string, content: string) => void;
    addOpenTab: (path: string) => void;
    removeOpenTab: (path: string) => void;
    setWorkspace: (name: string, path: string) => void;
    setGitBranch: (branch: string) => void;
    setTerminalRunning: (running: boolean) => void;
    addDiagnostic: (diagnostic: string) => void;
    clearDiagnostics: () => void;
    addRecentError: (error: string) => void;
    getContextPayload: () => Record<string, unknown>;
}

export const useContextStore = create<ContextStore>()((set, get) => ({
    context: {
        activeFile: null,
        activeFileContent: '',
        openTabs: [],
        workspace: '',
        workspacePath: '',
        gitBranch: 'main',
        terminalRunning: false,
        diagnostics: [],
        lastFileSave: '',
        recentErrors: [],
    },

    updateContext: (updates) =>
        set((state) => ({
            context: { ...state.context, ...updates },
        })),

    setActiveFile: (path, content) =>
        set((state) => ({
            context: {
                ...state.context,
                activeFile: path,
                activeFileContent: content,
            },
        })),

    addOpenTab: (path) =>
        set((state) => ({
            context: {
                ...state.context,
                openTabs: state.context.openTabs.includes(path)
                    ? state.context.openTabs
                    : [...state.context.openTabs, path],
            },
        })),

    removeOpenTab: (path) =>
        set((state) => ({
            context: {
                ...state.context,
                openTabs: state.context.openTabs.filter((t) => t !== path),
            },
        })),

    setWorkspace: (name, path) =>
        set((state) => ({
            context: {
                ...state.context,
                workspace: name,
                workspacePath: path,
            },
        })),

    setGitBranch: (branch) =>
        set((state) => ({
            context: {
                ...state.context,
                gitBranch: branch,
            },
        })),

    setTerminalRunning: (running) =>
        set((state) => ({
            context: {
                ...state.context,
                terminalRunning: running,
            },
        })),

    addDiagnostic: (diagnostic) =>
        set((state) => ({
            context: {
                ...state.context,
                diagnostics: [
                    ...state.context.diagnostics.slice(-9),
                    diagnostic,
                ],
            },
        })),

    clearDiagnostics: () =>
        set((state) => ({
            context: {
                ...state.context,
                diagnostics: [],
            },
        })),

    addRecentError: (error) =>
        set((state) => ({
            context: {
                ...state.context,
                recentErrors: [
                    ...state.context.recentErrors.slice(-4),
                    error,
                ],
            },
        })),

    getContextPayload: () => {
        const { context } = get();
        return {
            activeFile: context.activeFile,
            openTabs: context.openTabs,
            workspace: context.workspace,
            gitBranch: context.gitBranch,
            terminalRunning: context.terminalRunning,
            diagnostics: context.diagnostics,
        };
    },
}));