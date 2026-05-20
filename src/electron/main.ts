import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getSecureStorageItem,
  removeSecureStorageItem,
  setSecureStorageItem,
} from './secureStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

function isSafeExternalUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function registerSecureStorageHandlers(): void {
  ipcMain.handle('secure-storage:get-item', (_event, key: string) => getSecureStorageItem(key));
  ipcMain.handle('secure-storage:set-item', (_event, key: string, value: string) =>
    setSecureStorageItem(key, value),
  );
  ipcMain.handle('secure-storage:remove-item', (_event, key: string) => removeSecureStorageItem(key));
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isSafeExternalUrl(url)) {
      return { action: 'deny' };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!isSafeExternalUrl(url)) {
      event.preventDefault();
    }
  });

  if (isDev && devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    await window.loadFile(path.resolve(__dirname, '..', '..', 'dist', 'index.html'));
  }
}

void app.whenReady().then(async () => {
  registerSecureStorageHandlers();
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
