import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, session } from 'electron';
import * as path from 'path';
import { MCPDManager } from './mcpd-manager';
import { setupIPC } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let mcpdManager: MCPDManager;

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset',
    icon: icon,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent window from closing, minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!(global as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: 'Start Daemon',
      click: async () => {
        await mcpdManager.startDaemon();
      },
    },
    {
      label: 'Stop Daemon',
      click: async () => {
        await mcpdManager.stopDaemon();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: async () => {
        (global as any).isQuitting = true;
        try {
          await mcpdManager.stopDaemon();
        } catch (error) {
          console.error('Error stopping daemon:', error);
        }
        app.quit();
      },
    },
    {
      label: 'Force Quit',
      click: () => {
        app.exit(0);
      },
    },
  ]);

  tray.setToolTip('MCPD Client');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });

  app.whenReady().then(() => {
    // Configure CSP to allow Monaco Editor
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' https://cdn.jsdelivr.net; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
            "font-src 'self' data: https://cdn.jsdelivr.net; " +
            "worker-src 'self' blob:;"
          ]
        }
      });
    });

    mcpdManager = new MCPDManager();
    setupIPC(mcpdManager);
    createWindow();
    createTray();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', async (event) => {
  if (mcpdManager) {
    event.preventDefault();
    (global as any).isQuitting = true;
    try {
      await mcpdManager.stopDaemon();
    } catch (error) {
      console.error('Error stopping daemon during quit:', error);
    }
    app.exit(0);
  }
});

