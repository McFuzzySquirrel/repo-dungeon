import { Octokit } from '@octokit/rest';
import type { RoomDetailEtags, RoomDetailSnapshot, RepoListSnapshot } from '@/github/cache';
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

/**
 * Most recent rate-limit reading published by the API client. Components can
 * subscribe via `GitHubApiClient.subscribeRateLimit` to surface the remaining
 * budget in the UI (HUD counter) and degrade gracefully near the cap.
 */
export interface RateLimitSnapshot {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  /** Whether the most recent request was a free conditional-request short-circuit (304). */
  lastWasConditional: boolean;
  /** Wall-clock time of this reading. */
  observedAt: string;
}

/**
 * Process-wide singleton tracker for GitHub rate-limit headers. Every
 * `GitHubApiClient` instance publishes here in addition to its own per-client
 * subscribers, so the HUD can display the latest reading without needing a
 * client reference. Implementation of optimization-research item #5.
 */
class RateLimitTracker {
  private snapshot: RateLimitSnapshot | null = null;
  private readonly listeners = new Set<(snapshot: RateLimitSnapshot) => void>();

  get(): RateLimitSnapshot | null {
    return this.snapshot;
  }

  publish(snapshot: RateLimitSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // listener errors must not break request flow
      }
    }
  }

  subscribe(listener: (snapshot: RateLimitSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const rateLimitTracker = new RateLimitTracker();

interface GitHubApiClientOptions {
  cacheTtlMs?: number;
  requester?: GitHubRequester;
}

interface ListRepoOptions {
  onProgress?: (progress: RepoPageProgress) => void;
  perPage?: number;
  /** Existing persisted snapshot whose page ETags should be used for `If-None-Match`. */
  persisted?: RepoListSnapshot;
}

export interface LoadRepoListResult {
  repos: GitHubRepoSummary[];
  /** Map of page index (1-based) → ETag header value, suitable for persisting. */
  pageEtags: Record<number, string>;
  /** True when every fetched page returned `304 Not Modified` and `persisted` was reused. */
  fullyRevalidated: boolean;
}

interface LoadRoomDataOptions {
  /** Pre-fetched repo summary (e.g. from the dungeon repo-list cache). Skips `GET /repos/{owner}/{repo}`. */
  summary?: GitHubRepoSummary;
  /** Existing persisted snapshot; its ETags are used for `If-None-Match` revalidation. */
  persisted?: RoomDetailSnapshot;
  /** Skip the README request (caller will lazy-fetch via `loadReadme`). Default: false. */
  skipReadme?: boolean;
  /** Skip the contributors request (caller will lazy-fetch via `loadContributors`). Default: false. */
  skipContributors?: boolean;
}

export interface LoadRoomDataResult {
  data: GitHubRoomData;
  etags: RoomDetailEtags;
  /**
   * True when every fetched endpoint returned `304 Not Modified` (and `persisted`
   * supplied the body). Callers can `touchCachedRoomDetailFreshness` instead of
   * re-saving the same payload.
   */
  fullyRevalidated: boolean;
}

export interface LoadReadmeResult {
  readme: GitHubReadmePayload;
  etag?: string;
}

export interface LoadContributorsResult {
  contributors: GitHubContributorSummary[];
  etag?: string;
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
    const callerHeaders = (parameters?.headers as Record<string, string | undefined> | undefined) ?? {};
    const passthroughParameters = { ...parameters };
    delete passthroughParameters.headers;

    try {
      const response = await octokit.request(route, {
        ...passthroughParameters,
        headers: {
          Accept: 'application/vnd.github+json',
          ...callerHeaders,
        },
      });

      return {
        data: response.data as T,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      // Octokit raises HttpError for 304 responses (since they have no body).
      // Surface it as a normal RequestResult so revalidation logic can detect it.
      const status = (error as { status?: number } | null)?.status;
      if (status === 304) {
        const headers = ((error as { response?: { headers?: HeaderBag } } | null)?.response?.headers ?? {});
        return {
          data: undefined as unknown as T,
          status: 304,
          headers,
        };
      }
      throw error;
    }
  };
}

export class GitHubApiClient {
  private readonly requester: GitHubRequester;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheRecord<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private rateLimit: RateLimitSnapshot | null = null;
  private readonly rateLimitListeners = new Set<(snapshot: RateLimitSnapshot) => void>();

  constructor(options: GitHubApiClientOptions = {}) {
    this.requester = options.requester ?? createOctokitRequester();
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /** Most recent rate-limit reading (or null if no requests have been observed). */
  getRateLimit(): RateLimitSnapshot | null {
    return this.rateLimit;
  }

  /** Subscribe to rate-limit updates (HUD counter). Returns an unsubscribe function. */
  subscribeRateLimit(listener: (snapshot: RateLimitSnapshot) => void): () => void {
    this.rateLimitListeners.add(listener);
    return () => {
      this.rateLimitListeners.delete(listener);
    };
  }

  /**
   * Backward-compatible repo-list loader. Prefer `listPublicReposWithRevalidation`
   * when an existing persisted snapshot is available, so 304 short-circuits apply.
   */
  async listPublicRepos(username: string, options: ListRepoOptions = {}): Promise<GitHubRepoSummary[]> {
    const result = await this.listPublicReposWithRevalidation(username, options);
    return result.repos;
  }

  async listPublicReposWithRevalidation(
    username: string,
    options: ListRepoOptions = {},
  ): Promise<LoadRepoListResult> {
    return this.listReposPageLoop('GET /users/{username}/repos', { username }, options);
  }

  /**
   * Loads the room data for a single repository.
   *
   * Optimizations applied (see `docs/optimization-research.md`):
   * - `options.summary`: skips `GET /repos/{owner}/{repo}` when the caller already
   *   has the summary from the repo-list (item #2).
   * - `options.persisted`: uses persisted per-endpoint ETags to issue
   *   `If-None-Match` requests; 304 responses reuse the persisted body and do
   *   not count against the rate-limit budget (item #1).
   * - `options.skipReadme` / `options.skipContributors`: defer those fetches to
   *   lazy on-demand loaders (`loadReadme`, `loadContributors`) so unopened tabs
   *   never cost a request (items #3, #4).
   */
  async loadRoomData(
    roomRef: RoomRepositoryRef,
    options: LoadRoomDataOptions = {},
  ): Promise<LoadRoomDataResult> {
    const persistedData = options.persisted?.data;
    const persistedEtags = options.persisted?.etags ?? {};
    const skipReadme = options.skipReadme === true;
    const skipContributors = options.skipContributors === true;
    let revalidatedCount = 0;
    let fetchedOrSkippedCount = 0;

    // ── repo summary ─────────────────────────────────────────────────────────
    let repo: GitHubRepoSummary;
    let repoEtag: string | undefined;

    if (options.summary && options.summary.ownerLogin === roomRef.owner && options.summary.name === roomRef.repo) {
      // Item #2: caller already has the summary; skip the request entirely.
      repo = options.summary;
      repoEtag = persistedEtags.repo;
    } else {
      const repoOutcome = await this.revalidate<RepoApiModel>(
        'GET /repos/{owner}/{repo}',
        { owner: roomRef.owner, repo: roomRef.repo },
        persistedEtags.repo,
        true,
      );
      fetchedOrSkippedCount += 1;
      if (repoOutcome.notModified && persistedData) {
        repo = persistedData.repo;
        repoEtag = persistedEtags.repo;
        revalidatedCount += 1;
      } else if (repoOutcome.data) {
        repo = normalizeRepo(repoOutcome.data);
        repoEtag = repoOutcome.etag ?? persistedEtags.repo;
      } else {
        throw new GitHubApiError({
          kind: 'unknown',
          message: 'Repository response was empty.',
          status: repoOutcome.status,
        });
      }
    }

    const unavailable: GitHubRoomData['unavailable'] = [];
    const deferred: NonNullable<GitHubRoomData['deferred']> = [];
    const etags: RoomDetailEtags = {};
    if (repoEtag) etags.repo = repoEtag;

    // ── languages ────────────────────────────────────────────────────────────
    const languagesPromise = this.revalidate<Record<string, number>>(
      'GET /repos/{owner}/{repo}/languages',
      { owner: roomRef.owner, repo: roomRef.repo },
      persistedEtags.languages,
      false,
    )
      .then((outcome) => {
        fetchedOrSkippedCount += 1;
        if (outcome.notModified && persistedData) {
          revalidatedCount += 1;
          if (persistedEtags.languages) etags.languages = persistedEtags.languages;
          return persistedData.languages;
        }
        if (outcome.etag) etags.languages = outcome.etag;
        return outcome.data ?? {};
      })
      .catch(() => {
        unavailable.push('languages');
        const fallback: Record<string, number> = {};
        return fallback;
      });

    // ── tree ─────────────────────────────────────────────────────────────────
    const treePromise = this.revalidate<RepoTreeApiModel>(
      'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
      {
        owner: roomRef.owner,
        repo: roomRef.repo,
        tree_sha: repo.defaultBranch,
        recursive: 1,
      },
      persistedEtags.tree,
      false,
    )
      .then((outcome) => {
        fetchedOrSkippedCount += 1;
        if (outcome.notModified && persistedData) {
          revalidatedCount += 1;
          if (persistedEtags.tree) etags.tree = persistedEtags.tree;
          return {
            entries: persistedData.topLevelTree,
            truncated: persistedData.treeTruncated,
          };
        }
        if (outcome.etag) etags.tree = outcome.etag;
        const treeBody = outcome.data ?? { tree: [], truncated: false };
        const entries = (treeBody.tree ?? [])
          .filter((entry) => !entry.path.includes('/'))
          .map((entry) => ({ path: entry.path, type: entry.type }));
        return { entries, truncated: Boolean(treeBody.truncated) };
      })
      .catch(() => {
        unavailable.push('tree');
        return { entries: [] as GitHubRepoTreeEntry[], truncated: false };
      });

    // ── readme (lazy when skipped) ───────────────────────────────────────────
    let readmePromise: Promise<GitHubReadmePayload>;
    if (skipReadme) {
      deferred.push('readme');
      // Reuse persisted README body if we have one; otherwise placeholder.
      readmePromise = Promise.resolve(
        persistedData?.readme ?? {
          plainText: null,
          truncated: false,
        },
      );
      if (persistedEtags.readme) etags.readme = persistedEtags.readme;
    } else {
      readmePromise = this.revalidateReadme(roomRef.owner, roomRef.repo, persistedEtags.readme)
        .then((outcome) => {
          fetchedOrSkippedCount += 1;
          if (outcome.notModified && persistedData) {
            revalidatedCount += 1;
            if (persistedEtags.readme) etags.readme = persistedEtags.readme;
            return persistedData.readme;
          }
          if (outcome.etag) etags.readme = outcome.etag;
          return outcome.readme;
        })
        .catch((error: unknown) => {
          unavailable.push('readme');
          return fallbackReadme(error);
        });
    }

    // ── contributors (lazy when skipped) ─────────────────────────────────────
    let contributorsPromise: Promise<GitHubContributorSummary[]>;
    if (skipContributors) {
      deferred.push('contributors');
      contributorsPromise = Promise.resolve(persistedData?.contributors ?? []);
      if (persistedEtags.contributors) etags.contributors = persistedEtags.contributors;
    } else {
      contributorsPromise = this.revalidate<ContributorApiModel[]>(
        'GET /repos/{owner}/{repo}/contributors',
        { owner: roomRef.owner, repo: roomRef.repo, per_page: 5, anon: false },
        persistedEtags.contributors,
        false,
      )
        .then((outcome) => {
          fetchedOrSkippedCount += 1;
          if (outcome.notModified && persistedData) {
            revalidatedCount += 1;
            if (persistedEtags.contributors) etags.contributors = persistedEtags.contributors;
            return persistedData.contributors;
          }
          if (outcome.etag) etags.contributors = outcome.etag;
          return (outcome.data ?? []).map(normalizeContributor);
        })
        .catch(() => {
          unavailable.push('contributors');
          return [] as GitHubContributorSummary[];
        });
    }

    const [readme, languages, tree, contributors] = await Promise.all([
      readmePromise,
      languagesPromise,
      treePromise,
      contributorsPromise,
    ]);

    const data: GitHubRoomData = {
      repo,
      readme,
      languages,
      topLevelTree: tree.entries,
      treeTruncated: tree.truncated,
      contributors,
      unavailable,
      ...(deferred.length > 0 ? { deferred } : {}),
    };

    return {
      data,
      etags,
      fullyRevalidated: fetchedOrSkippedCount > 0 && revalidatedCount === fetchedOrSkippedCount,
    };
  }

  /** Lazy loader for the README endpoint (item #4). */
  async loadReadme(
    roomRef: RoomRepositoryRef,
    options: { etag?: string } = {},
  ): Promise<LoadReadmeResult> {
    const outcome = await this.revalidateReadme(roomRef.owner, roomRef.repo, options.etag);
    if (outcome.notModified) {
      // 304 without a persisted body — caller must supply one. Return placeholder.
      return {
        readme: { plainText: null, truncated: false, unavailableReason: 'README unchanged.' },
        etag: options.etag,
      };
    }
    return {
      readme: outcome.readme,
      etag: outcome.etag ?? options.etag,
    };
  }

  /** Lazy loader for the contributors endpoint (item #3). */
  async loadContributors(
    roomRef: RoomRepositoryRef,
    options: { etag?: string } = {},
  ): Promise<LoadContributorsResult> {
    const outcome = await this.revalidate<ContributorApiModel[]>(
      'GET /repos/{owner}/{repo}/contributors',
      { owner: roomRef.owner, repo: roomRef.repo, per_page: 5, anon: false },
      options.etag,
      false,
    );
    if (outcome.notModified) {
      return { contributors: [], etag: options.etag };
    }
    return {
      contributors: (outcome.data ?? []).map(normalizeContributor),
      etag: outcome.etag ?? options.etag,
    };
  }

  private async listReposPageLoop(
    route: string,
    routeBaseParameters: Record<string, unknown>,
    options: ListRepoOptions,
  ): Promise<LoadRepoListResult> {
    const perPage = options.perPage ?? 100;
    const persistedEtags = options.persisted?.pageEtags ?? {};
    const persistedRepos = options.persisted?.repos ?? [];
    const persistedPageSize = perPage; // assume same per-page when revalidating

    const repos: GitHubRepoSummary[] = [];
    const pageEtags: Record<number, string> = {};
    let page = 1;
    let hasNext = true;
    let revalidatedPages = 0;
    let totalPages = 0;

    while (hasNext) {
      const persistedEtag = persistedEtags[page];
      const outcome = await this.revalidate<RepoApiModel[]>(
        route,
        {
          ...routeBaseParameters,
          sort: 'updated',
          direction: 'desc',
          per_page: perPage,
          page,
        },
        persistedEtag,
        true,
      );
      totalPages += 1;

      let pageData: GitHubRepoSummary[];
      if (outcome.notModified) {
        // Reuse the slice of persisted repos belonging to this page.
        const start = (page - 1) * persistedPageSize;
        pageData = persistedRepos.slice(start, start + persistedPageSize);
        if (persistedEtag) pageEtags[page] = persistedEtag;
        revalidatedPages += 1;
      } else if (outcome.data) {
        pageData = outcome.data.map(normalizeRepo);
        if (outcome.etag) pageEtags[page] = outcome.etag;
      } else {
        pageData = [];
      }

      repos.push(...pageData);
      options.onProgress?.({
        page,
        pageSize: pageData.length,
        accumulatedCount: repos.length,
      });

      hasNext = pageData.length === perPage;
      page += 1;
    }

    return {
      repos,
      pageEtags,
      fullyRevalidated: totalPages > 0 && revalidatedPages === totalPages,
    };
  }

  private async revalidateReadme(
    owner: string,
    repo: string,
    etag: string | undefined,
  ): Promise<{ notModified: boolean; readme: GitHubReadmePayload; etag?: string; status: number }> {
    const outcome = await this.revalidate<ReadmeApiModel>(
      'GET /repos/{owner}/{repo}/readme',
      { owner, repo },
      etag,
      false,
    );
    if (outcome.notModified) {
      return {
        notModified: true,
        readme: { plainText: null, truncated: false },
        etag,
        status: outcome.status,
      };
    }
    const body = outcome.data;
    if (!body) {
      return {
        notModified: false,
        readme: { plainText: null, truncated: false, unavailableReason: 'README empty.' },
        etag: outcome.etag,
        status: outcome.status,
      };
    }
    if (body.encoding !== 'base64') {
      return {
        notModified: false,
        readme: { plainText: null, truncated: false, unavailableReason: 'Unsupported README encoding.' },
        etag: outcome.etag,
        status: outcome.status,
      };
    }
    return {
      notModified: false,
      readme: {
        plainText: decodeBase64ToText(body.content),
        truncated: body.size > 65_536,
      },
      etag: outcome.etag,
      status: outcome.status,
    };
  }

  /**
   * Issues a single request with optional `If-None-Match` revalidation,
   * bypassing the in-memory cache (the persistent ETag cache supplies the
   * body on `304 Not Modified`). Updates the rate-limit tracker.
   */
  private async revalidate<T>(
    route: string,
    parameters: Record<string, unknown>,
    etag: string | undefined,
    backoffEnabled: boolean,
  ): Promise<{ notModified: boolean; data: T | null; etag?: string; status: number; headers: HeaderBag }> {
    const requestParameters: Record<string, unknown> = { ...parameters };
    if (etag) {
      const callerHeaders = (parameters.headers as Record<string, string> | undefined) ?? {};
      requestParameters.headers = { ...callerHeaders, 'if-none-match': etag };
    }

    const response = await this.requestWithCache<T>(route, requestParameters, backoffEnabled);
    this.recordRateLimit(response.headers, response.status === 304);

    if (response.status === 304) {
      return {
        notModified: true,
        data: null,
        etag,
        status: 304,
        headers: response.headers,
      };
    }

    const newEtag = etagHeader(response.headers);
    return {
      notModified: false,
      data: response.data,
      etag: newEtag,
      status: response.status,
      headers: response.headers,
    };
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

  private recordRateLimit(headers: HeaderBag, wasConditional: boolean): void {
    const limit = parseIntegerHeader(headers['x-ratelimit-limit']);
    const remaining = parseIntegerHeader(headers['x-ratelimit-remaining']);
    const resetEpoch = parseIntegerHeader(headers['x-ratelimit-reset']);

    // Some test fixtures and 304 responses may not carry rate-limit headers.
    // In that case keep the previous reading but still publish a "lastWasConditional"
    // update so subscribers can show the saved-call indicator.
    if (limit === null && remaining === null && !this.rateLimit) {
      return;
    }

    const snapshot: RateLimitSnapshot = {
      limit: limit ?? this.rateLimit?.limit ?? null,
      remaining: remaining ?? this.rateLimit?.remaining ?? null,
      resetAt:
        resetEpoch !== null ? new Date(resetEpoch * 1_000).toISOString() : this.rateLimit?.resetAt ?? null,
      lastWasConditional: wasConditional,
      observedAt: new Date().toISOString(),
    };

    this.rateLimit = snapshot;
    rateLimitTracker.publish(snapshot);
    for (const listener of this.rateLimitListeners) {
      try {
        listener(snapshot);
      } catch {
        // listener errors must not break request flow
      }
    }
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

function normalizeContributor(contributor: ContributorApiModel): GitHubContributorSummary {
  return {
    id: contributor.id,
    login: contributor.login,
    avatarUrl: contributor.avatar_url,
    profileUrl: contributor.html_url,
    contributions: contributor.contributions,
  };
}

function etagHeader(headers: HeaderBag): string | undefined {
  const value = headers.etag ?? headers.ETag;
  if (value === undefined) return undefined;
  return String(value);
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
