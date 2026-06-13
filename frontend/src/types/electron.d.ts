// Type declarations for the Electron preload API
// Available when running inside the Electron shell

interface ElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  platform: string;
  onMaximizeChange: (callback: (maximized: boolean) => void) => void;
  removeMaximizeListener: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __miraiEditor?: unknown;
    __miraiSetModifiedLines?: (modifiedLines: number[]) => void;
  }
}

export { };
