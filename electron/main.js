/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fsSync = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');

function getSavedWindowState() {
  try {
    if (fsSync.existsSync(stateFilePath)) {
      const data = fsSync.readFileSync(stateFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read window state:', err);
  }
  return null;
}

function saveWindowState(bounds) {
  try {
    fsSync.writeFileSync(stateFilePath, JSON.stringify(bounds), 'utf8');
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

function createWindow() {
  const savedState = getSavedWindowState();

  const defaultWidth = 1280;
  const defaultHeight = 800;

  let x, y, width, height;

  if (savedState && savedState.width && savedState.height) {
    width = savedState.width;
    height = savedState.height;
    x = savedState.x;
    y = savedState.y;

    const displays = screen.getAllDisplays();
    const isVisible = displays.some(display => {
      const bounds = display.workArea;
      return (
        x >= bounds.x &&
        y >= bounds.y &&
        x + width <= bounds.x + bounds.width &&
        y + height <= bounds.y + bounds.height
      );
    });

    if (!isVisible) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { workArea } = primaryDisplay;
      width = Math.min(defaultWidth, workArea.width);
      height = Math.min(defaultHeight, workArea.height);
      x = Math.round(workArea.x + (workArea.width - width) / 2);
      y = Math.round(workArea.y + (workArea.height - height) / 2);
    }
  } else {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;
    width = Math.min(defaultWidth, workArea.width);
    height = Math.min(defaultHeight, workArea.height);
    x = Math.round(workArea.x + (workArea.width - width) / 2);
    y = Math.round(workArea.y + (workArea.height - height) / 2);
  }

  const mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false, // Prevent white flash on startup
    fullscreen: false,
    icon: path.join(__dirname, '../frontend/public/logo.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#d4d4d4',
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Show window only when content is painted (eliminates white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const saveState = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      try {
        const bounds = mainWindow.getBounds();
        saveWindowState({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
      } catch (e) { }
    }
  };

  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);

  // Debug logging — dev only
  if (isDev) {
    mainWindow.on('blur', () => console.log('Window Event: blur'));
    mainWindow.on('focus', () => console.log('Window Event: focus'));
    mainWindow.on('minimize', () => console.log('Window Event: minimize'));
    mainWindow.on('restore', () => console.log('Window Event: restore'));
    mainWindow.on('maximize', () => console.log('Window Event: maximize'));
    mainWindow.on('unmaximize', () => console.log('Window Event: unmaximize'));
    mainWindow.on('close', () => console.log('Window Event: close'));
    mainWindow.on('closed', () => console.log('Window Event: closed'));
    mainWindow.on('show', () => console.log('Window Event: show'));
    mainWindow.on('hide', () => console.log('Window Event: hide'));
    mainWindow.webContents.on('did-finish-load', () => console.log('WebContents Event: did-finish-load'));
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => console.log('WebContents Event: did-fail-load', code, desc));
    mainWindow.webContents.on('crashed', () => console.log('WebContents Event: crashed'));
    mainWindow.on('unresponsive', () => console.log('Window Event: unresponsive'));
    mainWindow.on('responsive', () => console.log('Window Event: responsive'));
  }

  // Load dev server
  if (isDev) {
    const DEV_PORT = process.env.NEXT_DEV_PORT || 3000;
    const url = `http://localhost:${DEV_PORT}`;
    
    let retryCount = 0;
    const maxRetries = 25;
    
    const loadDev = async () => {
      try {
        await mainWindow.loadURL(url);
        console.log('Electron loaded dev server at', url);
      } catch (err) {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error(`Failed to load dev server on port ${DEV_PORT} after ${maxRetries} attempts.`);
          mainWindow.loadURL(`data:text/html,${encodeURIComponent(`
            <html>
              <body style="font-family:system-ui,sans-serif;padding:60px;background:#0f111a;color:#a6accd;text-align:center;">
                <h1 style="margin-bottom:12px;">Could not connect to Dev Server</h1>
                <p style="color:#666;margin-bottom:24px;">The frontend server at <code>${url}</code> is not responding.</p>
                <button onclick="location.reload()" style="padding:10px 24px;background:#007acc;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;">
                  Retry Connection
                </button>
              </body>
            </html>
          `)}`);
        } else {
          if (isDev) console.log(`Failed to load ${url}, retrying in 500ms...`);
          setTimeout(loadDev, 500);
        }
      }
    };
    loadDev();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }
}

app.whenReady().then(() => {
  if (isDev) console.log('App Event: ready');
  createWindow();

  app.on('activate', function () {
    if (isDev) console.log('App Event: activate');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (isDev) console.log('App Event: window-all-closed');
  if (process.platform !== 'darwin') app.quit();
});

if (isDev) {
  app.on('quit', () => console.log('App Event: quit'));
  app.on('before-quit', () => console.log('App Event: before-quit'));
  app.on('will-quit', () => console.log('App Event: will-quit'));
}

// Basic IPC for testing
ipcMain.handle('ping', () => 'pong');

// File System IPC (Only showOpenDialog is needed by folder picker)
ipcMain.handle('fs:showOpenDialog', async (event, options) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), options);
  return result;
});

// Update title bar controls background color based on theme changes
ipcMain.on('theme-changed', (event, themeMode) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && win.setTitleBarOverlay) {
    if (themeMode === 'dark') {
      win.setTitleBarOverlay({
        color: '#1e1e1e',
        symbolColor: '#d4d4d4'
      });
    } else {
      win.setTitleBarOverlay({
        color: '#ffffff',
        symbolColor: '#1e1e1e'
      });
    }
  }
});

// Window Controls
ipcMain.handle('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.minimize();
  }
});

ipcMain.handle('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

// DevTools
ipcMain.on('toggle-devtools', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.webContents.toggleDevTools();
  }
});
