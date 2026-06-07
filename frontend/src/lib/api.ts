export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    return 'http://127.0.0.1:4000/api';
  }
  return 'http://127.0.0.1:4000/api';
};

export const api = {
  healthCheck: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${getApiBase().replace('/api', '')}/docs`);
      return res.ok;
    } catch {
      return false;
    }
  },

  readDir: async (dirPath?: string): Promise<{ path: string; entries: FileEntry[] }> => {
    const res = await fetch(`${getApiBase()}/fs/readDir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath: dirPath || null })
    });
    if (!res.ok) throw new Error('Failed to read directory');
    return res.json();
  },

  readFile: async (filePath: string): Promise<{ content: string }> => {
    const res = await fetch(`${getApiBase()}/fs/readFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    if (!res.ok) throw new Error('Failed to read file');
    return res.json();
  },

  writeFile: async (filePath: string, content: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${getApiBase()}/fs/writeFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content })
    });
    if (!res.ok) throw new Error('Failed to write file');
    return res.json();
  }
};
