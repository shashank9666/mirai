export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

const API_BASE = 'http://127.0.0.1:8000/api';
const BACKEND_BASE = 'http://127.0.0.1:8000';

const getApiBase = () => API_BASE;
export const getWsBase = () => 'ws://127.0.0.1:8000';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const post = async <T>(endpoint: string, body: Record<string, unknown>, retries = 3): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Request failed: ${res.status}`);
      }
      return res.json();
    } catch (err) {
      lastError = err as Error;
      // Only retry on network errors, not HTTP errors
      if (err instanceof TypeError || (err as Error).message?.includes('fetch')) {
        if (attempt < retries - 1) {
          await sleep(500 * (attempt + 1));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
};

export interface SearchResult {
  path: string;
  matches: { line: number; text: string }[];
}

export interface ListTask {
  id: string;
  command: string;
  cwd: string;
  status: string;
  logs: string;
}

export interface GitBranchInfo {
  branch: string | null;
  dirty: boolean;
  error?: string;
}

export const api = {
  healthCheck: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BACKEND_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  readDir: async (dirPath?: string): Promise<{ path: string; entries: FileEntry[] }> =>
    post('/fs/readDir', { dirPath: dirPath || null }),

  readFile: async (filePath: string): Promise<{ content: string }> =>
    post('/fs/readFile', { filePath }),

  writeFile: async (filePath: string, content: string): Promise<{ success: boolean }> =>
    post('/fs/writeFile', { filePath, content }),

  createFile: async (filePath: string): Promise<{ success: boolean }> =>
    post('/fs/createFile', { filePath }),

  createDir: async (dirPath: string): Promise<{ success: boolean }> =>
    post('/fs/createDir', { dirPath }),

  renameItem: async (oldPath: string, newPath: string): Promise<{ success: boolean }> =>
    post('/fs/renameItem', { oldPath, newPath }),

  deleteItem: async (targetPath: string): Promise<{ success: boolean }> =>
    post('/fs/deleteItem', { targetPath }),

  searchFiles: async (dirPath: string | null, pattern: string, includes?: string): Promise<{ success: boolean; results: SearchResult[] }> => {
    return post('/fs/searchFiles', { dirPath, pattern, includes });
  },

  listFiles: async (dirPath?: string, maxDepth?: number): Promise<{ success: boolean; results: string[] }> =>
    post('/fs/listFiles', { dirPath: dirPath || null, maxDepth: maxDepth ?? 3 }),

  gitBranch: async (cwd?: string): Promise<GitBranchInfo> =>
    post('/git/branch', { cwd: cwd || null }),

  executeCommand: async (command: string, cwd?: string): Promise<{ success: boolean; stdout: string; stderr: string; code: number }> =>
    post('/tasks/executeCommand', { command, cwd: cwd || null }),

  listTasks: async (): Promise<{ success: boolean; tasks: ListTask[] }> =>
    fetch(`${getApiBase()}/tasks/list`).then(r => r.json()),

  gitDiff: async (cwd?: string): Promise<{ diff: string }> =>
    post('/git/diff', { cwd: cwd || null }),

  gitDiffStaged: async (cwd?: string): Promise<{ diff: string }> =>
    post('/git/diffStaged', { cwd: cwd || null }),

  gitStatus: async (cwd?: string): Promise<{ files: { path: string; status: string }[] }> =>
    post('/git/status', { cwd: cwd || null }),

  gitLog: async (cwd?: string): Promise<{ commits: { sha: string; message: string }[] }> =>
    post('/git/log', { cwd: cwd || null }),

  gitCommit: async (message: string, cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/commit', { cwd: cwd || null, message }),

  gitPush: async (cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/push', { cwd: cwd || null }),

  gitPull: async (cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/pull', { cwd: cwd || null }),

  gitStash: async (cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/stash', { cwd: cwd || null }),

  gitStashPop: async (cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/stashPop', { cwd: cwd || null }),

  gitBranches: async (cwd?: string): Promise<{ branches: string[] }> =>
    post('/git/branches', { cwd: cwd || null }),

  gitCheckout: async (branch: string, cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/checkout', { branch, cwd: cwd || null }),

  gitNewBranch: async (branch: string, cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/newBranch', { branch, cwd: cwd || null }),

  gitAdd: async (files: string = '.', cwd?: string): Promise<{ success: boolean; output: string }> =>
    post('/git/add', { cwd: cwd || null, files }),

  workspaceCurrent: async (): Promise<{ path: string; name: string }> => {
    const res = await fetch(`${getApiBase()}/workspace/current`);
    return res.json();
  },
  workspaceSet: async (path: string): Promise<{ path: string; name: string }> =>
    post('/workspace/set', { path }),
  workspaceListDrives: async (): Promise<{ drives: { name: string; label: string }[] }> => {
    const res = await fetch(`${getApiBase()}/workspace/listDrives`);
    return res.json();
  },
  workspaceListDirectory: async (path: string): Promise<{ path: string; entries: FileEntry[] }> =>
    post('/workspace/listDirectory', { path }),

  registerApproval: async (callId: string, toolName: string, callArgs: string, oldContent?: string, newContent?: string): Promise<{ success: boolean }> =>
    post('/agent/approval/register', { callId, toolName, callArgs, oldContent, newContent }),

  replyApproval: async (callId: string, approved: boolean): Promise<{ success: boolean }> =>
    post('/agent/approval/reply', { callId, approved }),

  getApprovalStatus: async (callId: string): Promise<{ status: 'pending' | 'approved' | 'denied' }> => {
    const res = await fetch(`${getApiBase()}/agent/approval/status?callId=${encodeURIComponent(callId)}`);
    return res.json();
  },
};
