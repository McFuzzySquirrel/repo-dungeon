import { afterEach, describe, expect, it } from 'vitest';
import { getLocalRepoAccessState, trustedLocalBrowserAccess } from '@/localRepos/browserAccess';

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
  });
});

describe('getLocalRepoAccessState', () => {
  it('allows trusted localhost web origins', () => {
    const state = getLocalRepoAccessState();

    // Vitest/jsdom runs on localhost by default, which should be trusted.
    expect(state.isLocalRepoModeAvailable).toBe(true);
    expect(state.environment === 'trusted-local-web' || state.environment === 'electron').toBe(true);
  });

  it('returns a clear hosted-web explanation for untrusted origins', () => {
    const fakeWindow = {
      navigator: { userAgent: 'Mozilla/5.0' },
      location: {
        protocol: 'https:',
        hostname: 'repo-dungeon.github.io',
      },
    } as Window;

    Object.defineProperty(globalThis, 'window', {
      value: fakeWindow,
      configurable: true,
    });

    try {
      const state = getLocalRepoAccessState();

      expect(state.isLocalRepoModeAvailable).toBe(false);
      expect(state.environment).toBe('hosted-web');
      expect(state.reason).toMatch(/disabled on hosted builds/i);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    }
  });

  it('maps intercepted directory picker failures to a friendly local-mode message', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        navigator: { userAgent: 'Mozilla/5.0' },
        location: {
          protocol: 'http:',
          hostname: '127.0.0.1',
        },
        showDirectoryPicker: () => Promise.reject(
          new Error("Failed to execute 'showDirectoryPicker' on 'Window': Intercepted by Page.setInterceptFileChooserDialog()."),
        ),
      },
      configurable: true,
    });

    await expect(trustedLocalBrowserAccess.pickParentFolder()).rejects.toThrow(
      /unavailable in this browser session/i,
    );
  });
});
