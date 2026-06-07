/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  
  setZoom: (factor) => webFrame.setZoomFactor(factor),

  // File System Operations
  showOpenDialog: (options) => ipcRenderer.invoke('fs:showOpenDialog', options),

  // Theme change
  themeChanged: (themeMode) => ipcRenderer.send('theme-changed', themeMode),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
});
