import { detectFilesystemSignals, isIgnoredFolderName, addLanguageFromFileName } from '@/localRepos/metadata';
import { sanitizeLocalPathToken } from '@/localRepos/pathTokens';
import type {
  LocalGitMetadata,
  LocalRepoScanCandidate,
  LocalScanProgress,
  LocalRepoScanResult,
} from '@/localRepos/types';
import { DEFAULT_IGNORED_FOLDERS } from '@/localRepos/types';

type DirectoryEntryIterable = AsyncIterable<[string, FileSystemHandle]>;

function iterateDirectoryEntries(handle: FileSystemDirectoryHandle): DirectoryEntryIterable {
  return (handle as FileSystemDirectoryHandle & {
    entries: () => DirectoryEntryIterable;
  }).entries();
}

interface BrowserScanOptions {
  rootPathToken: string;
  rootLabel: string;
  rootHandle: FileSystemDirectoryHandle;
  ignoredFolders?: readonly string[];
  includeGitMetadata?: boolean;
  readGitMetadata?: (repoHandle: FileSystemDirectoryHandle) => Promise<LocalGitMetadata>;
  onProgress?: (progress: LocalScanProgress) => void;
}

interface BrowserRepoNode {
  handle: FileSystemDirectoryHandle;
  absolutePath: string;
  relativePath: string;
  name: string;
}

interface RelativeDirectoryNode {
  handle: FileSystemDirectoryHandle;
  relativePath: string;
}

function isReadmeFileName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === 'readme' || normalized.startsWith('readme.');
}

async function readBrowserReadmePreview(handle: FileSystemFileHandle, fileName: string): Promise<{
  fileName: string;
  plainText: string;
  truncated: boolean;
} | null> {
  try {
    const file = await handle.getFile();
    const raw = await file.text();
    const maxChars = 2000;
    const plainText = raw.substring(0, maxChars);
    return {
      fileName,
      plainText,
      truncated: raw.length > maxChars,
    };
  } catch {
    return null;
  }
}

async function hasGitMarker(handle: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const [name, entry] of iterateDirectoryEntries(handle)) {
    if (name === '.git' && entry.kind === 'directory') {
      return true;
    }
  }
  return false;
}

function emitProgress(
  onProgress: BrowserScanOptions['onProgress'],
  progress: LocalScanProgress,
): void {
  onProgress?.(progress);
}

async function collectRepoMetadata(
  node: BrowserRepoNode,
  readGitMetadata: BrowserScanOptions['readGitMetadata'],
  includeGitMetadata: boolean,
  ignoredFolders: readonly string[],
): Promise<LocalRepoScanCandidate> {
  const fileNames: string[] = [];
  let fileCount = 0;
  let directoryCount = 0;
  const languageBreakdown: Record<string, number> = {};
  const relativeDirectoryPaths: string[] = [];
  const topLevelTree: LocalRepoScanCandidate['topLevelTree'] = [];
  let readmePreview: LocalRepoScanCandidate['readmePreview'] = null;

  for await (const [name, entry] of iterateDirectoryEntries(node.handle)) {
    if (entry.kind === 'file') {
      fileCount += 1;
      fileNames.push(name);
      addLanguageFromFileName(name, languageBreakdown);
      topLevelTree.push({ path: name, type: 'file' });
      if (!readmePreview && isReadmeFileName(name)) {
        readmePreview = await readBrowserReadmePreview(entry as FileSystemFileHandle, name);
      }
      continue;
    }

    directoryCount += 1;
    topLevelTree.push({ path: name, type: 'dir' });
  }

  const nestedQueue: RelativeDirectoryNode[] = [{
    handle: node.handle,
    relativePath: '',
  }];

  while (nestedQueue.length > 0) {
    const current = nestedQueue.shift();
    if (!current) {
      break;
    }

    for await (const [name, entry] of iterateDirectoryEntries(current.handle)) {
      if (entry.kind !== 'directory') {
        continue;
      }

      const directoryEntry = entry as FileSystemDirectoryHandle;

      if (isIgnoredFolderName(name, ignoredFolders)) {
        continue;
      }

      const rawRelativePath = current.relativePath ? `${current.relativePath}/${name}` : name;
      const sanitized = sanitizeLocalPathToken(rawRelativePath);
      if (sanitized === null || sanitized.length === 0) {
        continue;
      }

      if (await hasGitMarker(directoryEntry)) {
        // Nested repositories are out of scope for basement traversal support.
        continue;
      }

      relativeDirectoryPaths.push(sanitized);
      nestedQueue.push({
        handle: directoryEntry,
        relativePath: sanitized,
      });
    }
  }

  const git = includeGitMetadata && readGitMetadata
    ? await readGitMetadata(node.handle)
    : {
      available: false,
      branch: null,
      remotes: [],
      commitCount: null,
      lastCommitAt: null,
      isDirty: null,
      contributorCount: null,
      unavailableReason: 'git metadata extraction is unavailable in trusted-local browser mode.',
    };

  return {
    rootPathToken: '',
    rootLabel: '',
    absolutePath: node.absolutePath,
    relativePath: node.relativePath,
    relativeDirectoryPaths,
    name: node.name,
    discoveredAt: new Date().toISOString(),
    fileCount,
    directoryCount,
    topLevelTree,
    readmePreview,
    languageBreakdown,
    filesystem: detectFilesystemSignals(fileNames),
    git,
  };
}

export async function scanDirectoryHandleForGitRepos(options: BrowserScanOptions): Promise<LocalRepoScanResult> {
  const ignoredFolders = [...(options.ignoredFolders ?? DEFAULT_IGNORED_FOLDERS)];
  const repositories: LocalRepoScanCandidate[] = [];
  let scannedDirectories = 0;

  emitProgress(options.onProgress, {
    phase: 'scanning',
    scannedDirectories: 0,
    discoveredRepositories: 0,
    currentPath: options.rootLabel,
    message: 'Scanning local folders for git repositories...',
  });

  const queue: BrowserRepoNode[] = [{
    handle: options.rootHandle,
    absolutePath: options.rootLabel,
    relativePath: '',
    name: options.rootLabel,
  }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    scannedDirectories += 1;

    const isRepo = await hasGitMarker(current.handle);
    if (isRepo) {
      const candidate = await collectRepoMetadata(
        current,
        options.readGitMetadata,
        Boolean(options.includeGitMetadata),
        ignoredFolders,
      );
      repositories.push({
        ...candidate,
        rootPathToken: options.rootPathToken,
        rootLabel: options.rootLabel,
      });

      emitProgress(options.onProgress, {
        phase: 'scanning',
        scannedDirectories,
        discoveredRepositories: repositories.length,
        currentPath: current.relativePath || current.name,
        message: `Discovered repository ${candidate.name}`,
      });
    }

    const shouldTraverseChildren = !isRepo || current.relativePath.length === 0;
    if (!shouldTraverseChildren) {
      continue;
    }

    for await (const [name, entry] of iterateDirectoryEntries(current.handle)) {
      if (entry.kind !== 'directory') {
        continue;
      }

      const directoryEntry = entry as FileSystemDirectoryHandle;

      if (isIgnoredFolderName(name, ignoredFolders)) {
        continue;
      }

      const relativePath = current.relativePath ? `${current.relativePath}/${name}` : name;
      queue.push({
        handle: directoryEntry,
        absolutePath: `${current.absolutePath}/${name}`,
        relativePath,
        name,
      });
    }

    emitProgress(options.onProgress, {
      phase: 'scanning',
      scannedDirectories,
      discoveredRepositories: repositories.length,
      currentPath: current.relativePath || current.name,
    });
  }

  emitProgress(options.onProgress, {
    phase: 'completed',
    scannedDirectories,
    discoveredRepositories: repositories.length,
    currentPath: null,
  });

  return {
    rootPathToken: options.rootPathToken,
    rootLabel: options.rootLabel,
    scannedAt: new Date().toISOString(),
    ignoredFolders,
    repositories,
  };
}