import { describe, expect, it } from 'vitest';
import {
  buildLocalSourceRootId,
  parseSourceIdentityFromStorage,
  serializeSourceIdentityForStorage,
} from '@/repository/source';
import { toRepositorySummaryFromGitHub } from '@/repository/types';

describe('repository source identity', () => {
  it('normalizes github identities for storage and parses back', () => {
    const serialized = serializeSourceIdentityForStorage({ kind: 'github', username: ' McFuzzySquirrel ' });

    expect(serialized).toBe('github:mcfuzzysquirrel');
    expect(parseSourceIdentityFromStorage(serialized)).toEqual({ kind: 'github', username: 'mcfuzzysquirrel' });
  });

  it('normalizes local root identifiers for storage and parses back', () => {
    const rootId = buildLocalSourceRootId(' /Work/Repos/MyTeam ');
    const serialized = serializeSourceIdentityForStorage({ kind: 'local', rootId });

    expect(rootId).toBe('/work/repos/myteam');
    expect(serialized).toBe('local:%2Fwork%2Frepos%2Fmyteam');
    expect(parseSourceIdentityFromStorage(serialized)).toEqual({ kind: 'local', rootId: '/work/repos/myteam' });
  });

  it('returns null for malformed serialized source identities', () => {
    expect(parseSourceIdentityFromStorage('')).toBeNull();
    expect(parseSourceIdentityFromStorage('github')).toBeNull();
    expect(parseSourceIdentityFromStorage('unknown:value')).toBeNull();
    expect(parseSourceIdentityFromStorage('github:%E0%A4%A')).toBeNull();
  });
});

describe('toRepositorySummaryFromGitHub', () => {
  it('builds a source-aware repository summary with deterministic id', () => {
    const summary = toRepositorySummaryFromGitHub(
      { kind: 'github', username: 'McFuzzySquirrel' },
      {
        id: 42,
        name: 'Repo-Dungeon',
        fullName: 'McFuzzySquirrel/Repo-Dungeon',
        ownerLogin: 'McFuzzySquirrel',
        description: 'Dungeon crawler',
        htmlUrl: 'https://github.com/McFuzzySquirrel/Repo-Dungeon',
        language: 'TypeScript',
        stargazersCount: 7,
        forksCount: 2,
        topics: ['game'],
        isPrivate: false,
        defaultBranch: 'main',
      },
    );

    expect(summary.repositoryId).toBe('mcfuzzysquirrel/repo-dungeon');
    expect(summary.source).toEqual({ kind: 'github', username: 'McFuzzySquirrel' });
    expect(summary.github.fullName).toBe('McFuzzySquirrel/Repo-Dungeon');
  });
});