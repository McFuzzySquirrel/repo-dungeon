import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronSecureStorageApi {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const electronSecureStorage: ElectronSecureStorageApi = {
  getItem: (key) => ipcRenderer.invoke('secure-storage:get-item', key),
  setItem: (key, value) => ipcRenderer.invoke('secure-storage:set-item', key, value),
  removeItem: (key) => ipcRenderer.invoke('secure-storage:remove-item', key),
};

contextBridge.exposeInMainWorld('electronSecureStorage', electronSecureStorage);
