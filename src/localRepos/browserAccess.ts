export interface LocalRepoAccessState {
  isLocalRepoModeAvailable: boolean;
  environment: 'electron' | 'trusted-local-web' | 'hosted-web' | 'unknown';
  reason: string | null;
}

import type {
  LocalFolderPickResult,
  LocalRepoAccessApi,
  LocalGitMetadata,
  LocalReadmeLoadRequest,
  LocalReadmeLoadResult,
  LocalRoomLaunchRequest,
  LocalRoomLaunchResult,
  LocalRepoScanResult,
} from '@/localRepos/types';
import { scanDirectoryHandleForGitRepos } from '@/localRepos/scan';
import { splitLocalPathToken } from '@/localRepos/pathTokens';

type DirectoryEntryIterable = AsyncIterable<[string, FileSystemHandle]>;

function iterateDirectoryEntries(handle: FileSystemDirectoryHandle): DirectoryEntryIterable {
  return (handle as FileSystemDirectoryHandle & {
    entries: () => DirectoryEntryIterable;
  }).entries();
}

function hasElectronRuntime(win: Window): boolean {
  const maybeElectronBridge = (win as Window & { electronSecureStorage?: { getItem?: unknown } }).electronSecureStorage;
  if (maybeElectronBridge && typeof maybeElectronBridge.getItem === 'function') {
    return true;
  }

  return /Electron\//iu.test(win.navigator.userAgent);
}

function isTrustedLocalWebOrigin(location: Location): boolean {
  if (location.protocol === 'file:') {
    return true;
  }

  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    return false;
  }

  const hostname = location.hostname.toLowerCase();
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

function canUseFileSystemAccessApi(win: Window): win is Window & {
  showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
} {
  return typeof (win as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

function toFriendlyDirectoryPickerError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('Folder selection was cancelled. Choose a folder to continue local repository scanning.');
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (/showDirectoryPicker/iu.test(message) || /setInterceptFileChooserDialog/iu.test(message)) {
      return new Error('Folder selection is unavailable in this browser session. Try again in your normal browser window.');
    }
  }

  return new Error('Unable to open the folder picker in this browser runtime. Try again or use the Electron desktop app.');
}

async function getDirectoryHandleSafe(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

async function getFileTextSafe(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<string | null> {
  try {
    const fileHandle = await parent.getFileHandle(name);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

function isReadmeFileName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === 'readme' || normalized.startsWith('readme.');
}

async function findReadmeInDirectory(handle: FileSystemDirectoryHandle): Promise<FileSystemFileHandle | null> {
  for await (const [name, entry] of iterateDirectoryEntries(handle)) {
    if (entry.kind === 'file' && isReadmeFileName(name)) {
      return entry as FileSystemFileHandle;
    }
  }
  return null;
}

async function resolveRepositoryDirectoryHandle(
  rootHandle: FileSystemDirectoryHandle,
  repositoryPathToken: string,
): Promise<FileSystemDirectoryHandle | null> {
  const segments = splitLocalPathToken(repositoryPathToken);
  let currentHandle: FileSystemDirectoryHandle = rootHandle;

  for (const segment of segments) {
    const next = await getDirectoryHandleSafe(currentHandle, segment);
    if (!next) {
      return null;
    }
    currentHandle = next;
  }

  return currentHandle;
}

async function readReadmeFromRepoHandle(
  repoHandle: FileSystemDirectoryHandle,
  maxChars?: number,
): Promise<LocalReadmeLoadResult> {
  const readmeHandle = await findReadmeInDirectory(repoHandle);
  if (!readmeHandle) {
    return {
      readme: null,
      unavailableReason: 'No README found in repository root.',
    };
  }

  try {
    const file = await readmeHandle.getFile();
    const text = await file.text();
    if (typeof maxChars === 'number' && Number.isFinite(maxChars) && maxChars > 0) {
      return {
        readme: {
          fileName: file.name,
          plainText: text.substring(0, maxChars),
          truncated: text.length > maxChars,
        },
        unavailableReason: null,
      };
    }

    return {
      readme: {
        fileName: file.name,
        plainText: text,
        truncated: false,
      },
      unavailableReason: null,
    };
  } catch {
    return {
      readme: null,
      unavailableReason: 'Unable to read README from this browser runtime.',
    };
  }
}

function parseBranchFromHead(headRaw: string): string | null {
  const trimmed = headRaw.trim();
  const refPrefix = 'ref:';
  if (!trimmed.toLowerCase().startsWith(refPrefix)) {
    return trimmed.length > 0 ? trimmed.slice(0, 12) : null;
  }

  const ref = trimmed.slice(refPrefix.length).trim();
  const parts = ref.split('/');
  return parts.at(-1) ?? null;
}

function parseRemotesFromGitConfig(configRaw: string): string[] {
  const remotes: string[] = [];
  const lines = configRaw.split(/\r?\n/gu);
  let currentRemote: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    const remoteHeader = line.match(/^\[\s*remote\s+"([^"]+)"\s*\]$/u);
    if (remoteHeader) {
      currentRemote = remoteHeader[1] ?? null;
      continue;
    }

    if (!currentRemote) {
      continue;
    }

    const urlMatch = line.match(/^url\s*=\s*(.+)$/u);
    if (urlMatch?.[1]) {
      remotes.push(`${currentRemote}\t${urlMatch[1].trim()}`);
    }
  }

  return remotes;
}

async function readBrowserGitMetadata(repoHandle: FileSystemDirectoryHandle): Promise<LocalGitMetadata> {
  const gitDir = await getDirectoryHandleSafe(repoHandle, '.git');
  if (!gitDir) {
    return {
      available: false,
      branch: null,
      remotes: [],
      commitCount: null,
      lastCommitAt: null,
      isDirty: null,
      contributorCount: null,
      contributors: [],
      unavailableReason: 'Unable to inspect .git metadata from this browser runtime.',
    };
  }

  const headRaw = await getFileTextSafe(gitDir, 'HEAD');
  const configRaw = await getFileTextSafe(gitDir, 'config');
  const branch = headRaw ? parseBranchFromHead(headRaw) : null;
  const remotes = configRaw ? parseRemotesFromGitConfig(configRaw) : [];

  return {
    available: true,
    branch,
    remotes,
    commitCount: null,
    lastCommitAt: null,
    isDirty: null,
    contributorCount: null,
    contributors: [],
    unavailableReason: 'Commit history and contributor counts require git CLI support (available in Electron mode).',
  };
}

export function getLocalRepoAccessState(): LocalRepoAccessState {
  if (typeof window === 'undefined') {
    return {
      isLocalRepoModeAvailable: false,
      environment: 'unknown',
      reason: 'Local repository mode is only available in browser or Electron runtime.',
    };
  }

  if (hasElectronRuntime(window)) {
    return {
      isLocalRepoModeAvailable: true,
      environment: 'electron',
      reason: null,
    };
  }

  if (isTrustedLocalWebOrigin(window.location)) {
    return {
      isLocalRepoModeAvailable: true,
      environment: 'trusted-local-web',
      reason: null,
    };
  }

  return {
    isLocalRepoModeAvailable: false,
    environment: 'hosted-web',
    reason: 'Local repository mode is disabled on hosted builds. Use Electron or run locally on localhost or file origin.',
  };
}

function normalizeBrowserRootId(pathToken: string): string {
  return pathToken.trim().toLowerCase().replace(/\s+/gu, '-');
}

interface BrowserDirectoryHandleRegistry {
  get: (token: string) => FileSystemDirectoryHandle | null;
  set: (token: string, handle: FileSystemDirectoryHandle) => void;
}

const browserHandleRegistry: BrowserDirectoryHandleRegistry = {
  get(token) {
    const win = window as Window & {
      __repoDungeonLocalHandles?: Map<string, FileSystemDirectoryHandle>;
    };
    if (!win.__repoDungeonLocalHandles) {
      return null;
    }
    return win.__repoDungeonLocalHandles.get(token) ?? null;
  },
  set(token, handle) {
    const win = window as Window & {
      __repoDungeonLocalHandles?: Map<string, FileSystemDirectoryHandle>;
    };
    if (!win.__repoDungeonLocalHandles) {
      win.__repoDungeonLocalHandles = new Map();
    }
    win.__repoDungeonLocalHandles.set(token, handle);
  },
};

export const trustedLocalBrowserAccess: LocalRepoAccessApi = {
  async pickParentFolder(): Promise<LocalFolderPickResult | null> {
    const state = getLocalRepoAccessState();
    if (state.environment !== 'trusted-local-web') {
      return null;
    }

    if (!canUseFileSystemAccessApi(window)) {
      throw new Error('File System Access API is unavailable in this browser runtime.');
    }

    let handle: FileSystemDirectoryHandle;
    try {
      handle = await window.showDirectoryPicker();
    } catch (error) {
      throw toFriendlyDirectoryPickerError(error);
    }

    const rootLabel = handle.name;
    const rootPathToken = `fsa://${rootLabel}/${Date.now().toString(36)}`;

    browserHandleRegistry.set(rootPathToken, handle);

    return {
      rootPathToken,
      rootLabel,
      canPersist: true,
    };
  },

  async scanParentFolder(rootPathToken, options): Promise<LocalRepoScanResult> {
    const state = getLocalRepoAccessState();
    if (state.environment !== 'trusted-local-web') {
      throw new Error('Local repository scanning is only available on trusted local web origins.');
    }

    const handle = browserHandleRegistry.get(rootPathToken);
    if (!handle) {
      throw new Error('Selected local folder handle is unavailable. Re-select the folder and retry.');
    }

    return scanDirectoryHandleForGitRepos({
      rootPathToken,
      rootLabel: handle.name,
      rootHandle: handle,
      ignoredFolders: options?.ignoredFolders,
      includeGitMetadata: true,
      readGitMetadata: readBrowserGitMetadata,
      onProgress: options?.onProgress,
    });
  },

  openPath(request: LocalRoomLaunchRequest): Promise<LocalRoomLaunchResult> {
    return Promise.resolve({
      ok: false,
      mode: request.mode,
      fallbackUsed: false,
      message: 'Opening local filesystem paths is only supported in the Electron desktop app.',
    });
  },

  async loadReadme(request: LocalReadmeLoadRequest): Promise<LocalReadmeLoadResult> {
    const state = getLocalRepoAccessState();
    if (state.environment !== 'trusted-local-web') {
      return {
        readme: null,
        unavailableReason: 'Local README loading is only available on trusted local web origins.',
      };
    }

    const rootHandle = browserHandleRegistry.get(request.rootPathToken);
    if (!rootHandle) {
      return {
        readme: null,
        unavailableReason: 'Selected local folder handle is unavailable. Re-select the folder and retry.',
      };
    }

    const repoHandle = await resolveRepositoryDirectoryHandle(rootHandle, request.repositoryPathToken);
    if (!repoHandle) {
      return {
        readme: null,
        unavailableReason: 'Repository path is unavailable in the selected local folder.',
      };
    }

    return readReadmeFromRepoHandle(repoHandle, request.maxChars);
  },
};

export function createLocalSourceSelectionFromPick(pick: LocalFolderPickResult) {
  return {
    rootPathToken: pick.rootPathToken,
    rootLabel: pick.rootLabel,
    rootId: normalizeBrowserRootId(pick.rootPathToken),
    pickedAt: new Date().toISOString(),
  };
}