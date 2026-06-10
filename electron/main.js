const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Suppress security warnings in the DevTools console
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

app.commandLine.appendSwitch('disable-web-security');

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

  // Set permissive Content-Security-Policy for Electron desktop app
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* data: blob:; " +
          "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https:; " +
          "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:* https:; " +
          "font-src 'self' data: https:; " +
          "style-src 'self' 'unsafe-inline' https:;"
        ],
      },
    });
  });

  // In dev, load from Next.js dev server
  // In production, load from the built files
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${NEXT_PORT}`);
    // Optional: Open DevTools in dev (commented out so it doesn't pop up automatically)
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
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

// Wait for backend to be healthy (Python FastAPI on port 8000)
function waitForBackend(maxRetries = 60, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    let attempts = 0;

    const check = () => {
      attempts++;
      const req = http.request(
        { hostname: '127.0.0.1', port: 8000, path: '/health', method: 'GET', timeout: 2000 },
        (res) => {
          if (res.statusCode === 200) {
            console.log(`[Backend] Health check passed after ${attempts} attempt(s)`);
            resolve();
          } else {
            retry();
          }
        }
      );
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
      req.end();
    };

    const retry = () => {
      if (attempts >= maxRetries) {
        console.error(`[Backend] Health check failed after ${maxRetries} attempts`);
        // Still resolve — let the app load, frontend will show connection errors
        resolve();
      } else {
        setTimeout(check, intervalMs);
      }
    };

    check();
  });
}

// Wait for Next.js dev server to be ready
function waitForNextJs(maxRetries = 30, intervalMs = 1000) {
  return new Promise((resolve) => {
    const http = require('http');
    let attempts = 0;

    const check = () => {
      attempts++;
      const req = http.request(
        { hostname: 'localhost', port: NEXT_PORT, path: '/', method: 'HEAD', timeout: 2000 },
        (res) => {
          console.log(`[Next.js] Server ready after ${attempts} attempt(s)`);
          resolve();
        }
      );
      req.on('error', () => {
        if (attempts >= maxRetries) {
          console.error(`[Next.js] Server not ready after ${maxRetries} attempts, proceeding anyway`);
          resolve();
        } else {
          setTimeout(check, intervalMs);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (attempts >= maxRetries) {
          resolve();
        } else {
          setTimeout(check, intervalMs);
        }
      });
      req.end();
    };

    check();
  });
}

// --- App Lifecycle ---

app.whenReady().then(async () => {
  // Start Next.js dev server
  await startNextDev();

  // Wait for both Next.js and backend to be available
  console.log('[Startup] Waiting for Next.js and backend...');
  await Promise.all([
    waitForNextJs(),
    waitForBackend(),
  ]);
  console.log('[Startup] Both servers ready, creating window');

  createWindow();

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
