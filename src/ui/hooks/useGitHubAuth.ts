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
        setErrorMessage(error instanceof Error ? error.message : 'Authentication failed.');
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
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start GitHub login.');
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
