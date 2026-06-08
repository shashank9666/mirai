const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextServer;
const isDev = process.env.NODE_ENV !== 'production';
const NEXT_PORT = 3000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,            // Frameless for custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#09090B',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,     // Allow cross-origin requests to backend in dev
    },
    icon: path.join(__dirname, 'icons', 'icon.png'),
  });

  // Set Content-Security-Policy to remove electron security warning
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*; connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*;"],
      },
    });
  });

  // In dev, load from Next.js dev server
  // In production, load from the built files
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${NEXT_PORT}`);
    // Open DevTools in dev
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: start Next.js server and load it
    mainWindow.loadURL(`http://localhost:${NEXT_PORT}`);
  }

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start the Next.js dev server (only in dev mode)
function startNextDev() {
  return new Promise((resolve, reject) => {
    const frontendDir = path.join(__dirname, '..', 'frontend');
    
    nextServer = spawn('npm', ['run', 'dev'], {
      cwd: frontendDir,
      shell: true,
      env: { ...process.env, PORT: String(NEXT_PORT) },
    });

    nextServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Next.js] ${output}`);
      if (output.includes('Ready') || output.includes('localhost')) {
        resolve();
      }
    });

    nextServer.stderr.on('data', (data) => {
      console.error(`[Next.js] ${data.toString()}`);
    });

    nextServer.on('error', reject);

    // Fallback: resolve after 5 seconds even if we didn't see "Ready"
    setTimeout(resolve, 5000);
  });
}

// --- App Lifecycle ---

app.whenReady().then(async () => {
  if (isDev) {
    // In dev, assume the user is already running `npm run dev` separately
    // Just create the window pointing at localhost:3000
    createWindow();
  } else {
    // In production, start the Next.js server first
    await startNextDev();
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill the Next.js server if we spawned it
  if (nextServer) {
    nextServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers for window controls ---

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});
