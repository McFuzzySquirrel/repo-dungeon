import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCachedRepoList,
  isRepoListFresh,
  isRoomDetailFresh,
  loadCachedRepoList,
  loadCachedRoomDetail,
  saveCachedRepoList,
  saveCachedRoomDetail,
} from '@/github/cache';
import type { GitHubRepoSummary, GitHubRoomData } from '@/github/types';

function makeRepo(index: number): GitHubRepoSummary {
  return {
    id: index,
    name: `repo-${index}`,
    fullName: `octocat/repo-${index}`,
    ownerLogin: 'octocat',
    description: null,
    htmlUrl: `https://github.com/octocat/repo-${index}`,
    language: 'TypeScript',
    stargazersCount: index,
    forksCount: 0,
    topics: [],
    isPrivate: false,
    defaultBranch: 'main',
  };
}

function makeRoomData(_repoName: string): GitHubRoomData {
  return {
    repo: makeRepo(1) as unknown as GitHubRoomData['repo'],
    readme: { plainText: '# Hello', truncated: false },
    languages: { TypeScript: 100 },
    topLevelTree: [{ path: 'src', type: 'tree' }],
    treeTruncated: false,
    contributors: [],
    unavailable: [],
  };
}

describe('GitHub persistent cache — repo list', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is cached', () => {
    expect(loadCachedRepoList('octocat')).toBeNull();
  });

  it('saves and reloads a repo list', () => {
    const repos = [makeRepo(1), makeRepo(2)];
    saveCachedRepoList('octocat', repos);
    const snapshot = loadCachedRepoList('octocat');
    expect(snapshot).not.toBeNull();
    expect(snapshot!.repos).toHaveLength(2);
    expect(snapshot!.repos[0].name).toBe('repo-1');
  });

  it('normalises username to lower case', () => {
    const repos = [makeRepo(1)];
    saveCachedRepoList('McFuzzySquirrel', repos);
    const snapshot = loadCachedRepoList('mcfuzzysquirrel');
    expect(snapshot).not.toBeNull();
    expect(snapshot!.repos).toHaveLength(1);
  });

  it('marks a just-saved snapshot as fresh', () => {
    saveCachedRepoList('octocat', [makeRepo(1)]);
    const snapshot = loadCachedRepoList('octocat')!;
    expect(isRepoListFresh(snapshot)).toBe(true);
  });

  it('marks an expired snapshot as stale', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString();
    localStorage.setItem(
      'repo-dungeon:v1:dungeon:octocat',
      JSON.stringify({
        schemaVersion: 1,
        username: 'octocat',
        fetchedAt: twentyFiveHoursAgo,
        repos: [makeRepo(1)],
      }),
    );
    const snapshot = loadCachedRepoList('octocat')!;
    expect(isRepoListFresh(snapshot)).toBe(false);
  });

  it('returns null for an unknown schema version', () => {
    localStorage.setItem(
      'repo-dungeon:v1:dungeon:octocat',
      JSON.stringify({ schemaVersion: 99, repos: [] }),
    );
    expect(loadCachedRepoList('octocat')).toBeNull();
  });

  it('returns null when stored JSON is corrupt', () => {
    localStorage.setItem('repo-dungeon:v1:dungeon:octocat', '{not-valid-json');
    expect(loadCachedRepoList('octocat')).toBeNull();
  });

  it('clearCachedRepoList removes the stored entry', () => {
    saveCachedRepoList('octocat', [makeRepo(1)]);
    clearCachedRepoList('octocat');
    expect(loadCachedRepoList('octocat')).toBeNull();
  });
});

describe('GitHub persistent cache — room details', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is cached', () => {
    expect(loadCachedRoomDetail('octocat', 'repo-1')).toBeNull();
  });

  it('saves and reloads room detail', () => {
    const data = makeRoomData('repo-1');
    saveCachedRoomDetail('octocat', 'repo-1', data);
    const snapshot = loadCachedRoomDetail('octocat', 'repo-1');
    expect(snapshot).not.toBeNull();
    expect(snapshot!.data.readme.plainText).toBe('# Hello');
  });

  it('marks a just-saved snapshot as fresh', () => {
    saveCachedRoomDetail('octocat', 'repo-1', makeRoomData('repo-1'));
    const snapshot = loadCachedRoomDetail('octocat', 'repo-1')!;
    expect(isRoomDetailFresh(snapshot)).toBe(true);
  });

  it('marks an expired snapshot as stale', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString();
    localStorage.setItem(
      'repo-dungeon:v1:room:octocat:repo-1',
      JSON.stringify({
        schemaVersion: 1,
        repoFullName: 'octocat/repo-1',
        fetchedAt: eightDaysAgo,
        data: makeRoomData('repo-1'),
      }),
    );
    const snapshot = loadCachedRoomDetail('octocat', 'repo-1')!;
    expect(isRoomDetailFresh(snapshot)).toBe(false);
  });

  it('normalises owner and repo to lower case', () => {
    saveCachedRoomDetail('OctoCAT', 'My-Repo', makeRoomData('My-Repo'));
    expect(loadCachedRoomDetail('octocat', 'my-repo')).not.toBeNull();
  });

  it('returns null for an unknown schema version', () => {
    localStorage.setItem(
      'repo-dungeon:v1:room:octocat:repo-1',
      JSON.stringify({ schemaVersion: 99, data: {} }),
    );
    expect(loadCachedRoomDetail('octocat', 'repo-1')).toBeNull();
  });
});
