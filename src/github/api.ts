import { Octokit } from '@octokit/rest';
import type {
  GitHubApiErrorShape,
  GitHubContributorSummary,
  GitHubRateLimitInfo,
  GitHubReadmePayload,
  GitHubRepoSummary,
  GitHubRepoTreeEntry,
  GitHubRoomData,
  RepoPageProgress,
  RoomRepositoryRef,
} from '@/github/types';

const MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 400;
const DEFAULT_CACHE_TTL_MS = 60_000;

type HeaderBag = Record<string, string | number | undefined>;

export interface RequestResult<T> {
  data: T;
  status: number;
  headers: HeaderBag;
}

export type GitHubRequester = <T>(route: string, parameters?: Record<string, unknown>) => Promise<RequestResult<T>>;

export class GitHubApiError extends Error {
  constructor(public readonly details: GitHubApiErrorShape) {
    super(details.message);
    this.name = 'GitHubApiError';
  }
}

interface GitHubApiClientOptions {
  cacheTtlMs?: number;
  requester?: GitHubRequester;
}

interface ListRepoOptions {
  onProgress?: (progress: RepoPageProgress) => void;
  perPage?: number;
}

interface RepoApiModel {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  private: boolean;
  default_branch: string;
}

interface ReadmeApiModel {
  content: string;
  encoding: string;
  size: number;
}

interface RepoTreeApiModel {
  truncated?: boolean;
  tree?: Array<{ path: string; type: string }>;
}

interface ContributorApiModel {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

interface CacheRecord<T> {
  expiresAt: number;
  value: T;
}

export function createOctokitRequester(): GitHubRequester {
  const octokit = new Octokit({
    userAgent: 'repo-dungeon/phase-1',
  });

  return async <T>(route: string, parameters?: Record<string, unknown>): Promise<RequestResult<T>> => {
    const response = await octokit.request(route, {
      ...parameters,
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    return {
      data: response.data as T,
      status: response.status,
      headers: response.headers,
    };
  };
}

export class GitHubApiClient {
  private readonly requester: GitHubRequester;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheRecord<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(options: GitHubApiClientOptions = {}) {
    this.requester = options.requester ?? createOctokitRequester();
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  async listPublicRepos(username: string, options: ListRepoOptions = {}): Promise<GitHubRepoSummary[]> {
    return this.listReposPageLoop('GET /users/{username}/repos', { username }, options);
  }

  async loadRoomData(roomRef: RoomRepositoryRef): Promise<GitHubRoomData> {
    const repoResponse = await this.requestWithCache<RepoApiModel>(
      'GET /repos/{owner}/{repo}',
      {
        owner: roomRef.owner,
        repo: roomRef.repo,
      },
      true,
    );

    const repo = normalizeRepo(repoResponse.data);

    const unavailable: GitHubRoomData['unavailable'] = [];

    const [readme, languages, tree, contributors] = await Promise.all([
      this.fetchReadme(roomRef.owner, roomRef.repo).catch((error: unknown) => {
        unavailable.push('readme');
        return fallbackReadme(error);
      }),
      this.fetchLanguages(roomRef.owner, roomRef.repo).catch(() => {
        unavailable.push('languages');
        return {};
      }),
      this.fetchTree(roomRef.owner, roomRef.repo, repo.defaultBranch).catch(() => {
        unavailable.push('tree');
        return { entries: [], truncated: false };
      }),
      this.fetchContributors(roomRef.owner, roomRef.repo).catch(() => {
        unavailable.push('contributors');
        return [];
      }),
    ]);

    return {
      repo,
      readme,
      languages,
      topLevelTree: tree.entries,
      treeTruncated: tree.truncated,
      contributors,
      unavailable,
    };
  }

  private async listReposPageLoop(
    route: string,
    routeBaseParameters: Record<string, unknown>,
    options: ListRepoOptions,
  ): Promise<GitHubRepoSummary[]> {
    const perPage = options.perPage ?? 100;
    const repos: GitHubRepoSummary[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const response = await this.requestWithCache<RepoApiModel[]>(
        route,
        {
          ...routeBaseParameters,
          sort: 'updated',
          direction: 'desc',
          per_page: perPage,
          page,
        },
        true,
      );

      repos.push(...response.data.map(normalizeRepo));
      options.onProgress?.({
        page,
        pageSize: response.data.length,
        accumulatedCount: repos.length,
      });

      hasNext = response.data.length === perPage;
      page += 1;
    }

    return repos;
  }

  private async fetchReadme(owner: string, repo: string): Promise<GitHubReadmePayload> {
    const response = await this.requestWithCache<ReadmeApiModel>(
      'GET /repos/{owner}/{repo}/readme',
      { owner, repo },
      false,
    );

    if (response.data.encoding !== 'base64') {
      return {
        plainText: null,
        truncated: false,
        unavailableReason: 'Unsupported README encoding.',
      };
    }

    return {
      plainText: decodeBase64ToText(response.data.content),
      truncated: response.data.size > 65_536,
    };
  }

  private async fetchLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    const response = await this.requestWithCache<Record<string, number>>(
      'GET /repos/{owner}/{repo}/languages',
      { owner, repo },
      false,
    );
    return response.data;
  }

  private async fetchTree(
    owner: string,
    repo: string,
    defaultBranch: string,
  ): Promise<{ entries: GitHubRepoTreeEntry[]; truncated: boolean }> {
    const response = await this.requestWithCache<RepoTreeApiModel>(
      'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
      {
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: 1,
      },
      false,
    );

    const entries = (response.data.tree ?? [])
      .filter((entry) => !entry.path.includes('/'))
      .map((entry) => ({
        path: entry.path,
        type: entry.type,
      }));

    return {
      entries,
      truncated: Boolean(response.data.truncated),
    };
  }

  private async fetchContributors(owner: string, repo: string): Promise<GitHubContributorSummary[]> {
    const response = await this.requestWithCache<ContributorApiModel[]>(
      'GET /repos/{owner}/{repo}/contributors',
      { owner, repo, per_page: 5, anon: false },
      false,
    );

    return response.data.map((contributor) => ({
      id: contributor.id,
      login: contributor.login,
      avatarUrl: contributor.avatar_url,
      profileUrl: contributor.html_url,
      contributions: contributor.contributions,
    }));
  }

  private async requestWithCache<T>(
    route: string,
    parameters: Record<string, unknown>,
    backoffEnabled: boolean,
  ): Promise<RequestResult<T>> {
    const cacheKey = `${route}|${JSON.stringify(parameters)}`;
    const cached = this.cache.get(cacheKey) as CacheRecord<RequestResult<T>> | undefined;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inFlight = this.inFlight.get(cacheKey) as Promise<RequestResult<T>> | undefined;
    if (inFlight) {
      return inFlight;
    }

    const requestPromise = this.withBackoff<T>(route, parameters, backoffEnabled).finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, requestPromise);

    const value = await requestPromise;
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return value;
  }

  private async withBackoff<T>(
    route: string,
    parameters: Record<string, unknown>,
    backoffEnabled: boolean,
  ): Promise<RequestResult<T>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        return await this.requester<T>(route, parameters);
      } catch (error) {
        lastError = error;
        const normalized = toGitHubApiError(error);
        const retryable =
          backoffEnabled && (normalized.details.kind === 'rate_limit' || normalized.details.kind === 'network');

        if (!retryable || attempt === MAX_RETRIES - 1) {
          throw normalized;
        }

        const backoffMs = computeBackoffDelayMs(normalized.details.rateLimit, attempt);
        await sleep(backoffMs);
      }
    }

    throw toGitHubApiError(lastError);
  }
}

export function createGitHubApiClient(options: GitHubApiClientOptions = {}): GitHubApiClient {
  return new GitHubApiClient(options);
}

function normalizeRepo(repo: RepoApiModel): GitHubRepoSummary {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    ownerLogin: repo.owner.login,
    description: repo.description,
    htmlUrl: repo.html_url,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    topics: repo.topics ?? [],
    isPrivate: repo.private,
    defaultBranch: repo.default_branch,
  };
}

function fallbackReadme(error: unknown): GitHubReadmePayload {
  if (error instanceof GitHubApiError && error.details.kind === 'not_found') {
    return {
      plainText: null,
      truncated: false,
      unavailableReason: 'README not found.',
    };
  }

  return {
    plainText: null,
    truncated: false,
    unavailableReason: 'README unavailable.',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeBackoffDelayMs(rateLimit: GitHubRateLimitInfo | undefined, attempt: number): number {
  if (rateLimit?.retryAfterSeconds && rateLimit.retryAfterSeconds > 0) {
    return rateLimit.retryAfterSeconds * 1_000;
  }

  const multiplier = 2 ** attempt;
  return DEFAULT_BACKOFF_MS * multiplier;
}

function decodeBase64ToText(content: string): string {
  const sanitized = content.replaceAll('\n', '');
  // atob is available in both browsers and Node 16+
  const binary = atob(sanitized);
  // Re-encode as proper UTF-8 text (handles multi-byte characters)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toGitHubApiError(error: unknown): GitHubApiError {
  if (error instanceof GitHubApiError) {
    return error;
  }

  const status = getErrorStatus(error);
  const headers = getErrorHeaders(error);
  const message = getErrorMessage(error);
  const rateLimit = extractRateLimitInfo(headers);
  const isRateLimit = isRateLimitError(status, headers, message);

  const details: GitHubApiErrorShape = {
    kind: isRateLimit
      ? 'rate_limit'
      : status === 404
        ? 'not_found'
        : status === 403
          ? 'forbidden'
          : status === undefined
            ? 'network'
            : 'unknown',
    message: isRateLimit
      ? 'GitHub API rate limit reached. Try again later or use a different network.'
      : message ?? 'Unable to load GitHub data right now.',
    status,
    rateLimit,
  };

  return new GitHubApiError(details);
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const candidate = error as { status?: unknown };
  return typeof candidate.status === 'number' ? candidate.status : undefined;
}

function getErrorHeaders(error: unknown): HeaderBag {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const candidate = error as { response?: { headers?: HeaderBag } };
  return candidate.response?.headers ?? {};
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { message?: unknown; response?: { data?: { message?: unknown } } };
  if (typeof candidate.response?.data?.message === 'string') {
    return candidate.response.data.message;
  }
  return typeof candidate.message === 'string' ? candidate.message : undefined;
}

function isRateLimitError(status: number | undefined, headers: HeaderBag, message: string | undefined): boolean {
  if (status !== 403 && status !== 429) {
    return false;
  }

  const remaining = toStringHeader(headers['x-ratelimit-remaining']);
  if (remaining === '0') {
    return true;
  }

  if (toStringHeader(headers['retry-after'])) {
    return true;
  }

  return Boolean(message?.toLowerCase().includes('rate limit'));
}

function extractRateLimitInfo(headers: HeaderBag): GitHubRateLimitInfo {
  const limit = parseIntegerHeader(headers['x-ratelimit-limit']);
  const remaining = parseIntegerHeader(headers['x-ratelimit-remaining']);
  const resetEpoch = parseIntegerHeader(headers['x-ratelimit-reset']);
  const retryAfterSeconds = parseIntegerHeader(headers['retry-after']);

  return {
    limit,
    remaining,
    resetAt: resetEpoch ? new Date(resetEpoch * 1_000).toISOString() : null,
    retryAfterSeconds,
  };
}

function parseIntegerHeader(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringHeader(value: string | number | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  return String(value);
}
