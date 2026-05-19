import { useState } from 'react';
import { useGitHubAuth } from '@/ui/hooks/useGitHubAuth';
import { useGitHubData } from '@/ui/hooks/useGitHubData';
import { useSessionStore } from '@/store/sessionStore';

export function GitHubAuthPanel() {
  const usernameInput = useSessionStore((state) => state.usernameInput);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const auth = useGitHubAuth();
  const data = useGitHubData(auth.session?.accessToken);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);

  async function handlePublicFetch(): Promise<void> {
    setLastFetchError(null);
    try {
      await data.fetchReposForUsername(usernameInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load repositories.';
      setLastFetchError(message);
    }
  }

  async function handleAuthenticatedFetch(): Promise<void> {
    setLastFetchError(null);
    try {
      await data.fetchReposForAuthenticatedUser();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load repositories.';
      setLastFetchError(message);
    }
  }

  return (
    <section className="auth-panel" aria-label="GitHub connection panel">
      <label htmlFor="github-username">GitHub Username</label>
      <input
        id="github-username"
        value={usernameInput}
        onChange={(event) => {
          setUsernameInput(event.target.value);
        }}
        placeholder="octocat"
        autoComplete="off"
      />
      <div className="auth-actions">
        <button type="button" onClick={() => void handlePublicFetch()} disabled={!usernameInput || data.status === 'loading'}>
          Load Public Repos
        </button>
        {auth.status === 'authenticated' ? (
          <>
            <button type="button" onClick={() => void handleAuthenticatedFetch()} disabled={data.status === 'loading'}>
              Load My Repos
            </button>
            <button type="button" onClick={() => void auth.logout()}>
              Logout
            </button>
          </>
        ) : (
          <button type="button" onClick={() => void auth.beginLogin()}>
            Login with GitHub
          </button>
        )}
      </div>

      <p className="auth-meta">
        Auth: {auth.status}
        {auth.user ? ` (${auth.user.login})` : ''}
      </p>
      {data.progress && data.status === 'loading' ? (
        <p className="auth-meta">Loading page {data.progress.page} — {data.progress.loadedCount} repos</p>
      ) : null}
      <p className="auth-meta">Loaded repos: {data.repos.length}</p>

      {auth.errorMessage ? <p className="auth-error">{auth.errorMessage}</p> : null}
      {data.errorMessage ? <p className="auth-error">{data.errorMessage}</p> : null}
      {lastFetchError ? <p className="auth-error">{lastFetchError}</p> : null}
      {data.shouldPromptLogin ? <p className="auth-error">Rate limit reached. Authenticate to continue.</p> : null}
    </section>
  );
}
