'use client';

import { ProactiveEvent } from '@/components/ide/ProactiveNotifications';

/**
 * API utilities for frontend-backend communication
 */

export const getBackendBase = (): string => {
  if (typeof window !== 'undefined') {
    // Check if we're in Electron
    if (window.electronAPI) {
      return 'http://localhost:8000';
    }
    // Check if backend is running locally
    try {
      return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
    } catch {
      return 'http://localhost:8000';
    }
  }
  return 'http://localhost:8000';
};

export const getWsBase = (): string => {
  return getBackendBase().replace(/^http/, 'ws');
};

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

/**
 * Voice API - Speech to Text
 */
export const voiceSTT = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');

  try {
    const response = await fetch(`${getBackendBase()}/api/voice/stt`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('STT error:', error);
    return '';
  }
};

/**
 * Voice API - Text to Speech
 */
export const voiceTTS = async (text: string): Promise<Blob> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/voice/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    if (!data.audio_base64) throw new Error('No audio returned');
    
    // Decode base64 to Blob
    const byteCharacters = atob(data.audio_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: `audio/${data.format || 'mp3'}` });
  } catch (error) {
    console.error('TTS error:', error);
    throw error;
  }
};

/**
 * Memory API - Save memory
 */
export const saveMemory = async (key: string, value: unknown): Promise<void> => {
  try {
    await fetch(`${getBackendBase()}/api/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, value }),
    });
  } catch (error) {
    console.error('Save memory error:', error);
  }
};

/**
 * Memory API - Get memory
 */
export const getMemory = async (key: string): Promise<unknown> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/memory/${key}`);
    const data = await response.json();
    return data.value;
  } catch (error) {
    console.error('Get memory error:', error);
    return null;
  }
};

/**
 * Memory API - Get all memory
 */
export const getAllMemory = async (): Promise<Record<string, unknown>> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/memory`);
    const data = await response.json();
    return data.memory || {};
  } catch (error) {
    console.error('Get all memory error:', error);
    return {};
  }
};

/**
 * Events API - Get events
 */
export const getEvents = async (params: { unacknowledged?: boolean; limit?: number } = {}): Promise<{ events: ProactiveEvent[] }> => {
  const query = new URLSearchParams();
  if (params.unacknowledged) query.append('unacknowledged', 'true');
  if (params.limit) query.append('limit', params.limit.toString());

  try {
    const response = await fetch(`${getBackendBase()}/api/events?${query.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Get events error:', error);
    return { events: [] };
  }
};

/**
 * Events API - Acknowledge event
 */
export const acknowledgeEvent = async (eventId: string): Promise<void> => {
  try {
    await fetch(`${getBackendBase()}/api/events/ack/${eventId}`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Acknowledge event error:', error);
  }
};

/**
 * Events API - Clear all events
 */
export const clearEvents = async (): Promise<void> => {
  try {
    await fetch(`${getBackendBase()}/api/events/clear`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Clear events error:', error);
  }
};

/**
 * Context API - Get workspace context
 */
export const getWorkspaceContext = async (): Promise<Record<string, unknown>> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/context`);
    return await response.json();
  } catch (error) {
    console.error('Get context error:', error);
    return {};
  }
};

/**
 * Agent API - Send message with context
 */
export const sendAgentMessage = async (message: string, context?: Record<string, unknown>): Promise<{ response: string }> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context: context || {},
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Send agent message error:', error);
    return { response: 'Error communicating with agent' };
  }
};

/**
 * Git API wrapper object
 */
export const api = {
  readDir: async (dirPath?: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/readDir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dirPath }) });
    return res.json();
  },
  readFile: async (filePath: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/readFile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath }) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  writeFile: async (filePath: string, content: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/writeFile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, content }) });
    return res.json();
  },
  createFile: async (filePath: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/createFile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath }) });
    return res.json();
  },
  createDir: async (dirPath: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/createDir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dirPath }) });
    return res.json();
  },
  renameItem: async (oldPath: string, newPath: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/renameItem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPath, newPath }) });
    return res.json();
  },
  deleteItem: async (targetPath: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/deleteItem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPath }) });
    return res.json();
  },
  searchFiles: async (dirPath: string | null, pattern: string, includes: string) => {
    const res = await fetch(`${getBackendBase()}/api/fs/searchFiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dirPath, pattern, includes }) });
    return res.json();
  },
  listFiles: async (dirPath?: string, maxDepth?: number) => {
    const res = await fetch(`${getBackendBase()}/api/fs/listFiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dirPath, maxDepth }) });
    return res.json();
  },
  healthCheck: async () => {
    try {
      const res = await fetch(`${getBackendBase()}/api/workspace/status`);
      return res.ok;
    } catch {
      return false;
    }
  },
  workspaceSet: async (path: string) => {
    const res = await fetch(`${getBackendBase()}/api/workspace/set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
    return res.json();
  },
  workspacePick: async () => {
    const res = await fetch(`${getBackendBase()}/api/workspace/pick`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('No folder selected');
    return res.json();
  },
  workspaceListDrives: async () => {
    const res = await fetch(`${getBackendBase()}/api/workspace/listDrives`);
    return res.json();
  },
  workspaceListDirectory: async (path: string) => {
    const res = await fetch(`${getBackendBase()}/api/workspace/listDirectory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
    return res.json();
  },
  executeCommand: async (command: string) => {
    const res = await fetch(`${getBackendBase()}/api/terminal/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command }) });
    return res.json();
  },
  listTasks: async () => {
    const res = await fetch(`${getBackendBase()}/api/tasks/list`);
    return res.json();
  },
  isMaximized: async () => false,
  onMaximizeChange: (_cb: (val: boolean) => void) => {},
  removeMaximizeListener: () => {},
  gitBranch: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitStatus: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitLog: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitBranches: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitAdd: async (files: string, cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, cwd }),
    });
    return res.json();
  },
  gitCommit: async (message: string, cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, cwd }),
    });
    return res.json();
  },
  gitPush: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitPull: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitStash: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/stash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitStashPop: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/stashPop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  },
  gitNewBranch: async (branch: string, cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/newBranch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, cwd }),
    });
    return res.json();
  },
  gitCheckout: async (branch: string, cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, cwd }),
    });
    return res.json();
  },
  gitDiff: async (cwd?: string) => {
    const res = await fetch(`${getBackendBase()}/api/git/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    return res.json();
  }
};