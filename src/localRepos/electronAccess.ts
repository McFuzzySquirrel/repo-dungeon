import type {
  LocalFolderPickResult,
  LocalRepoAccessApi,
  LocalReadmeLoadRequest,
  LocalReadmeLoadResult,
  LocalRoomLaunchRequest,
  LocalRoomLaunchResult,
  LocalScanProgress,
  LocalRepoScanResult,
} from '@/localRepos/types';

interface ElectronLocalReposBridge {
  pickParentFolder: () => Promise<LocalFolderPickResult | null>;
  scanParentFolder: (
    rootPathToken: string,
    options?: {
      ignoredFolders?: string[];
      includeGitMetadata?: boolean;
      progressToken?: string;
    },
  ) => Promise<LocalRepoScanResult>;
  subscribeScanProgress: (progressToken: string, callback: (progress: LocalScanProgress) => void) => () => void;
  openPath: (request: LocalRoomLaunchRequest) => Promise<LocalRoomLaunchResult>;
  loadReadme: (request: LocalReadmeLoadRequest) => Promise<LocalReadmeLoadResult>;
}

function getBridge(): ElectronLocalReposBridge | null {
  const win = window as Window & { electronLocalRepos?: ElectronLocalReposBridge };
  return win.electronLocalRepos ?? null;
}

function createProgressToken(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isElectronLocalRepoAccessAvailable(): boolean {
  return getBridge() !== null;
}

export const electronLocalRepoAccess: LocalRepoAccessApi = {
  async pickParentFolder(): Promise<LocalFolderPickResult | null> {
    const bridge = getBridge();
    if (!bridge) {
      throw new Error('Electron local repository access is unavailable in this runtime.');
    }
    return bridge.pickParentFolder();
  },

  async scanParentFolder(
    rootPathToken: string,
    options,
  ): Promise<LocalRepoScanResult> {
    const bridge = getBridge();
    if (!bridge) {
      throw new Error('Electron local repository access is unavailable.');
    }

    const progressToken = createProgressToken();
    const unsubscribe = options?.onProgress
      ? bridge.subscribeScanProgress(progressToken, options.onProgress)
      : null;

    try {
      return await bridge.scanParentFolder(rootPathToken, {
        ignoredFolders: options?.ignoredFolders,
        includeGitMetadata: options?.includeGitMetadata,
        progressToken,
      });
    } finally {
      unsubscribe?.();
    }
  },

  async openPath(request): Promise<LocalRoomLaunchResult> {
    const bridge = getBridge();
    if (!bridge) {
      return {
        ok: false,
        mode: request.mode,
        fallbackUsed: false,
        message: 'Electron local repository launch APIs are unavailable in this runtime.',
      };
    }

    return bridge.openPath(request);
  },

  async loadReadme(request): Promise<LocalReadmeLoadResult> {
    const bridge = getBridge();
    if (!bridge) {
      return {
        readme: null,
        unavailableReason: 'Electron local repository README APIs are unavailable in this runtime.',
      };
    }

    return bridge.loadReadme(request);
  },
};