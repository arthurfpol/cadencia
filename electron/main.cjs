const { app, BrowserWindow, Menu, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.setAppUserModelId('com.cadencia.rotina');

let mainWindow = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function getAllowedDevOrigin() {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (!devUrl) return null;
  try {
    return new URL(devUrl).origin;
  } catch {
    return null;
  }
}

function installOfflineNetworkGuard() {
  const allowedOrigin = getAllowedDevOrigin();

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (allowedOrigin && url.startsWith(allowedOrigin)) {
        callback({ cancel: false });
        return;
      }
      callback({ cancel: true });
      return;
    }
    callback({ cancel: false });
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const hasIcon = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#130f22',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d0a19',
      symbolColor: '#eee8ff',
      height: 40,
    },
    ...(hasIcon ? { icon: iconPath } : {}),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const allowedOrigin = getAllowedDevOrigin();
    if (targetUrl.startsWith('file://')) return;
    if (allowedOrigin && targetUrl.startsWith(allowedOrigin)) return;
    event.preventDefault();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  installOfflineNetworkGuard();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
