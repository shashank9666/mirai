export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  setZoom: (factor: number) => void;
  showOpenDialog: (options: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>;
  readDir: (dirPath: string) => Promise<FileEntry[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  receive: (channel: string, func: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
