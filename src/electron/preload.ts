import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronSecureStorageApi {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface ElectronGitHubOAuthApi {
  exchangeCode: (options: {
    clientId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }) => Promise<{
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  }>;
}

const electronSecureStorage: ElectronSecureStorageApi = {
  getItem: (key) => ipcRenderer.invoke('secure-storage:get-item', key),
  setItem: (key, value) => ipcRenderer.invoke('secure-storage:set-item', key, value),
  removeItem: (key) => ipcRenderer.invoke('secure-storage:remove-item', key),
};

const electronGitHubOAuth: ElectronGitHubOAuthApi = {
  exchangeCode: (options) => ipcRenderer.invoke('github-oauth:exchange-code', options),
};

contextBridge.exposeInMainWorld('electronSecureStorage', electronSecureStorage);
contextBridge.exposeInMainWorld('electronGitHubOAuth', electronGitHubOAuth);
