import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeGitHubOAuthCode } from '@/github/auth';

describe('exchangeGitHubOAuthCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as Window & { electronGitHubOAuth?: unknown }).electronGitHubOAuth;
  });

  it('uses the Electron bridge when available', async () => {
    const exchangeCode = vi.fn().mockResolvedValue({
      access_token: 'token',
      token_type: 'bearer',
      scope: 'read:user,repo',
    });
    window.electronGitHubOAuth = { exchangeCode };
    const fetchSpy = vi.spyOn(window, 'fetch');

    const result = await exchangeGitHubOAuthCode({
      clientId: 'client-id',
      code: 'oauth-code',
      codeVerifier: 'verifier',
      redirectUri: 'http://localhost:5173/',
    });

    expect(exchangeCode).toHaveBeenCalledWith({
      clientId: 'client-id',
      code: 'oauth-code',
      codeVerifier: 'verifier',
      redirectUri: 'http://localhost:5173/',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.access_token).toBe('token');
  });

  it('uses the configured exchange endpoint on web builds', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'token', token_type: 'bearer', scope: 'repo' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await exchangeGitHubOAuthCode({
      clientId: 'client-id',
      code: 'oauth-code',
      codeVerifier: 'verifier',
      redirectUri: 'https://mcfuzzysquirrel.github.io/repo-dungeon/',
      exchangeUrl: 'https://auth.example.com/api/github/oauth/exchange',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://auth.example.com/api/github/oauth/exchange',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.access_token).toBe('token');
  });

  it('fails clearly when no exchange strategy is configured', async () => {
    await expect(
      exchangeGitHubOAuthCode({
        clientId: 'client-id',
        code: 'oauth-code',
        codeVerifier: 'verifier',
        redirectUri: 'http://localhost:5173/',
      }),
    ).rejects.toThrow('GitHub OAuth code exchange is not configured for this build.');
  });
});