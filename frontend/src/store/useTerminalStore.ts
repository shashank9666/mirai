import { create } from 'zustand';

export type ShellType = 'powershell' | 'cmd' | 'gitbash' | 'bash';

export interface TerminalInstance {
  id: string;
  name: string;
  shell: ShellType;
  splitWithId?: string;
}

interface TerminalState {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  
  addTerminal: (shell?: ShellType) => string;
  killTerminal: (id: string) => void;
  splitTerminal: (id: string, shell?: ShellType) => string | null;
  setActiveTerminalId: (id: string | null) => void;
}

const genId = () => `term-${Math.random().toString(36).substring(2, 9)}`;

const getDefaultShell = (): ShellType => {
  if (typeof window !== 'undefined') {
    const platform = window.navigator.platform.toLowerCase();
    if (platform.includes('win')) {
      return 'powershell';
    }
  }
  return 'bash';
};

const getShellName = (shell: ShellType, index: number): string => {
  const label = shell === 'powershell' 
    ? 'PowerShell' 
    : shell === 'cmd' 
      ? 'Command Prompt' 
      : shell === 'gitbash' 
        ? 'Git Bash' 
        : 'Bash';
  return `${index}: ${label}`;
};

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTerminalId: null,

  addTerminal: (shell) => {
    const id = genId();
    const resolvedShell = shell || getDefaultShell();
    
    set((state) => {
      const index = state.terminals.length + 1;
      const name = getShellName(resolvedShell, index);
      const newTerm: TerminalInstance = { id, name, shell: resolvedShell };
      const newTerminals = [...state.terminals, newTerm];
      return {
        terminals: newTerminals,
        activeTerminalId: id
      };
    });
    
    return id;
  },

  killTerminal: (id) => {
    set((state) => {
      const termToKill = state.terminals.find(t => t.id === id);
      if (!termToKill) return {};

      // Remove pointers to this split terminal in siblings
      const newTerminals = state.terminals
        .filter(t => t.id !== id)
        .map(t => {
          if (t.splitWithId === id) {
            return { ...t, splitWithId: undefined };
          }
          return t;
        });

      let nextActiveId = state.activeTerminalId;
      if (state.activeTerminalId === id) {
        // If we killed the active terminal, pick the sibling it was split with, or the last terminal
        if (termToKill.splitWithId) {
          nextActiveId = termToKill.splitWithId;
        } else {
          nextActiveId = newTerminals.length > 0 ? newTerminals[newTerminals.length - 1].id : null;
        }
      }

      return {
        terminals: newTerminals,
        activeTerminalId: nextActiveId
      };
    });
  },

  splitTerminal: (id, shell) => {
    const state = get();
    const parentTerm = state.terminals.find(t => t.id === id);
    if (!parentTerm) return null;

    // Do not allow double splitting of already split terminals for UI simplicity
    if (parentTerm.splitWithId) return null;

    const childId = genId();
    const resolvedShell = shell || parentTerm.shell;

    set((state) => {
      const index = state.terminals.length + 1;
      const name = getShellName(resolvedShell, index);
      
      const newTerm: TerminalInstance = { 
        id: childId, 
        name, 
        shell: resolvedShell,
        splitWithId: id
      };

      const newTerminals = state.terminals.map(t => {
        if (t.id === id) {
          return { ...t, splitWithId: childId };
        }
        return t;
      });

      newTerminals.push(newTerm);

      return {
        terminals: newTerminals,
        activeTerminalId: childId
      };
    });

    return childId;
  },

  setActiveTerminalId: (id) => set({ activeTerminalId: id })
}));
