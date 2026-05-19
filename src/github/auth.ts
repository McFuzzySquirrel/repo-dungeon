const TOKEN_STORAGE_KEY = 'repo-dungeon:v1:github:auth';
const OAUTH_STATE_KEY = 'repo-dungeon:v1:github:oauth-state';
const OAUTH_VERIFIER_KEY = 'repo-dungeon:v1:github:oauth-verifier';

const DEFAULT_SCOPE = 'read:user repo';

export interface GitHubAuthSession {
  accessToken: string;
  tokenType: string;
  scope: string[];
  createdAt: string;
}

interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface TokenStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface OAuthStartOptions {
  redirectUri?: string;
  scope?: string;
}

export interface OAuthCompleteResult {
  session: GitHubAuthSession;
  clearUrl: string;
}

interface ElectronSecureStorageApi {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

declare global {
  interface Window {
    electronSecureStorage?: ElectronSecureStorageApi;
  }
}

export function createTokenStorageAdapter(): TokenStorageAdapter {
  if (typeof window !== 'undefined' && window.electronSecureStorage) {
    return window.electronSecureStorage;
  }

  return {
    getItem(key: string): Promise<string | null> {
      if (typeof window === 'undefined') {
        return Promise.resolve(null);
      }
      return Promise.resolve(window.localStorage.getItem(key));
    },
    setItem(key: string, value: string): Promise<void> {
      if (typeof window === 'undefined') {
        return Promise.resolve();
      }
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem(key: string): Promise<void> {
      if (typeof window === 'undefined') {
        return Promise.resolve();
      }
      window.localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
}

export async function getStoredGitHubSession(storage: TokenStorageAdapter = createTokenStorageAdapter()): Promise<GitHubAuthSession | null> {
  const raw = await storage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as GitHubAuthSession;
    if (!parsed.accessToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearGitHubSession(storage: TokenStorageAdapter = createTokenStorageAdapter()): Promise<void> {
  await storage.removeItem(TOKEN_STORAGE_KEY);
}

export async function beginGitHubOAuth(options: OAuthStartOptions = {}): Promise<string> {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing VITE_GITHUB_CLIENT_ID environment variable.');
  }

  const redirectUri = options.redirectUri ?? import.meta.env.VITE_GITHUB_REDIRECT_URI ?? window.location.origin;
  const scope = options.scope ?? import.meta.env.VITE_GITHUB_OAUTH_SCOPE ?? DEFAULT_SCOPE;

  const state = createRandomString(24);
  const codeVerifier = createRandomString(64);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  window.sessionStorage.setItem(OAUTH_STATE_KEY, state);
  window.sessionStorage.setItem(OAUTH_VERIFIER_KEY, codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function completeGitHubOAuthFromUrl(
  callbackUrl: string,
  storage: TokenStorageAdapter = createTokenStorageAdapter(),
): Promise<OAuthCompleteResult | null> {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return null;
  }

  const expectedState = window.sessionStorage.getItem(OAUTH_STATE_KEY);
  const codeVerifier = window.sessionStorage.getItem(OAUTH_VERIFIER_KEY);
  if (!expectedState || expectedState !== state || !codeVerifier) {
    throw new Error('OAuth state verification failed.');
  }

  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing VITE_GITHUB_CLIENT_ID environment variable.');
  }

  const tokenResponse = await fetchToken({
    clientId,
    code,
    codeVerifier,
    redirectUri: import.meta.env.VITE_GITHUB_REDIRECT_URI ?? window.location.origin,
  });

  if (!tokenResponse.access_token) {
    const reason = tokenResponse.error_description ?? tokenResponse.error ?? 'Token exchange failed.';
    throw new Error(reason);
  }

  const session: GitHubAuthSession = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type ?? 'bearer',
    scope: tokenResponse.scope ? tokenResponse.scope.split(',').map((item) => item.trim()).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
  };

  await storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(session));
  window.sessionStorage.removeItem(OAUTH_STATE_KEY);
  window.sessionStorage.removeItem(OAUTH_VERIFIER_KEY);

  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');

  return {
    session,
    clearUrl: url.toString(),
  };
}

export async function logoutGitHubOAuth(storage: TokenStorageAdapter = createTokenStorageAdapter()): Promise<void> {
  await clearGitHubSession(storage);
  window.sessionStorage.removeItem(OAUTH_STATE_KEY);
  window.sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
}

async function fetchToken(options: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokenResponse> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: options.clientId,
      code: options.code,
      code_verifier: options.codeVerifier,
      redirect_uri: options.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed (${response.status}).`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return base64UrlEncode(new Uint8Array(digest));
}

function createRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(input: Uint8Array): string {
  let base64: string;
  if (typeof btoa === 'function') {
    let binary = '';
    input.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    base64 = btoa(binary);
  } else {
    // btoa with Uint8Array fallback for environments without btoa
    let binary = '';
    input.forEach((value) => { binary += String.fromCharCode(value); });
    base64 = btoa(binary);
  }

  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
