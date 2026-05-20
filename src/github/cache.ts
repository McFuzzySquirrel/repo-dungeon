import type { GitHubRepoSummary, GitHubRoomData } from '@/github/types';

const REPO_LIST_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours
const ROOM_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days
const SCHEMA_VERSION = 1 as const;

export interface RepoListSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  username: string;
  fetchedAt: string;
  repos: GitHubRepoSummary[];
}

export interface RoomDetailSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  repoFullName: string;
  fetchedAt: string;
  data: GitHubRoomData;
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

export function saveCachedRepoList(username: string, repos: GitHubRepoSummary[]): void {
  const snapshot: RepoListSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    username: username.toLowerCase(),
    fetchedAt: new Date().toISOString(),
    repos,
  };
  writeLocalStorage(repoListKey(username), JSON.stringify(snapshot));
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

export function saveCachedRoomDetail(owner: string, repo: string, data: GitHubRoomData): void {
  const snapshot: RoomDetailSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    repoFullName: `${owner}/${repo}`,
    fetchedAt: new Date().toISOString(),
    data,
  };
  writeLocalStorage(roomDetailKey(owner, repo), JSON.stringify(snapshot));
}
