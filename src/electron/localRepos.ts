import { dialog, ipcMain, shell } from 'electron';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  resolvePathWithinBase,
  sanitizePreferredEditorConfig,
} from './localRepoPaths.js';

interface LocalRepoScanProgress {
  phase: 'idle' | 'scanning' | 'completed' | 'error';
  scannedDirectories: number;
  discoveredRepositories: number;
  currentPath: string | null;
  message?: string;
}

interface LocalGitMetadata {
  available: boolean;
  branch: string | null;
  remotes: string[];
  commitCount: number | null;
  lastCommitAt: string | null;
  isDirty: boolean | null;
  contributorCount: number | null;
  contributors: LocalGitContributor[];
  unavailableReason: string | null;
}

interface LocalGitContributor {
  name: string;
  email: string | null;
  commitCount: number;
}

interface LocalRepoScanCandidate {
  rootPathToken: string;
  rootLabel: string;
  absolutePath: string;
  relativePath: string;
  relativeDirectoryPaths: string[];
  name: string;
  discoveredAt: string;
  fileCount: number;
  directoryCount: number;
  topLevelTree: Array<{ path: string; type: 'file' | 'dir' }>;
  readmePreview: {
    fileName: string;
    plainText: string;
    truncated: boolean;
  } | null;
  languageBreakdown: Record<string, number>;
  filesystem: {
    hasReadme: boolean;
    hasLicense: boolean;
    hasPackageJson: boolean;
    hasTsConfig: boolean;
    hasPyProject: boolean;
  };
  git: LocalGitMetadata;
}

interface LocalRepoScanResult {
  rootPathToken: string;
  rootLabel: string;
  scannedAt: string;
  ignoredFolders: string[];
  repositories: LocalRepoScanCandidate[];
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

const execFileAsync = promisify(execFile);

const DEFAULT_IGNORED_FOLDERS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);

const selectedRootByToken = new Map<string, string>();
const ELECTRON_ROOT_TOKEN_PREFIX = 'electron://';

function normalizeForToken(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decodeRootPathFromToken(rootPathToken: string): string | null {
  if (!rootPathToken.startsWith(ELECTRON_ROOT_TOKEN_PREFIX)) {
    return null;
  }

  const encoded = rootPathToken.slice(ELECTRON_ROOT_TOKEN_PREFIX.length);
  if (!encoded) {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8').trim();
    if (!decoded || !path.isAbsolute(decoded)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

async function resolveRootPathFromToken(rootPathToken: string): Promise<string | null> {
  const cached = selectedRootByToken.get(rootPathToken);
  if (cached) {
    return cached;
  }

  const decoded = decodeRootPathFromToken(rootPathToken);
  if (!decoded) {
    return null;
  }

  try {
    const stat = await fs.stat(decoded);
    if (!stat.isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }

  selectedRootByToken.set(rootPathToken, decoded);
  return decoded;
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/');
}

function sanitizeRelativePathToken(value: string): string | null {
  const normalized = normalizeRelativePath(value).trim();
  if (normalized.includes('\0')) {
    return null;
  }
  if (normalized.length === 0 || normalized === '.') {
    return '';
  }
  if (normalized.startsWith('/')) {
    return null;
  }

  const cleanSegments: string[] = [];
  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      return null;
    }
    cleanSegments.push(segment);
  }

  return cleanSegments.join('/');
}

function isIgnoredFolderName(name: string, ignoredFolders: readonly string[]): boolean {
  const normalized = name.trim().toLowerCase();
  return ignoredFolders.some((entry) => entry.trim().toLowerCase() === normalized);
}

function buildNoGitMetadata(reason: string): LocalGitMetadata {
  return {
    available: false,
    branch: null,
    remotes: [],
    commitCount: null,
    lastCommitAt: null,
    isDirty: null,
    contributorCount: null,
    contributors: [],
    unavailableReason: reason,
  };
}

function parseContributors(raw: string): LocalGitContributor[] {
  const contributors: LocalGitContributor[] = [];
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(.+?)(?:\s+<([^>]+)>)?$/u);
    if (!match) {
      continue;
    }

    const commitCount = Number.parseInt(match[1] ?? '', 10);
    if (!Number.isFinite(commitCount)) {
      continue;
    }

    contributors.push({
      commitCount,
      name: match[2]?.trim() ?? 'Unknown',
      email: match[3]?.trim() ?? null,
    });
  }
  return contributors;
}

async function isGitCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function settleGitCommand<T>(command: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await command();
  } catch {
    return fallback;
  }
}

async function readGitMetadata(repoPath: string, isAvailable: boolean): Promise<LocalGitMetadata> {
  if (!isAvailable) {
    return buildNoGitMetadata('git CLI is not available on this machine.');
  }

  const branch = await settleGitCommand(async () => {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath });
    return stdout.trim() || null;
  }, null as string | null);

  const remotes = await settleGitCommand(async () => {
    const { stdout } = await execFileAsync('git', ['remote', '-v'], { cwd: repoPath });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [] as string[]);

  const commitCount = await settleGitCommand(async () => {
    const { stdout } = await execFileAsync('git', ['rev-list', '--count', 'HEAD'], { cwd: repoPath });
    const parsed = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, null as number | null);

  const lastCommitAt = await settleGitCommand(async () => {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI'], { cwd: repoPath });
    return stdout.trim() || null;
  }, null as string | null);

  const isDirty = await settleGitCommand(async () => {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: repoPath });
    return stdout.trim().length > 0;
  }, null as boolean | null);

  const contributorsRaw = await settleGitCommand(async () => {
    const { stdout } = await execFileAsync('git', ['shortlog', '-s', '-n', '-e', '--all'], { cwd: repoPath });
    return stdout;
  }, null as string | null);
  const contributors = contributorsRaw ? parseContributors(contributorsRaw) : [];

  return {
    available: true,
    branch,
    remotes,
    commitCount,
    lastCommitAt,
    isDirty,
    contributorCount: contributorsRaw === null ? null : contributors.length,
    contributors,
    unavailableReason: null,
  };
}

async function listDirectoryEntries(directoryPath: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
}

function addLanguageFromFileName(fileName: string, languageBreakdown: Record<string, number>): void {
  const extension = path.extname(fileName).replace('.', '').toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    rs: 'Rust',
    go: 'Go',
    java: 'Java',
    c: 'C',
    cc: 'C++',
    cpp: 'C++',
    cs: 'C#',
    rb: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin',
  };

  const language = languageMap[extension];
  if (!language) {
    return;
  }
  languageBreakdown[language] = (languageBreakdown[language] ?? 0) + 1;
}

function isReadmeFileName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === 'readme' || normalized.startsWith('readme.');
}

async function readElectronReadmePreview(repoPath: string, fileName: string): Promise<{
  fileName: string;
  plainText: string;
  truncated: boolean;
} | null> {
  try {
    const content = await fs.readFile(path.join(repoPath, fileName), { encoding: 'utf-8' });
    const maxChars = 2000;
    return {
      fileName,
      plainText: content.substring(0, maxChars),
      truncated: content.length > maxChars,
    };
  } catch {
    return null;
  }
}

async function readReadmeFromRepository(
  repoPath: string,
  maxChars?: number,
): Promise<LocalReadmeLoadResult> {
  const entries = await listDirectoryEntries(repoPath);
  const readmeEntry = entries.find((entry) => !entry.isDirectory && isReadmeFileName(entry.name));

  if (!readmeEntry) {
    return {
      readme: null,
      unavailableReason: 'No README found in repository root.',
    };
  }

  try {
    const content = await fs.readFile(path.join(repoPath, readmeEntry.name), { encoding: 'utf-8' });
    if (typeof maxChars === 'number' && Number.isFinite(maxChars) && maxChars > 0) {
      return {
        readme: {
          fileName: readmeEntry.name,
          plainText: content.substring(0, maxChars),
          truncated: content.length > maxChars,
        },
        unavailableReason: null,
      };
    }

    return {
      readme: {
        fileName: readmeEntry.name,
        plainText: content,
        truncated: false,
      },
      unavailableReason: null,
    };
  } catch {
    return {
      readme: null,
      unavailableReason: 'Unable to read README from disk.',
    };
  }
}

async function collectRepoSummary(
  rootPath: string,
  repoPath: string,
  rootPathToken: string,
  rootLabel: string,
  includeGitMetadata: boolean,
  gitAvailable: boolean,
  ignoredFolders: readonly string[],
): Promise<LocalRepoScanCandidate> {
  const fileNames: string[] = [];
  const languageBreakdown: Record<string, number> = {};
  const relativeDirectoryPaths: string[] = [];
  const topLevelTree: LocalRepoScanCandidate['topLevelTree'] = [];
  let readmePreview: LocalRepoScanCandidate['readmePreview'] = null;
  let fileCount = 0;
  let directoryCount = 0;

  const topLevel = await listDirectoryEntries(repoPath);
  for (const entry of topLevel) {
    if (entry.isDirectory) {
      directoryCount += 1;
      topLevelTree.push({ path: entry.name, type: 'dir' });
      continue;
    }
    fileCount += 1;
    fileNames.push(entry.name);
    addLanguageFromFileName(entry.name, languageBreakdown);
    topLevelTree.push({ path: entry.name, type: 'file' });
    if (!readmePreview && isReadmeFileName(entry.name)) {
      readmePreview = await readElectronReadmePreview(repoPath, entry.name);
    }
  }

  const directoryQueue: Array<{ absolutePath: string; relativePath: string }> = [{
    absolutePath: repoPath,
    relativePath: '',
  }];

  while (directoryQueue.length > 0) {
    const current = directoryQueue.shift();
    if (!current) {
      break;
    }

    const entries = await listDirectoryEntries(current.absolutePath);
    for (const entry of entries) {
      if (!entry.isDirectory) {
        continue;
      }
      if (isIgnoredFolderName(entry.name, ignoredFolders)) {
        continue;
      }

      const childAbsolutePath = path.join(current.absolutePath, entry.name);
      const rawRelativePath = current.relativePath
        ? `${current.relativePath}/${entry.name}`
        : entry.name;
      const sanitizedRelativePath = sanitizeRelativePathToken(rawRelativePath);
      if (sanitizedRelativePath === null || sanitizedRelativePath.length === 0) {
        continue;
      }

      const isNestedRepo = await isGitRepositoryDirectory(childAbsolutePath);
      if (isNestedRepo) {
        continue;
      }

      relativeDirectoryPaths.push(sanitizedRelativePath);
      directoryQueue.push({
        absolutePath: childAbsolutePath,
        relativePath: sanitizedRelativePath,
      });
    }
  }

  const normalizedNames = new Set(fileNames.map((value) => value.toLowerCase()));
  const git = includeGitMetadata
    ? await readGitMetadata(repoPath, gitAvailable)
    : buildNoGitMetadata('git metadata extraction disabled for this scan.');
  const relativePath = normalizeRelativePath(path.relative(rootPath, repoPath));

  return {
    rootPathToken,
    rootLabel,
    absolutePath: repoPath,
    relativePath,
    relativeDirectoryPaths,
    name: path.basename(repoPath),
    discoveredAt: new Date().toISOString(),
    fileCount,
    directoryCount,
    topLevelTree,
    readmePreview,
    languageBreakdown,
    filesystem: {
      hasReadme: Array.from(normalizedNames).some((name) => name === 'readme' || name.startsWith('readme.')),
      hasLicense: Array.from(normalizedNames).some((name) => name === 'license' || name === 'copying' || name.startsWith('license.')),
      hasPackageJson: normalizedNames.has('package.json'),
      hasTsConfig: Array.from(normalizedNames).some((name) => name === 'tsconfig.json' || name.startsWith('tsconfig.')),
      hasPyProject: normalizedNames.has('pyproject.toml') || normalizedNames.has('requirements.txt'),
    },
    git,
  };
}

async function isGitRepositoryDirectory(candidatePath: string): Promise<boolean> {
  try {
    const gitDirectory = path.join(candidatePath, '.git');
    const stats = await fs.stat(gitDirectory);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

interface ScanOptions {
  rootPathToken: string;
  rootPath: string;
  rootLabel: string;
  ignoredFolders: string[];
  includeGitMetadata: boolean;
  onProgress: (progress: LocalRepoScanProgress) => void;
}

async function scanForRepositories(options: ScanOptions): Promise<LocalRepoScanResult> {
  const repositories: LocalRepoScanCandidate[] = [];
  const gitAvailable = options.includeGitMetadata ? await isGitCliAvailable() : false;
  let scannedDirectories = 0;

  const queue: string[] = [options.rootPath];

  options.onProgress({
    phase: 'scanning',
    scannedDirectories: 0,
    discoveredRepositories: 0,
    currentPath: options.rootLabel,
    message: 'Scanning selected folder for git repositories...',
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    scannedDirectories += 1;
    const relative = normalizeRelativePath(path.relative(options.rootPath, current));

    const isRepo = await isGitRepositoryDirectory(current);
    if (isRepo) {
      const summary = await collectRepoSummary(
        options.rootPath,
        current,
        options.rootPathToken,
        options.rootLabel,
        options.includeGitMetadata,
        gitAvailable,
        options.ignoredFolders,
      );
      repositories.push(summary);

      options.onProgress({
        phase: 'scanning',
        scannedDirectories,
        discoveredRepositories: repositories.length,
        currentPath: relative || summary.name,
        message: `Discovered repository ${summary.name}`,
      });
    }

    const shouldTraverseChildren = !isRepo || relative.length === 0;
    if (!shouldTraverseChildren) {
      continue;
    }

    const children = await listDirectoryEntries(current);
    for (const child of children) {
      if (!child.isDirectory) {
        continue;
      }

      if (isIgnoredFolderName(child.name, options.ignoredFolders)) {
        continue;
      }

      queue.push(path.join(current, child.name));
    }

    options.onProgress({
      phase: 'scanning',
      scannedDirectories,
      discoveredRepositories: repositories.length,
      currentPath: relative || '.',
    });
  }

  options.onProgress({
    phase: 'completed',
    scannedDirectories,
    discoveredRepositories: repositories.length,
    currentPath: null,
  });

  return {
    rootPathToken: options.rootPathToken,
    rootLabel: options.rootLabel,
    scannedAt: new Date().toISOString(),
    ignoredFolders: options.ignoredFolders,
    repositories,
  };
}

async function resolveLaunchPath(request: LocalRoomLaunchRequest): Promise<{ repositoryPath: string; targetPath: string } | null> {
  const rootPath = await resolveRootPathFromToken(request.rootPathToken);
  if (!rootPath) {
    return null;
  }

  const repositoryPath = resolvePathWithinBase(rootPath, request.repositoryPathToken);
  if (!repositoryPath) {
    return null;
  }

  const targetPath = resolvePathWithinBase(repositoryPath, request.targetPathToken ?? '');
  if (!targetPath) {
    return null;
  }

  return {
    repositoryPath,
    targetPath,
  };
}

async function launchWithSystemDefault(targetPath: string): Promise<string | null> {
  const openError = await shell.openPath(targetPath);
  return openError.trim().length > 0 ? openError : null;
}

async function launchWithPreferredEditor(editor: LocalPreferredEditorConfig, targetPath: string): Promise<string | null> {
  try {
    await execFileAsync(editor.command, [...(editor.args ?? []), targetPath]);
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return 'Preferred editor command failed.';
  }
}

export function registerLocalRepoHandlers(): void {
  ipcMain.handle('local-repos:pick-parent-folder', async () => {
    const selected = await dialog.showOpenDialog({
      properties: ['openDirectory', 'dontAddToRecent'],
      title: 'Select parent folder to scan for repositories',
    });

    if (selected.canceled || selected.filePaths.length === 0) {
      return null;
    }

    const selectedPath = selected.filePaths[0] ?? '';
    const rootLabel = path.basename(selectedPath);
    const rootPathToken = `electron://${normalizeForToken(selectedPath)}`;
    selectedRootByToken.set(rootPathToken, selectedPath);

    return {
      rootPathToken,
      rootLabel,
      canPersist: true,
    };
  });

  ipcMain.handle(
    'local-repos:scan-parent-folder',
    async (
      event,
      rootPathToken: string,
      options?: {
        ignoredFolders?: string[];
        includeGitMetadata?: boolean;
        progressToken?: string;
      },
    ) => {
      const rootPath = await resolveRootPathFromToken(rootPathToken);
      if (!rootPath) {
        throw new Error('Selected root folder is not available. Pick a folder again before scanning.');
      }

      const ignoredFolders = options?.ignoredFolders?.length
        ? options.ignoredFolders
        : Array.from(DEFAULT_IGNORED_FOLDERS);
      const progressToken = options?.progressToken ?? 'default';
      const rootLabel = path.basename(rootPath);

      return scanForRepositories({
        rootPathToken,
        rootPath,
        rootLabel,
        ignoredFolders,
        includeGitMetadata: options?.includeGitMetadata ?? true,
        onProgress: (progress) => {
          event.sender.send('local-repos:scan-progress', {
            progressToken,
            progress,
          });
        },
      });
    },
  );

  ipcMain.handle('local-repos:open-path', async (_event, request: LocalRoomLaunchRequest): Promise<LocalRoomLaunchResult> => {
    const resolved = await resolveLaunchPath(request);
    if (!resolved) {
      return {
        ok: false,
        mode: request.mode,
        fallbackUsed: false,
        message: 'Invalid launch target. Re-scan the selected folder and try again.',
      };
    }

    if (request.mode === 'preferred-editor') {
      const preferredEditor = sanitizePreferredEditorConfig(request.preferredEditor);
      if (preferredEditor) {
        const editorError = await launchWithPreferredEditor(preferredEditor, resolved.targetPath);
        if (!editorError) {
          return {
            ok: true,
            mode: request.mode,
            fallbackUsed: false,
            message: null,
          };
        }

        const fallbackError = await launchWithSystemDefault(resolved.targetPath);
        if (!fallbackError) {
          return {
            ok: true,
            mode: request.mode,
            fallbackUsed: true,
            message: `Preferred editor failed: ${editorError}. Opened with system default app instead.`,
          };
        }

        return {
          ok: false,
          mode: request.mode,
          fallbackUsed: true,
          message: `Preferred editor failed: ${editorError}. System default open also failed: ${fallbackError}`,
        };
      }
    }

    const openError = await launchWithSystemDefault(resolved.targetPath);
    if (openError) {
      return {
        ok: false,
        mode: request.mode,
        fallbackUsed: false,
        message: openError,
      };
    }

    return {
      ok: true,
      mode: request.mode,
      fallbackUsed: false,
      message: null,
    };
  });

  ipcMain.handle('local-repos:load-readme', async (_event, request: LocalReadmeLoadRequest): Promise<LocalReadmeLoadResult> => {
    const rootPath = await resolveRootPathFromToken(request.rootPathToken);
    if (!rootPath) {
      return {
        readme: null,
        unavailableReason: 'Selected root folder is unavailable. Re-scan and try again.',
      };
    }

    const repoPath = resolvePathWithinBase(rootPath, request.repositoryPathToken);
    if (!repoPath) {
      return {
        readme: null,
        unavailableReason: 'Invalid repository path token for README loading.',
      };
    }

    return readReadmeFromRepository(repoPath, request.maxChars);
  });
}