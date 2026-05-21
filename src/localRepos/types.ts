import type { GitHubRepoSummary } from '@/github/types';
import type { LocalRepositorySummary } from '@/repository/types';

export const DEFAULT_IGNORED_FOLDERS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
] as const;

export type LocalIgnoredFolder = (typeof DEFAULT_IGNORED_FOLDERS)[number];

export interface LocalSourceSelection {
  rootPathToken: string;
  rootLabel: string;
  rootId: string;
  pickedAt: string;
}

export interface LocalScanProgress {
  phase: 'idle' | 'scanning' | 'completed' | 'error';
  scannedDirectories: number;
  discoveredRepositories: number;
  currentPath: string | null;
  message?: string;
}

export interface LocalFilesystemSignals {
  hasReadme: boolean;
  hasLicense: boolean;
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  hasPyProject: boolean;
}

export interface LocalGitMetadata {
  available: boolean;
  branch: string | null;
  remotes: string[];
  commitCount: number | null;
  lastCommitAt: string | null;
  isDirty: boolean | null;
  contributorCount: number | null;
  unavailableReason: string | null;
}

export interface LocalReadmePreview {
  fileName: string;
  plainText: string;
  truncated: boolean;
}

export interface LocalReadmeLoadRequest {
  rootPathToken: string;
  repositoryPathToken: LocalPathToken;
  maxChars?: number;
}

export interface LocalReadmeLoadResult {
  readme: LocalReadmePreview | null;
  unavailableReason: string | null;
}

export interface LocalTopLevelTreeEntry {
  path: string;
  type: 'file' | 'dir';
}

export interface LocalRepoScanCandidate {
  rootPathToken: string;
  rootLabel: string;
  absolutePath: string;
  relativePath: string;
  relativeDirectoryPaths: string[];
  name: string;
  discoveredAt: string;
  fileCount: number;
  directoryCount: number;
  topLevelTree: LocalTopLevelTreeEntry[];
  readmePreview: LocalReadmePreview | null;
  languageBreakdown: Record<string, number>;
  filesystem: LocalFilesystemSignals;
  git: LocalGitMetadata;
}

export interface LocalRepoScanResult {
  rootPathToken: string;
  rootLabel: string;
  scannedAt: string;
  ignoredFolders: string[];
  repositories: LocalRepoScanCandidate[];
}

export interface LocalScanCacheSnapshot {
  schemaVersion: 1;
  source: LocalSourceSelection;
  scan: LocalRepoScanResult;
  cachedAt: string;
}

export interface LocalFolderPickResult {
  rootPathToken: string;
  rootLabel: string;
  canPersist: boolean;
}

export interface LocalRepoAccessApi {
  pickParentFolder: () => Promise<LocalFolderPickResult | null>;
  scanParentFolder: (
    rootPathToken: string,
    options?: {
      ignoredFolders?: string[];
      includeGitMetadata?: boolean;
      onProgress?: (progress: LocalScanProgress) => void;
    },
  ) => Promise<LocalRepoScanResult>;
  openPath: (request: LocalRoomLaunchRequest) => Promise<LocalRoomLaunchResult>;
  loadReadme: (request: LocalReadmeLoadRequest) => Promise<LocalReadmeLoadResult>;
}

export interface LocalRepoNormalizedRoom {
  repository: LocalRepositorySummary;
  asDungeonRoom: GitHubRepoSummary;
}

export type LocalRoomLaunchMode = 'system-default' | 'preferred-editor';

export interface LocalPreferredEditorConfig {
  command: string;
  args?: string[];
}

/**
 * Opaque, sanitized repository-relative token (no leading slash and no `..` segments).
 */
export type LocalPathToken = string;

export interface LocalRoomLaunchRequest {
  rootPathToken: string;
  repositoryPathToken: LocalPathToken;
  targetPathToken?: LocalPathToken;
  mode: LocalRoomLaunchMode;
  preferredEditor?: LocalPreferredEditorConfig | null;
}

export interface LocalRoomLaunchResult {
  ok: boolean;
  mode: LocalRoomLaunchMode;
  fallbackUsed: boolean;
  message: string | null;
}

export interface LocalBasementNode {
  pathToken: LocalPathToken;
  name: string;
  depth: number;
  parentPathToken: LocalPathToken | null;
  openInSystemDefault: Pick<
    LocalRoomLaunchRequest,
    'rootPathToken' | 'repositoryPathToken' | 'targetPathToken'
  >;
}

export interface LocalRoomActionContracts {
  openRepositoryInSystemDefault: Pick<
    LocalRoomLaunchRequest,
    'rootPathToken' | 'repositoryPathToken' | 'targetPathToken'
  >;
  openRepositoryInPreferredEditor: Pick<
    LocalRoomLaunchRequest,
    'rootPathToken' | 'repositoryPathToken' | 'targetPathToken'
  >;
}

export interface LocalRoomPresentationData {
  repositoryPathToken: LocalPathToken;
  actions: LocalRoomActionContracts;
  basementNodes: LocalBasementNode[];
}