import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronSecureStorageApi {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

interface LocalRepoScanProgress {
  phase: 'idle' | 'scanning' | 'completed' | 'error';
  scannedDirectories: number;
  discoveredRepositories: number;
  currentPath: string | null;
  message?: string;
}

interface LocalRepoScanResult {
  rootPathToken: string;
  rootLabel: string;
  scannedAt: string;
  ignoredFolders: string[];
  repositories: unknown[];
}

interface LocalFolderPickResult {
  rootPathToken: string;
  rootLabel: string;
  canPersist: boolean;
}

interface LocalPreferredEditorConfig {
  command: string;
  args?: string[];
}

type LocalRoomLaunchMode = 'system-default' | 'preferred-editor';

interface LocalRoomLaunchRequest {
  rootPathToken: string;
  repositoryPathToken: string;
  targetPathToken?: string;
  mode: LocalRoomLaunchMode;
  preferredEditor?: LocalPreferredEditorConfig | null;
}

interface LocalRoomLaunchResult {
  ok: boolean;
  mode: LocalRoomLaunchMode;
  fallbackUsed: boolean;
  message: string | null;
}

interface LocalReadmeLoadRequest {
  rootPathToken: string;
  repositoryPathToken: string;
  maxChars?: number;
}

interface LocalReadmeLoadResult {
  readme: {
    fileName: string;
    plainText: string;
    truncated: boolean;
  } | null;
  unavailableReason: string | null;
}

export interface ElectronLocalReposApi {
  pickParentFolder: () => Promise<LocalFolderPickResult | null>;
  scanParentFolder: (
    rootPathToken: string,
    options?: {
      ignoredFolders?: string[];
      includeGitMetadata?: boolean;
      progressToken?: string;
    },
  ) => Promise<LocalRepoScanResult>;
  subscribeScanProgress: (
    progressToken: string,
    callback: (progress: LocalRepoScanProgress) => void,
  ) => () => void;
  openPath: (request: LocalRoomLaunchRequest) => Promise<LocalRoomLaunchResult>;
  loadReadme: (request: LocalReadmeLoadRequest) => Promise<LocalReadmeLoadResult>;
}

const electronSecureStorage: ElectronSecureStorageApi = {
  getItem: (key) => ipcRenderer.invoke('secure-storage:get-item', key),
  setItem: (key, value) => ipcRenderer.invoke('secure-storage:set-item', key, value),
  removeItem: (key) => ipcRenderer.invoke('secure-storage:remove-item', key),
};

const scanProgressSubscribers = new Map<string, Set<(progress: LocalRepoScanProgress) => void>>();

ipcRenderer.on('local-repos:scan-progress', (_event, payload: { progressToken?: string; progress?: LocalRepoScanProgress }) => {
  const progressToken = payload.progressToken;
  const progress = payload.progress;
  if (!progressToken || !progress) {
    return;
  }

  const subscribers = scanProgressSubscribers.get(progressToken);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  for (const callback of subscribers) {
    callback(progress);
  }
});

const electronLocalRepos: ElectronLocalReposApi = {
  pickParentFolder: () => ipcRenderer.invoke('local-repos:pick-parent-folder'),
  scanParentFolder: (rootPathToken, options) => ipcRenderer.invoke('local-repos:scan-parent-folder', rootPathToken, options),
  openPath: (request) => ipcRenderer.invoke('local-repos:open-path', request),
  loadReadme: (request) => ipcRenderer.invoke('local-repos:load-readme', request),
  subscribeScanProgress: (progressToken, callback) => {
    const existing = scanProgressSubscribers.get(progressToken) ?? new Set<(progress: LocalRepoScanProgress) => void>();
    existing.add(callback);
    scanProgressSubscribers.set(progressToken, existing);

    return () => {
      const listeners = scanProgressSubscribers.get(progressToken);
      if (!listeners) {
        return;
      }
      listeners.delete(callback);
      if (listeners.size === 0) {
        scanProgressSubscribers.delete(progressToken);
      }
    };
  },
};

contextBridge.exposeInMainWorld('electronSecureStorage', electronSecureStorage);
contextBridge.exposeInMainWorld('electronLocalRepos', electronLocalRepos);
