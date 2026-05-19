import { useCallback, useMemo, useState } from 'react';
import { GitHubApiError, createGitHubApiClient } from '@/github/api';
import type { GitHubRepoSummary } from '@/github/types';

type DataStatus = 'idle' | 'loading' | 'success' | 'error';

interface RepoFetchProgress {
  page: number;
  loadedCount: number;
}

interface UseGitHubDataResult {
  status: DataStatus;
  repos: GitHubRepoSummary[];
  errorMessage: string | null;
  shouldPromptLogin: boolean;
  progress: RepoFetchProgress | null;
  fetchReposForUsername: (username: string) => Promise<GitHubRepoSummary[]>;
  fetchReposForAuthenticatedUser: () => Promise<GitHubRepoSummary[]>;
}

export function useGitHubData(authToken?: string): UseGitHubDataResult {
  const [status, setStatus] = useState<DataStatus>('idle');
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shouldPromptLogin, setShouldPromptLogin] = useState(false);
  const [progress, setProgress] = useState<RepoFetchProgress | null>(null);

  const client = useMemo(() => createGitHubApiClient({ authToken }), [authToken]);

  const resetTransientState = useCallback(() => {
    setStatus('loading');
    setErrorMessage(null);
    setShouldPromptLogin(false);
    setProgress({ page: 0, loadedCount: 0 });
  }, []);

  const fetchReposForUsername = useCallback(
    async (username: string): Promise<GitHubRepoSummary[]> => {
      resetTransientState();
      try {
        const results = await client.listPublicRepos(username, {
          onProgress: (snapshot) => {
            setProgress({
              page: snapshot.page,
              loadedCount: snapshot.accumulatedCount,
            });
          },
        });
        setRepos(results);
        setStatus('success');
        return results;
      } catch (error) {
        handleError(error, setErrorMessage, setShouldPromptLogin, setStatus);
        throw error;
      }
    },
    [client, resetTransientState],
  );

  const fetchReposForAuthenticatedUser = useCallback(async (): Promise<GitHubRepoSummary[]> => {
    resetTransientState();
    try {
      const results = await client.listAuthenticatedRepos({
        onProgress: (snapshot) => {
          setProgress({
            page: snapshot.page,
            loadedCount: snapshot.accumulatedCount,
          });
        },
      });
      setRepos(results);
      setStatus('success');
      return results;
    } catch (error) {
      handleError(error, setErrorMessage, setShouldPromptLogin, setStatus);
      throw error;
    }
  }, [client, resetTransientState]);

  return {
    status,
    repos,
    errorMessage,
    shouldPromptLogin,
    progress,
    fetchReposForUsername,
    fetchReposForAuthenticatedUser,
  };
}

function handleError(
  error: unknown,
  setErrorMessage: (message: string) => void,
  setShouldPromptLogin: (value: boolean) => void,
  setStatus: (status: DataStatus) => void,
): void {
  if (error instanceof GitHubApiError) {
    setErrorMessage(error.details.message);
    setShouldPromptLogin(error.details.shouldPromptLogin);
  } else {
    setErrorMessage('Unable to load GitHub repositories.');
    setShouldPromptLogin(false);
  }
  setStatus('error');
}
