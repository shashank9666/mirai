export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

const getApiBase = () => 'http://127.0.0.1:8000/api';

const post = async <T>(endpoint: string, body: Record<string, unknown>): Promise<T> => {
  const res = await fetch(`${getApiBase()}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
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
      const res = await fetch(`${getApiBase().replace('/api', '')}/docs`);
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

  searchFiles: async (dirPath: string | null, pattern: string): Promise<{ success: boolean; results: SearchResult[] }> =>
    post('/fs/searchFiles', { dirPath, pattern }),

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
};
