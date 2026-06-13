export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export const getBackendBase = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
};

const getApiBase = () => `${getBackendBase()}/api`;

export const getWsBase = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:8000`;
  }
  return 'ws://127.0.0.1:8000';
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const post = async <T>(endpoint: string, body: Record<string, unknown>, retries = 3): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
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
    } catch (err) {
      lastError = err as Error;
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
      const res = await fetch(`${getBackendBase()}/health`);
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
    post('/agent/approvals/register', { callId, toolName, callArgs, oldContent, newContent }),

  replyApproval: async (callId: string, approved: boolean): Promise<{ success: boolean }> =>
    post('/agent/approvals/reply', { callId, approved }),

  getApprovalStatus: async (callId: string): Promise<{ status: 'pending' | 'approved' | 'denied' }> => {
    const res = await fetch(`${getApiBase()}/agent/approvals/status/${encodeURIComponent(callId)}`);
    return res.json();
  },

  // -----------------------------------------------------------------------
  // NEW: Workflows
  // -----------------------------------------------------------------------
  createWorkflow: async (title: string, description?: string, tasks?: any[]) =>
    post('/workflows', { title, description, tasks }),

  listWorkflows: async () => {
    const res = await fetch(`${getApiBase()}/workflows`);
    return res.json();
  },

  getWorkflow: async (id: string) => {
    const res = await fetch(`${getApiBase()}/workflows/${id}`);
    return res.json();
  },

  cancelWorkflow: async (id: string) =>
    post(`/workflows/${encodeURIComponent(id)}`, {} as Record<string, unknown>),

  updateTask: async (wfId: string, taskId: string, updates: Record<string, unknown>) =>
    post(`/workflows/${encodeURIComponent(wfId)}/tasks/${encodeURIComponent(taskId)}`, updates),

  addArtifact: async (wfId: string, taskId: string, type: string, title: string, content: string) =>
    post(`/workflows/${encodeURIComponent(wfId)}/tasks/${encodeURIComponent(taskId)}/artifacts`, { type, title, content }),

  listArtifacts: async () => {
    const res = await fetch(`${getApiBase()}/artifacts`);
    return res.json();
  },

  // -----------------------------------------------------------------------
  // NEW: Workspace Graph
  // -----------------------------------------------------------------------
  indexWorkspace: async () =>
    post('/graph/index', {}),

  graphStats: async () => {
    const res = await fetch(`${getApiBase()}/graph/stats`);
    return res.json();
  },

  graphSearch: async (q: string, type?: string) => {
    const params = new URLSearchParams({ q });
    if (type) params.set('type', type);
    const res = await fetch(`${getApiBase()}/graph/search?${params}`);
    return res.json();
  },

  graphNodesByType: async (nodeType: string) => {
    const res = await fetch(`${getApiBase()}/graph/nodes/${encodeURIComponent(nodeType)}`);
    return res.json();
  },

  graphFileNodes: async (filePath: string) => {
    const res = await fetch(`${getApiBase()}/graph/file/${encodeURIComponent(filePath)}`);
    return res.json();
  },

  graphRelated: async (nodeId: string, relation?: string) => {
    const params = relation ? `?relation=${encodeURIComponent(relation)}` : '';
    const res = await fetch(`${getApiBase()}/graph/related/${encodeURIComponent(nodeId)}${params}`);
    return res.json();
  },

  // -----------------------------------------------------------------------
  // NEW: Sessions
  // -----------------------------------------------------------------------
  startSession: async (workspacePath?: string) =>
    post('/session/start', { workspace_path: workspacePath || null }),

  getCurrentSession: async () => {
    const res = await fetch(`${getApiBase()}/session/current`);
    return res.json();
  },

  getResumeContext: async () => {
    const res = await fetch(`${getApiBase()}/session/resume`);
    return res.json();
  },

  listSessions: async () => {
    const res = await fetch(`${getApiBase()}/sessions`);
    return res.json();
  },

  addMessage: async (sessionId: string, role: string, content: string) =>
    post('/session/message', { session_id: sessionId, role, content }),

  getMessages: async (sessionId: string, limit: number = 50) => {
    const res = await fetch(`${getApiBase()}/session/${encodeURIComponent(sessionId)}/messages?limit=${limit}`);
    return res.json();
  },

  // -----------------------------------------------------------------------
  // NEW: MCP
  // -----------------------------------------------------------------------
  mcpListServers: async () => {
    const res = await fetch(`${getApiBase()}/mcp/servers`);
    return res.json();
  },

  mcpConnect: async (name: string) =>
    post('/mcp/connect', { name }),

  mcpDisconnect: async (name: string) =>
    post('/mcp/disconnect', { name }),

  mcpConnectAll: async () =>
    post('/mcp/connectAll', {}),

  mcpRegisterServer: async (config: Record<string, unknown>) =>
    post('/mcp/register', config),
};