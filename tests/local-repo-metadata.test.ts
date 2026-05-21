import { describe, expect, it } from 'vitest';
import {
  buildLocalRoomPresentationData,
  detectFilesystemSignals,
  deriveBasementNodesFromRelativePaths,
  inferPrimaryLanguage,
  isIgnoredFolderName,
  toNormalizedLocalRooms,
} from '@/localRepos/metadata';
import type { LocalRepoScanCandidate } from '@/localRepos/types';

describe('local repo metadata helpers', () => {
  it('matches required ignored folder list entries', () => {
    expect(isIgnoredFolderName('.git')).toBe(true);
    expect(isIgnoredFolderName('node_modules')).toBe(true);
    expect(isIgnoredFolderName('dist')).toBe(true);
    expect(isIgnoredFolderName('build')).toBe(true);
    expect(isIgnoredFolderName('.next')).toBe(true);
    expect(isIgnoredFolderName('coverage')).toBe(true);
    expect(isIgnoredFolderName('src')).toBe(false);
  });

  it('detects common project files and infers primary language', () => {
    const signals = detectFilesystemSignals(['README.md', 'LICENSE', 'package.json', 'tsconfig.json']);

    expect(signals.hasReadme).toBe(true);
    expect(signals.hasLicense).toBe(true);
    expect(signals.hasPackageJson).toBe(true);
    expect(inferPrimaryLanguage({ TypeScript: 8, JavaScript: 2 })).toBe('TypeScript');
  });

  it('normalizes local repositories into source-aware summary and dungeon-compatible room data', () => {
    const candidate: LocalRepoScanCandidate = {
      rootPathToken: 'electron://root',
      rootLabel: 'workspace',
      absolutePath: '/tmp/workspace/repo-a',
      relativePath: 'repo-a',
      relativeDirectoryPaths: ['src', 'src/components'],
      name: 'repo-a',
      discoveredAt: new Date().toISOString(),
      fileCount: 10,
      directoryCount: 4,
      topLevelTree: [
        { path: 'README.md', type: 'file' },
        { path: 'src', type: 'dir' },
      ],
      readmePreview: {
        fileName: 'README.md',
        plainText: 'Preview',
        truncated: false,
      },
      languageBreakdown: { TypeScript: 6, JavaScript: 1 },
      filesystem: {
        hasReadme: true,
        hasLicense: true,
        hasPackageJson: true,
        hasTsConfig: true,
        hasPyProject: false,
      },
      git: {
        available: true,
        branch: 'main',
        remotes: ['origin\thttps://github.com/org/repo-a.git (fetch)'],
        commitCount: 40,
        lastCommitAt: '2026-05-21T00:00:00Z',
        isDirty: false,
        contributorCount: 2,
        unavailableReason: null,
      },
    };

    const [normalized] = toNormalizedLocalRooms([candidate]);
    expect(normalized.repository.source.kind).toBe('local');
    expect(normalized.repository.local.relativePath).toBe('repo-a');
    expect(normalized.asDungeonRoom.name).toBe('repo-a');
    expect(normalized.asDungeonRoom.topics).toContain('local');
  });

  it('derives basement nodes while excluding ignored and unsafe subdirectory paths', () => {
    const candidate: Pick<LocalRepoScanCandidate, 'rootPathToken' | 'relativePath'> = {
      rootPathToken: 'electron://root-token',
      relativePath: 'repo-a',
    };

    const basementNodes = deriveBasementNodesFromRelativePaths(candidate, [
      'src',
      'src/components',
      'node_modules/cache',
      '../secrets',
      '/abs/path',
      'build/output',
    ]);

    expect(basementNodes.map((node) => node.pathToken)).toEqual(['src', 'src/components']);
    expect(basementNodes[0]).toMatchObject({
      pathToken: 'src',
      depth: 1,
      parentPathToken: '',
    });
  });

  it('builds room presentation data with token-based launch action contracts', () => {
    const candidate: Pick<LocalRepoScanCandidate, 'rootPathToken' | 'relativePath'> = {
      rootPathToken: 'electron://root-token',
      relativePath: 'repo-a',
    };

    const presentation = buildLocalRoomPresentationData(candidate, ['src', '.next/cache']);
    expect(presentation).not.toBeNull();

    expect(presentation?.actions.openRepositoryInSystemDefault).toEqual({
      rootPathToken: 'electron://root-token',
      repositoryPathToken: 'repo-a',
      targetPathToken: '',
    });
    expect(presentation?.basementNodes.map((node) => node.pathToken)).toEqual(['src']);
  });
});