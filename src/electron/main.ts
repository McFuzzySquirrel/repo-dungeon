import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getSecureStorageItem,
  removeSecureStorageItem,
  setSecureStorageItem,
} from './secureStorage.js';

interface GitHubOAuthExchangePayload {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

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

function registerGitHubOAuthHandlers(): void {
  ipcMain.handle('github-oauth:exchange-code', (_event, payload: GitHubOAuthExchangePayload) =>
    exchangeGitHubOAuthCode(payload),
  );
}

async function exchangeGitHubOAuthCode(
  payload: GitHubOAuthExchangePayload,
): Promise<OAuthTokenResponse> {
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('Missing GITHUB_CLIENT_SECRET environment variable for Electron OAuth exchange.');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: payload.clientId,
      client_secret: clientSecret,
      code: payload.code,
      code_verifier: payload.codeVerifier,
      redirect_uri: payload.redirectUri,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || `OAuth token exchange failed (${response.status}).`);
  }

  return (await response.json()) as OAuthTokenResponse;
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
  registerGitHubOAuthHandlers();
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
