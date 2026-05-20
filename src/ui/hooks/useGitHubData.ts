import { useCallback, useMemo, useState } from 'react';
import { GitHubApiError, createGitHubApiClient } from '@/github/api';
import {
  clearCachedRepoList,
  isRepoListFresh,
  loadCachedRepoList,
  saveCachedRepoList,
  touchCachedRepoListFreshness,
} from '@/github/cache';
import type { GitHubRepoSummary } from '@/github/types';

export type DataStatus = 'idle' | 'cache-hit' | 'loading' | 'success' | 'error';

interface RepoFetchProgress {
  page: number;
  loadedCount: number;
}

export interface UseGitHubDataResult {
  status: DataStatus;
  repos: GitHubRepoSummary[];
  errorMessage: string | null;
  progress: RepoFetchProgress | null;
  /** ISO 8601 timestamp of when the current repos were fetched, or null if not cached. */
  cacheAge: string | null;
  fetchRepos: (username: string, options?: { forceRefresh?: boolean }) => Promise<GitHubRepoSummary[]>;
}

export function useGitHubData(): UseGitHubDataResult {
  const [status, setStatus] = useState<DataStatus>('idle');
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<RepoFetchProgress | null>(null);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  const client = useMemo(() => createGitHubApiClient(), []);

  const fetchRepos = useCallback(
    async (username: string, options: { forceRefresh?: boolean } = {}): Promise<GitHubRepoSummary[]> => {
      const trimmed = username.trim();

      if (!options.forceRefresh) {
        const snapshot = loadCachedRepoList(trimmed);
        if (snapshot && isRepoListFresh(snapshot)) {
          setRepos(snapshot.repos);
          setCacheAge(snapshot.fetchedAt);
          setStatus('cache-hit');
          setErrorMessage(null);
          setProgress(null);
          return snapshot.repos;
        }
      } else {
        clearCachedRepoList(trimmed);
      }

      setStatus('loading');
      setErrorMessage(null);
      setProgress({ page: 0, loadedCount: 0 });
      setCacheAge(null);

      // Item #1 (optimization-research): use persisted page ETags so that an
      // expired-but-unchanged repo list refreshes via free 304 responses.
      const persisted = options.forceRefresh ? undefined : loadCachedRepoList(trimmed) ?? undefined;

      try {
        const result = await client.listPublicReposWithRevalidation(trimmed, {
          persisted,
          onProgress: (snapshot) => {
            setProgress({
              page: snapshot.page,
              loadedCount: snapshot.accumulatedCount,
            });
          },
        });

        if (result.fullyRevalidated && persisted) {
          // Every page returned 304 — keep the cached body, just refresh fetchedAt.
          touchCachedRepoListFreshness(trimmed);
        } else {
          saveCachedRepoList(trimmed, result.repos, result.pageEtags);
        }

        setRepos(result.repos);
        setCacheAge(new Date().toISOString());
        setStatus('success');
        return result.repos;
      } catch (error) {
        const message =
          error instanceof GitHubApiError
            ? error.details.message
            : 'Unable to load GitHub repositories.';
        setErrorMessage(message);
        setStatus('error');
        throw error;
      }
    },
    [client],
  );

  return {
    status,
    repos,
    errorMessage,
    progress,
    cacheAge,
    fetchRepos,
  };
}
