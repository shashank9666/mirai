import { ChatMessage } from '@/lib/llm';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface SessionState {
  sessionId: string;
  agentMode: 'plan' | 'auto' | 'review';
  persona: string;
  stepCount: number;
  messages: ChatMessage[];
}

declare global {
  interface Window {
    __MIRAI_API_BASE__?: string;
    __MIRAI_WS_BASE__?: string;
  }
}

const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    return window.__MIRAI_API_BASE__ || 'http://127.0.0.1:4000/api';
  }
  return 'http://127.0.0.1:4000/api';
};

export const getWsBase = (): string => {
  if (typeof window !== 'undefined') {
    return window.__MIRAI_WS_BASE__ || 'ws://127.0.0.1:4000';
  }
  return 'ws://127.0.0.1:4000';
};

export const setApiBase = (base: string) => {
  if (typeof window !== 'undefined') {
    window.__MIRAI_API_BASE__ = base;
  }
};

export const setWsBase = (base: string) => {
  if (typeof window !== 'undefined') {
    window.__MIRAI_WS_BASE__ = base;
  }
};

const DEFAULT_TIMEOUT = 10_000; // 10 seconds
const LONG_TIMEOUT = 30_000;    // 30 seconds for streaming/heavy ops

/** Fetch with automatic AbortController timeout */
const fetchWithTimeout = (url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const api = {
  /** Check if the backend is reachable */
  healthCheck: async (): Promise<boolean> => {
    try {
      const res = await fetchWithTimeout(`${getApiBase().replace('/api', '')}/docs`, {}, 3000);
      return res.ok;
    } catch {
      return false;
    }
  },

  readDir: async (dirPath?: string): Promise<{ path: string; entries: FileEntry[] }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/readDir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to read directory');
    }
    return res.json();
  },

  searchFiles: async (pattern: string, dirPath?: string): Promise<string[]> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/searchFiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, dirPath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to search files');
    }
    const data = await res.json();
    return data.results;
  },

  askQuestion: async (question: string, options: string[]): Promise<string> => {
    const res = await fetchWithTimeout(`${getApiBase()}/tools/askQuestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options })
    });
    if (!res.ok) throw new Error('Failed to ask question');
    const data = await res.json();
    return data.answer;
  },

  schedule: async (durationSeconds: number, prompt: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/tools/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds, prompt })
    });
    if (!res.ok) throw new Error('Failed to schedule task');
  },

  generateImage: async (prompt: string, imageName: string, cwd: string): Promise<{ path: string }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/tools/generateImage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, imageName, cwd })
    }, LONG_TIMEOUT);
    if (!res.ok) throw new Error('Failed to generate image');
    return res.json();
  },

  browserSubagent: async (task: string): Promise<{ report: string }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/tools/browserSubagent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task })
    }, LONG_TIMEOUT);
    if (!res.ok) throw new Error('Failed to run browser subagent');
    return res.json();
  },
  
  readFile: async (filePath: string): Promise<string> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/readFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to read file');
    }
    const data = await res.json();
    return data.content;
  },
  
  writeFile: async (filePath: string, content: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/writeFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to write file');
    }
  },

  createFile: async (filePath: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/createFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create file');
    }
  },

  createDir: async (dirPath: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/createDir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create directory');
    }
  },

  renameItem: async (oldPath: string, newPath: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/renameItem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to rename item');
    }
  },

  deleteItem: async (targetPath: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/deleteItem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to complete operation');
    }
  },

  executeCommand: async (command: string, cwd: string): Promise<{ stdout: string, stderr: string, code: number }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/executeCommand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd })
    }, LONG_TIMEOUT);
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute command');
    }
    
    return res.json();
  },

  gitCheckpoint: async (cwd: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/gitCheckpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create git checkpoint');
    }
  },

  webFetch: async (url: string): Promise<string> => {
    const res = await fetchWithTimeout(`${getApiBase()}/web/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch url');
    }
    const data = await res.json();
    return data.text;
  },

  streamChat: async function* (req: {
    messages: { role: string; content: string }[];
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
  }) {
    const res = await fetchWithTimeout(`${getApiBase()}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    }, LONG_TIMEOUT);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Chat request failed');
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (reader) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                yield data;
              } catch {
                // Ignore parse errors from malformed SSE chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  },

  webSearch: async (query: string): Promise<{ url: string; title: string; snippet: string }[]> => {
    const res = await fetchWithTimeout(`${getApiBase()}/web/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to search web');
    }
    const data = await res.json();
    return data.results;
  },

  listTasks: async (): Promise<{ id: string; command: string; cwd: string; status: string; startedAt: string; logs: string }[]> => {
    const res = await fetchWithTimeout(`${getApiBase()}/tasks/list`);
    if (!res.ok) {
      throw new Error('Failed to load tasks');
    }
    const data = await res.json();
    return data.tasks;
  },

  killTask: async (id: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/tasks/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!res.ok) {
      throw new Error('Failed to kill task');
    }
  },

  openFolderPicker: async (): Promise<string | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).electronAPI.showOpenDialog({
        properties: ['openDirectory']
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
    }
    return null;
  },

  getGitBranch: async (cwd?: string): Promise<{ branch: string | null; dirty: boolean }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/git/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd })
    });
    if (!res.ok) return { branch: null, dirty: false };
    return res.json();
  },

  getEslintResults: async (cwd?: string): Promise<{ errors: number; warnings: number }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/eslint/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd })
    });
    if (!res.ok) return { errors: 0, warnings: 0 };
    return res.json();
  },

  openFilePicker: async (): Promise<string | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).electronAPI.showOpenDialog({
        properties: ['openFile']
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
    }
    return null;
  },

  openFilesPicker: async (): Promise<string[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).electronAPI.showOpenDialog({
        properties: ['openFile', 'multiSelections']
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths;
      }
    }
    return [];
  },

  backupFile: async (filePath: string): Promise<boolean> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    if (!res.ok) throw new Error('Failed to backup file');
    const data = await res.json();
    return data.backupExists;
  },

  rollbackFile: async (filePath: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    if (!res.ok) throw new Error('Failed to rollback file');
  },

  commitFile: async (filePath: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    if (!res.ok) throw new Error('Failed to commit backup');
  },

  loadSettings: async (): Promise<string | null> => {
    const res = await fetchWithTimeout(`${getApiBase()}/settings/load`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    const data = await res.json();
    return data.settings;
  },

  saveSettings: async (settings: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/settings/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  },

  registerApproval: async (
    id: string,
    toolName: string,
    toolArgs: string,
    oldContent?: string,
    newContent?: string
  ): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/approvals/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, toolName, arguments: toolArgs, oldContent, newContent })
    });
    if (!res.ok) throw new Error('Failed to register approval request');
  },

  replyApproval: async (id: string, approved: boolean): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/approvals/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved })
    });
    if (!res.ok) throw new Error('Failed to submit approval reply');
  },

  getApprovalStatus: async (id: string): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected'; toolName: string; arguments: Record<string, unknown>; oldContent?: string; newContent?: string }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/approvals/status/${id}`);
    if (!res.ok) throw new Error('Failed to get approval status');
    return res.json();
  },

  getPendingApproval: async (): Promise<{ id: string; status: 'pending'; toolName: string; arguments: Record<string, unknown>; oldContent?: string; newContent?: string } | null> => {
    const res = await fetchWithTimeout(`${getApiBase()}/approvals/pending`);
    if (!res.ok) throw new Error('Failed to query pending approvals');
    const data = await res.json();
    return data.pending;
  },

  saveSessionState: async (sessionId: string, state: SessionState): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/session/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, state })
    });
    if (!res.ok) throw new Error('Failed to save session state');
  },

  loadSessionState: async (sessionId: string): Promise<SessionState | null> => {
    const res = await fetchWithTimeout(`${getApiBase()}/session/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    if (!res.ok) throw new Error('Failed to load session state');
    const data = await res.json();
    return data.state;
  },

  revealInExplorer: async (filePath: string): Promise<void> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/revealInExplorer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    if (!res.ok) throw new Error('Failed to reveal file in explorer');
  },

  grepWorkspace: async (
    pattern: string,
    options: { matchCase: boolean; wholeWord: boolean; isRegex: boolean },
    dirPath?: string
  ): Promise<{ occurrences: { path: string; line: number; content: string }[]; files: string[] }> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/grep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, ...options, dirPath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to search workspace');
    }
    return res.json();
  },

  formatFile: async (filePath: string, content: string): Promise<string> => {
    const res = await fetchWithTimeout(`${getApiBase()}/fs/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Formatting failed');
    }
    const data = await res.json();
    return data.formatted;
  },

  lintFile: async (filePath: string, content: string): Promise<{
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    message: string;
    severity: 'error' | 'warning';
    ruleId: string | null;
    source: string;
  }[]> => {
    try {
      const res = await fetchWithTimeout(`${getApiBase()}/fs/lint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.diagnostics || [];
    } catch {
      return [];
    }
  }
};
