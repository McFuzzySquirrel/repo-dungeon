import type {
  LocalScanCacheSnapshot,
  LocalSourceSelection,
  LocalRepoScanResult,
} from '@/localRepos/types';
import { STORAGE_KEYS } from '@/store/persistence';

const LOCAL_SCAN_CACHE_PREFIX = 'repo-dungeon:v1:local-scan-cache';

function normalizeCacheKey(rootId: string): string {
  return `${LOCAL_SCAN_CACHE_PREFIX}:${encodeURIComponent(rootId.trim().toLowerCase())}`;
}

export function saveLocalSourceSelection(selection: LocalSourceSelection): void {
  localStorage.setItem(STORAGE_KEYS.selectedSource, `local:${encodeURIComponent(selection.rootId)}`);
  localStorage.setItem(`${LOCAL_SCAN_CACHE_PREFIX}:selected`, JSON.stringify(selection));
}

export function loadLocalSourceSelection(): LocalSourceSelection | null {
  const raw = localStorage.getItem(`${LOCAL_SCAN_CACHE_PREFIX}:selected`);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LocalSourceSelection;
    if (!parsed.rootId || !parsed.rootPathToken || !parsed.rootLabel) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalSourceSelection(): void {
  localStorage.removeItem(`${LOCAL_SCAN_CACHE_PREFIX}:selected`);
}

export function saveLocalScanCache(source: LocalSourceSelection, scan: LocalRepoScanResult): void {
  const snapshot: LocalScanCacheSnapshot = {
    schemaVersion: 1,
    source,
    scan,
    cachedAt: new Date().toISOString(),
  };

  localStorage.setItem(normalizeCacheKey(source.rootId), JSON.stringify(snapshot));
}

export function loadLocalScanCache(rootId: string): LocalScanCacheSnapshot | null {
  const raw = localStorage.getItem(normalizeCacheKey(rootId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LocalScanCacheSnapshot;
    if (parsed.schemaVersion !== 1) {
      return null;
    }
    if (!parsed.source?.rootId || !parsed.scan?.rootPathToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalScanCache(rootId: string): void {
  localStorage.removeItem(normalizeCacheKey(rootId));
}