import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  beginGitHubOAuth,
  completeGitHubOAuthFromUrl,
  getStoredGitHubSession,
  logoutGitHubOAuth,
  type GitHubAuthSession,
} from '@/github/auth';
import { GitHubApiError, createGitHubApiClient } from '@/github/api';
import type { GitHubUserSummary } from '@/github/types';
import { useSessionStore } from '@/store/sessionStore';

export type GitHubAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface UseGitHubAuthResult {
  status: GitHubAuthStatus;
  session: GitHubAuthSession | null;
  user: GitHubUserSummary | null;
  errorMessage: string | null;
  beginLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useGitHubAuth(): UseGitHubAuthResult {
  const setAuthenticated = useSessionStore((state) => state.setAuthenticated);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);

  const [status, setStatus] = useState<GitHubAuthStatus>('loading');
  const [session, setSession] = useState<GitHubAuthSession | null>(null);
  const [user, setUser] = useState<GitHubUserSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hydrateSession = useCallback(
    async (sourceSession: GitHubAuthSession | null): Promise<void> => {
      if (!sourceSession) {
        setSession(null);
        setUser(null);
        setAuthenticated(false);
        setStatus('unauthenticated');
        return;
      }

      setSession(sourceSession);
      setAuthenticated(true);
      const client = createGitHubApiClient({ authToken: sourceSession.accessToken });

      try {
        const currentUser = await client.getAuthenticatedUser();
        setUser(currentUser);
        setUsernameInput(currentUser.login);
        setStatus('authenticated');
      } catch (error) {
        const message = error instanceof GitHubApiError ? error.details.message : 'Unable to load authenticated user.';
        setErrorMessage(message);
        setStatus('error');
      }
    },
    [setAuthenticated, setUsernameInput],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeAuthState(): Promise<void> {
      try {
        const callbackResult = await completeGitHubOAuthFromUrl(window.location.href);
        if (callbackResult) {
          window.history.replaceState({}, '', callbackResult.clearUrl);
          if (cancelled) {
            return;
          }
          await hydrateSession(callbackResult.session);
          return;
        }

        const storedSession = await getStoredGitHubSession();
        if (cancelled) {
          return;
        }
        await hydrateSession(storedSession);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatus('error');
        setErrorMessage(formatGitHubAuthErrorMessage(error));
      }
    }

    void initializeAuthState();

    return () => {
      cancelled = true;
    };
  }, [hydrateSession]);

  const beginLogin = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    try {
      const authUrl = await beginGitHubOAuth();
      window.location.assign(authUrl);
    } catch (error) {
      setStatus('error');
      setErrorMessage(formatGitHubAuthErrorMessage(error));
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await logoutGitHubOAuth();
    setSession(null);
    setUser(null);
    setAuthenticated(false);
    setStatus('unauthenticated');
    setErrorMessage(null);
  }, [setAuthenticated]);

  return useMemo(
    () => ({
      status,
      session,
      user,
      errorMessage,
      beginLogin,
      logout,
    }),
    [beginLogin, errorMessage, logout, session, status, user],
  );
}

export function formatGitHubAuthErrorMessage(error: unknown): string {
  const fallback = 'Unable to start GitHub login.';

  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.includes('Missing VITE_GITHUB_CLIENT_ID')) {
    return 'GitHub login is not configured for this build yet. If you are running locally, add the GitHub OAuth client ID to .env.local. If you are using the deployed site, the site owner needs to configure GitHub OAuth for this deployment. You can still load public repositories by username.';
  }

  if (error.message.includes('GitHub OAuth code exchange is not configured for this build.')) {
    return 'GitHub sign-in reached the callback step, but this build does not have a token exchange path configured yet. For browser builds, set VITE_GITHUB_TOKEN_EXCHANGE_URL to a server-side or serverless exchange endpoint. For Electron, launch the app with GITHUB_CLIENT_SECRET set. You can still load public repositories by username.';
  }

  if (error.message.includes('Missing GITHUB_CLIENT_SECRET')) {
    return 'Electron GitHub login needs the GITHUB_CLIENT_SECRET environment variable so the desktop app can exchange the OAuth code securely in the main process. You can still load public repositories by username.';
  }

  if (error.message.includes('Bad credentials')) {
    return 'GitHub rejected the OAuth app credentials during token exchange. Make sure GITHUB_CLIENT_SECRET comes from the same OAuth app as VITE_GITHUB_CLIENT_ID. For local testing, use the client secret from your repo-dungeon-local OAuth app, not the GitHub Pages app.';
  }

  if (
    error.message.includes('NetworkError when attempting to fetch resource.') ||
    error.message.includes('Failed to fetch')
  ) {
    return 'GitHub approved the sign-in request, but the configured token exchange endpoint could not be reached. Check that your auth proxy or serverless exchange endpoint is running and that VITE_GITHUB_TOKEN_EXCHANGE_URL points to it. You can still load public repositories by username today.';
  }

  return error.message || fallback;
}
