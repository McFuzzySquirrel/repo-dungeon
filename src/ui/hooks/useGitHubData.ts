import { useCallback, useMemo, useState } from 'react';
import { GitHubApiError, createGitHubApiClient } from '@/github/api';
import {
  clearCachedRepoList,
  isRepoListFresh,
  loadCachedRepoList,
  saveCachedRepoList,
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

      try {
        const results = await client.listPublicRepos(trimmed, {
          onProgress: (snapshot) => {
            setProgress({
              page: snapshot.page,
              loadedCount: snapshot.accumulatedCount,
            });
          },
        });
        saveCachedRepoList(trimmed, results);
        setRepos(results);
        setCacheAge(new Date().toISOString());
        setStatus('success');
        return results;
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
