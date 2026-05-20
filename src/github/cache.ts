import type { GitHubRepoSummary, GitHubRoomData } from '@/github/types';

const REPO_LIST_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours
const ROOM_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days
const SCHEMA_VERSION = 1 as const;

/**
 * ETag bag for each REST endpoint that contributes to a room snapshot.
 * Persisted so that subsequent loads can issue `If-None-Match` and receive
 * a free `304 Not Modified` response from GitHub (does not count against
 * the unauthenticated rate-limit budget).
 */
export interface RoomDetailEtags {
  repo?: string;
  readme?: string;
  languages?: string;
  tree?: string;
  contributors?: string;
}

export interface RepoListSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  username: string;
  fetchedAt: string;
  repos: GitHubRepoSummary[];
  /** ETags per page index (1-based), used for conditional revalidation. */
  pageEtags?: Record<number, string>;
}

export interface RoomDetailSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  repoFullName: string;
  fetchedAt: string;
  data: GitHubRoomData;
  etags?: RoomDetailEtags;
}

function repoListKey(username: string): string {
  return `repo-dungeon:v1:dungeon:${username.toLowerCase()}`;
}

function roomDetailKey(owner: string, repo: string): string {
  return `repo-dungeon:v1:room:${owner.toLowerCase()}:${repo.toLowerCase()}`;
}

function readLocalStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // storage unavailable or quota exceeded — silently ignore
  }
}

function removeLocalStorage(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

// ── Repo list ──────────────────────────────────────────────────────────────

export function loadCachedRepoList(username: string): RepoListSnapshot | null {
  const raw = readLocalStorage(repoListKey(username));
  if (!raw) {
    return null;
  }
  try {
    const snapshot = JSON.parse(raw) as RepoListSnapshot;
    if (snapshot.schemaVersion !== SCHEMA_VERSION || !Array.isArray(snapshot.repos)) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function isRepoListFresh(snapshot: RepoListSnapshot): boolean {
  return Date.now() - new Date(snapshot.fetchedAt).getTime() < REPO_LIST_TTL_MS;
}

export function saveCachedRepoList(
  username: string,
  repos: GitHubRepoSummary[],
  pageEtags?: Record<number, string>,
): void {
  const snapshot: RepoListSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    username: username.toLowerCase(),
    fetchedAt: new Date().toISOString(),
    repos,
    ...(pageEtags && Object.keys(pageEtags).length > 0 ? { pageEtags } : {}),
  };
  writeLocalStorage(repoListKey(username), JSON.stringify(snapshot));
}

/**
 * Refreshes the `fetchedAt` timestamp on an existing repo-list snapshot
 * without changing its data. Used when GitHub returns `304 Not Modified`
 * for every page, confirming the cached list is still current.
 */
export function touchCachedRepoListFreshness(username: string): boolean {
  const existing = loadCachedRepoList(username);
  if (!existing) {
    return false;
  }
  const refreshed: RepoListSnapshot = {
    ...existing,
    fetchedAt: new Date().toISOString(),
  };
  writeLocalStorage(repoListKey(username), JSON.stringify(refreshed));
  return true;
}

export function clearCachedRepoList(username: string): void {
  removeLocalStorage(repoListKey(username));
}

// ── Room details ───────────────────────────────────────────────────────────

export function loadCachedRoomDetail(owner: string, repo: string): RoomDetailSnapshot | null {
  const raw = readLocalStorage(roomDetailKey(owner, repo));
  if (!raw) {
    return null;
  }
  try {
    const snapshot = JSON.parse(raw) as RoomDetailSnapshot;
    if (snapshot.schemaVersion !== SCHEMA_VERSION || !snapshot.data) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function isRoomDetailFresh(snapshot: RoomDetailSnapshot): boolean {
  return Date.now() - new Date(snapshot.fetchedAt).getTime() < ROOM_DETAIL_TTL_MS;
}

export function saveCachedRoomDetail(
  owner: string,
  repo: string,
  data: GitHubRoomData,
  etags?: RoomDetailEtags,
): void {
  const snapshot: RoomDetailSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    repoFullName: `${owner}/${repo}`,
    fetchedAt: new Date().toISOString(),
    data,
    ...(etags && Object.values(etags).some(Boolean) ? { etags } : {}),
  };
  writeLocalStorage(roomDetailKey(owner, repo), JSON.stringify(snapshot));
}

/**
 * Refreshes the `fetchedAt` timestamp on an existing room snapshot without
 * mutating its data. Used when every endpoint's conditional refetch returned
 * `304 Not Modified` — the cached body is still authoritative.
 */
export function touchCachedRoomDetailFreshness(owner: string, repo: string): boolean {
  const existing = loadCachedRoomDetail(owner, repo);
  if (!existing) {
    return false;
  }
  const refreshed: RoomDetailSnapshot = {
    ...existing,
    fetchedAt: new Date().toISOString(),
  };
  writeLocalStorage(roomDetailKey(owner, repo), JSON.stringify(refreshed));
  return true;
}
