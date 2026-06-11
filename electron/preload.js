const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Platform info
  platform: process.platform,

  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Listen for maximize state changes from main process
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window:maximize-changed', (_event, maximized) => callback(maximized));
  },

  // Clean up listeners
  removeMaximizeListener: () => {
    ipcRenderer.removeAllListeners('window:maximize-changed');
  },
});
