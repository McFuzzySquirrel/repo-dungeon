import type { GitHubRepoSummary } from '@/github/types';
import { buildLocalSourceRootId } from '@/repository/source';
import type { LocalRepositorySummary } from '@/repository/types';
import type {
  LocalBasementNode,
  LocalFilesystemSignals,
  LocalRoomPresentationData,
  LocalRepoNormalizedRoom,
  LocalRepoScanCandidate,
} from '@/localRepos/types';
import { getLocalPathTokenParent, sanitizeLocalPathToken, splitLocalPathToken } from '@/localRepos/pathTokens';
import { DEFAULT_IGNORED_FOLDERS } from '@/localRepos/types';

const README_NAMES = new Set(['readme', 'readme.md', 'readme.txt', 'readme.rst']);
const LICENSE_NAMES = new Set(['license', 'license.md', 'copying']);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  kt: 'Kotlin',
  c: 'C',
  cc: 'C++',
  cpp: 'C++',
  h: 'C',
  cs: 'C#',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  scala: 'Scala',
  sh: 'Shell',
  zsh: 'Shell',
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function safePathToken(value: string): string {
  return value.replace(/\\+/gu, '/').replace(/\/+/gu, '/');
}

export function isIgnoredFolderName(name: string, ignoredFolders: readonly string[] = DEFAULT_IGNORED_FOLDERS): boolean {
  const normalized = normalizeName(name);
  return ignoredFolders.some((entry) => normalizeName(entry) === normalized);
}

export function detectFilesystemSignals(fileNames: readonly string[]): LocalFilesystemSignals {
  const normalized = fileNames.map((value) => normalizeName(value));
  const lookup = new Set(normalized);

  return {
    hasReadme: normalized.some((value) => README_NAMES.has(value)),
    hasLicense: normalized.some((value) => LICENSE_NAMES.has(value)),
    hasPackageJson: lookup.has('package.json'),
    hasTsConfig: normalized.some((value) => value === 'tsconfig.json' || value.startsWith('tsconfig.')),
    hasPyProject: lookup.has('pyproject.toml') || lookup.has('requirements.txt'),
  };
}

export function addLanguageFromFileName(
  fileName: string,
  languageBreakdown: Record<string, number>,
): void {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return;
  }

  const extension = parts.at(-1)?.toLowerCase() ?? '';
  const language = EXTENSION_LANGUAGE_MAP[extension];
  if (!language) {
    return;
  }
  languageBreakdown[language] = (languageBreakdown[language] ?? 0) + 1;
}

export function inferPrimaryLanguage(languageBreakdown: Record<string, number>): string | null {
  const entries = Object.entries(languageBreakdown);
  if (entries.length === 0) {
    return null;
  }

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

export function toLocalRepositorySummary(candidate: LocalRepoScanCandidate): LocalRepositorySummary {
  const rootId = buildLocalSourceRootId(candidate.rootPathToken);
  const relativePath = safePathToken(candidate.relativePath);
  const repositoryId = `${rootId}:${relativePath || '.'}`;
  const primaryLanguage = inferPrimaryLanguage(candidate.languageBreakdown);

  return {
    source: {
      kind: 'local',
      rootId,
    },
    repositoryId,
    name: candidate.name,
    fullName: `${candidate.rootLabel}/${relativePath || candidate.name}`,
    description: candidate.filesystem.hasReadme
      ? 'Local repository with README'
      : 'Local repository',
    primaryLanguage,
    defaultBranch: candidate.git.branch,
    local: {
      relativePath,
      sourceLabel: candidate.rootLabel,
      remotes: candidate.git.remotes,
    },
  };
}

export function toDungeonRoomRepoSummary(
  candidate: LocalRepoScanCandidate,
  indexSeed = 0,
): GitHubRepoSummary {
  const roomIdSeed = `${candidate.rootPathToken}:${candidate.relativePath}:${indexSeed}`;
  let hash = 0;
  for (let index = 0; index < roomIdSeed.length; index += 1) {
    hash = (hash * 31 + roomIdSeed.charCodeAt(index)) | 0;
  }
  const syntheticId = Math.abs(hash) || indexSeed + 1;

  const primaryLanguage = inferPrimaryLanguage(candidate.languageBreakdown);
  return {
    id: syntheticId,
    name: candidate.name,
    fullName: `${candidate.rootLabel}/${candidate.relativePath || candidate.name}`,
    ownerLogin: candidate.rootLabel,
    description: `Local repository at ${candidate.relativePath || '.'}`,
    htmlUrl: `file://${candidate.absolutePath}`,
    language: primaryLanguage,
    stargazersCount: 0,
    forksCount: 0,
    topics: ['local'],
    isPrivate: true,
    defaultBranch: candidate.git.branch ?? 'HEAD',
  };
}

export function toNormalizedLocalRooms(candidates: readonly LocalRepoScanCandidate[]): LocalRepoNormalizedRoom[] {
  return candidates.map((candidate, index) => ({
    repository: toLocalRepositorySummary(candidate),
    asDungeonRoom: toDungeonRoomRepoSummary(candidate, index),
  }));
}

function shouldIncludeBasementPath(
  pathToken: string,
  ignoredFolders: readonly string[] = DEFAULT_IGNORED_FOLDERS,
): boolean {
  const segments = splitLocalPathToken(pathToken);
  if (segments.length === 0) {
    return false;
  }

  return segments.every((segment) => !isIgnoredFolderName(segment, ignoredFolders));
}

export function deriveBasementNodesFromRelativePaths(
  candidate: Pick<LocalRepoScanCandidate, 'rootPathToken' | 'relativePath'>,
  relativeDirectoryPaths: readonly string[],
  ignoredFolders: readonly string[] = DEFAULT_IGNORED_FOLDERS,
): LocalBasementNode[] {
  const repositoryPathToken = sanitizeLocalPathToken(candidate.relativePath);
  if (repositoryPathToken === null) {
    return [];
  }

  const uniquePaths = new Set<string>();
  for (const pathEntry of relativeDirectoryPaths) {
    const sanitized = sanitizeLocalPathToken(pathEntry);
    if (sanitized === null || sanitized.length === 0) {
      continue;
    }
    if (!shouldIncludeBasementPath(sanitized, ignoredFolders)) {
      continue;
    }
    uniquePaths.add(sanitized);
  }

  return Array.from(uniquePaths)
    .sort((left, right) => left.localeCompare(right))
    .map((pathToken) => {
      const segments = splitLocalPathToken(pathToken);
      const name = segments.at(-1) ?? pathToken;
      const parentPathToken = getLocalPathTokenParent(pathToken);

      return {
        pathToken,
        name,
        depth: segments.length,
        parentPathToken,
        openInSystemDefault: {
          rootPathToken: candidate.rootPathToken,
          repositoryPathToken,
          targetPathToken: pathToken,
        },
      };
    });
}

export function buildLocalRoomPresentationData(
  candidate: Pick<LocalRepoScanCandidate, 'rootPathToken' | 'relativePath'>,
  relativeDirectoryPaths: readonly string[],
  ignoredFolders: readonly string[] = DEFAULT_IGNORED_FOLDERS,
): LocalRoomPresentationData | null {
  const repositoryPathToken = sanitizeLocalPathToken(candidate.relativePath);
  if (repositoryPathToken === null) {
    return null;
  }

  return {
    repositoryPathToken,
    actions: {
      openRepositoryInSystemDefault: {
        rootPathToken: candidate.rootPathToken,
        repositoryPathToken,
        targetPathToken: '',
      },
      openRepositoryInPreferredEditor: {
        rootPathToken: candidate.rootPathToken,
        repositoryPathToken,
        targetPathToken: '',
      },
    },
    basementNodes: deriveBasementNodesFromRelativePaths(candidate, relativeDirectoryPaths, ignoredFolders),
  };
}