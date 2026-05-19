import { describe, expect, it } from 'vitest';
import { formatGitHubAuthErrorMessage } from '@/ui/hooks/useGitHubAuth';

describe('formatGitHubAuthErrorMessage', () => {
  it('maps missing OAuth client ID errors to a friendly setup message', () => {
    const message = formatGitHubAuthErrorMessage(
      new Error('Missing VITE_GITHUB_CLIENT_ID environment variable.'),
    );

    expect(message).toContain('GitHub login is not configured for this build yet.');
    expect(message).toContain('.env.local');
    expect(message).toContain('site owner needs to configure GitHub OAuth');
    expect(message).toContain('load public repositories by username');
  });

  it('falls back to the original error message for other auth failures', () => {
    expect(formatGitHubAuthErrorMessage(new Error('OAuth state verification failed.')))
      .toBe('OAuth state verification failed.');
  });

  it('maps browser token exchange failures to a server-side OAuth guidance message', () => {
    const message = formatGitHubAuthErrorMessage(
      new Error('NetworkError when attempting to fetch resource.'),
    );

    expect(message).toContain('GitHub approved the sign-in request');
    expect(message).toContain('configured token exchange endpoint could not be reached');
    expect(message).toContain('VITE_GITHUB_TOKEN_EXCHANGE_URL');
    expect(message).toContain('load public repositories by username');
  });

  it('maps missing exchange strategy errors to setup guidance for web and Electron', () => {
    const message = formatGitHubAuthErrorMessage(
      new Error('GitHub OAuth code exchange is not configured for this build.'),
    );

    expect(message).toContain('token exchange path configured yet');
    expect(message).toContain('VITE_GITHUB_TOKEN_EXCHANGE_URL');
    expect(message).toContain('GITHUB_CLIENT_SECRET');
  });

  it('maps bad credentials to a client-id and client-secret mismatch message', () => {
    const message = formatGitHubAuthErrorMessage(new Error('Bad credentials'));

    expect(message).toContain('OAuth app credentials during token exchange');
    expect(message).toContain('same OAuth app as VITE_GITHUB_CLIENT_ID');
    expect(message).toContain('repo-dungeon-local');
    expect(message).toContain('GitHub Pages app');
  });
});