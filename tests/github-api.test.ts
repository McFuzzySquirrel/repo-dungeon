import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubApiClient, GitHubApiError, type GitHubRequester, type RequestResult } from '@/github/api';
import type { GitHubRepoSummary } from '@/github/types';
import type { RoomDetailSnapshot } from '@/github/cache';

function makeRepo(index: number) {
  return {
    id: index,
    name: `repo-${index}`,
    full_name: `octocat/repo-${index}`,
    owner: { login: 'octocat' },
    description: null,
    html_url: `https://github.com/octocat/repo-${index}`,
    language: 'TypeScript',
    stargazers_count: index,
    forks_count: 0,
    topics: ['demo'],
    private: false,
    default_branch: 'main',
  };
}

function makeSummary(name = 'repo-1'): GitHubRepoSummary {
  return {
    id: 1,
    name,
    fullName: `octocat/${name}`,
    ownerLogin: 'octocat',
    description: 'cached desc',
    htmlUrl: `https://github.com/octocat/${name}`,
    language: 'TypeScript',
    stargazersCount: 7,
    forksCount: 1,
    topics: [],
    isPrivate: false,
    defaultBranch: 'main',
  };
}

describe('GitHubApiClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches repeated repo-list requests in-session', async () => {
    const requesterSpy = vi.fn((_route: string, _parameters?: Record<string, unknown>): Promise<RequestResult<unknown>> => {
      void _route;
      void _parameters;
      return Promise.resolve({
        data: [makeRepo(1)],
        status: 200,
        headers: {},
      });
    });
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;
    const client = new GitHubApiClient({ requester, cacheTtlMs: 10_000 });

    const first = await client.listPublicRepos('octocat');
    const second = await client.listPublicRepos('octocat');

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(requesterSpy).toHaveBeenCalledTimes(1);
  });

  it('paginates /users/{username}/repos until final page', async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) => makeRepo(index + 1));
    const pageTwo = Array.from({ length: 25 }, (_, index) => makeRepo(index + 101));

    const requesterSpy = vi.fn((_route: string, parameters?: Record<string, unknown>): Promise<RequestResult<unknown>> => {
      const page = Number(parameters?.page);
      return Promise.resolve({
        data: page === 1 ? pageOne : pageTwo,
        status: 200,
        headers: {},
      });
    });
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;

    const progressSnapshots: Array<{ page: number; loaded: number }> = [];
    const client = new GitHubApiClient({ requester });

    const repos = await client.listPublicRepos('octocat', {
      onProgress: (progress) => {
        progressSnapshots.push({ page: progress.page, loaded: progress.accumulatedCount });
      },
    });

    expect(repos).toHaveLength(125);
    expect(requesterSpy).toHaveBeenCalledTimes(2);
    expect(progressSnapshots).toEqual([
      { page: 1, loaded: 100 },
      { page: 2, loaded: 125 },
    ]);
  });

  it('returns rate-limit errors with kind and rateLimit info', async () => {
    vi.useFakeTimers();
    const requesterSpy = vi.fn((_route: string, _parameters?: Record<string, unknown>): Promise<RequestResult<unknown>> =>
      {
        void _route;
        void _parameters;
        return Promise.reject(createRateLimitError());
      },
    );
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;

    const client = new GitHubApiClient({ requester });
    const pending = client.listPublicRepos('octocat').catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    const error = await pending;
    if (!(error instanceof GitHubApiError)) {
      throw error;
    }

    expect(error.details.kind).toBe('rate_limit');
    expect(error.details.rateLimit?.remaining).toBe(0);
  });

  it('skips GET /repos/{owner}/{repo} when a summary is supplied (item #2)', async () => {
    const requesterSpy = vi.fn((route: string, _params?: Record<string, unknown>): Promise<RequestResult<unknown>> => {
      void _params;
      if (route.endsWith('/repos/{owner}/{repo}')) {
        throw new Error('repo summary endpoint should not be called when summary is provided');
      }
      // Return empty payloads for languages/tree/contributors/readme.
      if (route.includes('/languages')) {
        return Promise.resolve({ data: { TypeScript: 1 }, status: 200, headers: { etag: '"lang-v1"' } });
      }
      if (route.includes('/git/trees/')) {
        return Promise.resolve({
          data: { tree: [{ path: 'src', type: 'tree' }], truncated: false },
          status: 200,
          headers: { etag: '"tree-v1"' },
        });
      }
      if (route.endsWith('/readme')) {
        return Promise.resolve({
          data: { encoding: 'base64', content: btoa('# Hello'), size: 7 },
          status: 200,
          headers: { etag: '"readme-v1"' },
        });
      }
      if (route.endsWith('/contributors')) {
        return Promise.resolve({ data: [], status: 200, headers: { etag: '"contrib-v1"' } });
      }
      return Promise.resolve({ data: null, status: 200, headers: {} });
    });
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;

    const client = new GitHubApiClient({ requester });
    const result = await client.loadRoomData(
      { roomId: 'r1', owner: 'octocat', repo: 'repo-1' },
      { summary: makeSummary() },
    );

    expect(result.data.repo.description).toBe('cached desc');
    expect(result.etags.languages).toBe('"lang-v1"');
    expect(result.etags.tree).toBe('"tree-v1"');
    // No `GET /repos/{owner}/{repo}` call should have happened.
    const calledRoutes = requesterSpy.mock.calls.map((c) => c[0]);
    expect(calledRoutes).not.toContain('GET /repos/{owner}/{repo}');
  });

  it('defers README and contributors when skipReadme / skipContributors are set (items #3, #4)', async () => {
    const requesterSpy = vi.fn((route: string, _parameters?: Record<string, unknown>): Promise<RequestResult<unknown>> => {
      void _parameters;
      if (route.endsWith('/readme') || route.endsWith('/contributors')) {
        throw new Error(`endpoint ${route} should be lazy-deferred, not fetched eagerly`);
      }
      if (route.includes('/languages')) {
        return Promise.resolve({ data: {}, status: 200, headers: {} });
      }
      if (route.includes('/git/trees/')) {
        return Promise.resolve({ data: { tree: [], truncated: false }, status: 200, headers: {} });
      }
      return Promise.resolve({ data: null, status: 200, headers: {} });
    });
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;

    const client = new GitHubApiClient({ requester });
    const result = await client.loadRoomData(
      { roomId: 'r1', owner: 'octocat', repo: 'repo-1' },
      { summary: makeSummary(), skipReadme: true, skipContributors: true },
    );

    expect(result.data.deferred).toEqual(expect.arrayContaining(['readme', 'contributors']));
    expect(result.data.readme.plainText).toBeNull();
    expect(result.data.contributors).toEqual([]);
  });

  it('reuses persisted body on 304 Not Modified and reports fullyRevalidated (item #1)', async () => {
    const persisted: RoomDetailSnapshot = {
      schemaVersion: 1,
      repoFullName: 'octocat/repo-1',
      fetchedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      data: {
        repo: makeSummary(),
        readme: { plainText: '# cached', truncated: false },
        languages: { TypeScript: 100 },
        topLevelTree: [{ path: 'src', type: 'tree' }],
        treeTruncated: false,
        contributors: [
          { id: 1, login: 'alice', avatarUrl: '', profileUrl: '', contributions: 9 },
        ],
        unavailable: [],
      },
      etags: {
        languages: '"lang-v1"',
        tree: '"tree-v1"',
        readme: '"readme-v1"',
        contributors: '"contrib-v1"',
      },
    };

    const requesterSpy = vi.fn((route: string, parameters?: Record<string, unknown>): Promise<RequestResult<unknown>> => {
      const headers = (parameters?.headers as Record<string, string> | undefined) ?? {};
      const etag = headers['if-none-match'];
      // Verify that revalidation is using the persisted ETag for each endpoint.
      if (route.includes('/languages')) expect(etag).toBe('"lang-v1"');
      if (route.includes('/git/trees/')) expect(etag).toBe('"tree-v1"');
      if (route.endsWith('/readme')) expect(etag).toBe('"readme-v1"');
      if (route.endsWith('/contributors')) expect(etag).toBe('"contrib-v1"');
      // Every endpoint returns 304 with no body.
      return Promise.resolve({ data: null as unknown as object, status: 304, headers: {} });
    });
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;

    const client = new GitHubApiClient({ requester });
    const result = await client.loadRoomData(
      { roomId: 'r1', owner: 'octocat', repo: 'repo-1' },
      { summary: makeSummary(), persisted },
    );

    // Body is fully reused from persisted snapshot.
    expect(result.data.readme.plainText).toBe('# cached');
    expect(result.data.languages).toEqual({ TypeScript: 100 });
    expect(result.data.contributors[0]?.login).toBe('alice');
    expect(result.fullyRevalidated).toBe(true);
    // ETags are propagated back so the caller can re-persist them.
    expect(result.etags.languages).toBe('"lang-v1"');
    expect(result.etags.readme).toBe('"readme-v1"');
  });

  it('loadContributors and loadReadme send If-None-Match when an ETag is supplied', async () => {
    const requesterSpy = vi.fn((route: string, parameters?: Record<string, unknown>): Promise<RequestResult<unknown>> => {
      const headers = (parameters?.headers as Record<string, string> | undefined) ?? {};
      if (route.endsWith('/contributors')) {
        expect(headers['if-none-match']).toBe('"contrib-etag"');
        return Promise.resolve({
          data: [
            { id: 2, login: 'bob', avatar_url: 'a', html_url: 'h', contributions: 4 },
          ],
          status: 200,
          headers: { etag: '"contrib-v2"' },
        });
      }
      if (route.endsWith('/readme')) {
        expect(headers['if-none-match']).toBe('"readme-etag"');
        return Promise.resolve({
          data: { encoding: 'base64', content: btoa('# new'), size: 5 },
          status: 200,
          headers: { etag: '"readme-v2"' },
        });
      }
      return Promise.resolve({ data: null, status: 200, headers: {} });
    });
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;

    const client = new GitHubApiClient({ requester });
    const contributors = await client.loadContributors(
      { roomId: 'r1', owner: 'octocat', repo: 'repo-1' },
      { etag: '"contrib-etag"' },
    );
    expect(contributors.contributors[0]?.login).toBe('bob');
    expect(contributors.etag).toBe('"contrib-v2"');

    const readme = await client.loadReadme(
      { roomId: 'r1', owner: 'octocat', repo: 'repo-1' },
      { etag: '"readme-etag"' },
    );
    expect(readme.readme.plainText).toBe('# new');
    expect(readme.etag).toBe('"readme-v2"');
  });

  it('publishes rate-limit snapshots from response headers (item #5)', async () => {
    const requesterSpy = vi.fn((_route: string, _parameters?: Record<string, unknown>): Promise<RequestResult<unknown>> => {
      void _route;
      void _parameters;
      return Promise.resolve({
        data: [makeRepo(1)],
        status: 200,
        headers: {
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '42',
          'x-ratelimit-reset': '2000000000',
          etag: '"page-1"',
        },
      });
    });
    const requester: GitHubRequester = (route, parameters) =>
      requesterSpy(route, parameters) as Promise<RequestResult<never>>;

    const client = new GitHubApiClient({ requester });
    const observed: number[] = [];
    client.subscribeRateLimit((snapshot) => {
      if (snapshot.remaining !== null) observed.push(snapshot.remaining);
    });

    await client.listPublicRepos('octocat');

    expect(client.getRateLimit()?.remaining).toBe(42);
    expect(client.getRateLimit()?.limit).toBe(60);
    expect(observed).toContain(42);
  });
});

function createRateLimitError(): Error {
  return Object.assign(new Error('API rate limit exceeded'), {
    status: 403,
    response: {
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-limit': '60',
        'x-ratelimit-reset': '2000000000',
      },
    },
  });
}
