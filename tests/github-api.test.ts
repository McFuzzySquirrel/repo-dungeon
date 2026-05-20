import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubApiClient, GitHubApiError, type GitHubRequester, type RequestResult } from '@/github/api';

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
