import { afterEach, describe, expect, it } from 'vitest';
import { electronLocalRepoAccess } from '@/localRepos/electronAccess';

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
  });
});

describe('electron local repo access launch wrapper', () => {
  it('returns an unavailable result when bridge is missing', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
    });

    const result = await electronLocalRepoAccess.openPath({
      rootPathToken: 'electron://root-token',
      repositoryPathToken: 'repo-a',
      mode: 'system-default',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/unavailable/i);
  });

  it('forwards launch requests to preload bridge', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        electronLocalRepos: {
          pickParentFolder: async () => null,
          scanParentFolder: async () => {
            throw new Error('not expected');
          },
          subscribeScanProgress: () => () => {},
          loadReadme: async () => ({
            readme: {
              fileName: 'README.md',
              plainText: 'hello',
              truncated: false,
            },
            unavailableReason: null,
          }),
          openPath: async () => ({
            ok: true,
            mode: 'preferred-editor',
            fallbackUsed: false,
            message: null,
          }),
        },
      },
      configurable: true,
    });

    const result = await electronLocalRepoAccess.openPath({
      rootPathToken: 'electron://root-token',
      repositoryPathToken: 'repo-a',
      targetPathToken: 'src',
      mode: 'preferred-editor',
      preferredEditor: {
        command: 'code',
        args: ['--reuse-window'],
      },
    });

    expect(result).toEqual({
      ok: true,
      mode: 'preferred-editor',
      fallbackUsed: false,
      message: null,
    });
  });

  it('returns unavailable README result when bridge is missing', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
    });

    const result = await electronLocalRepoAccess.loadReadme({
      rootPathToken: 'electron://root-token',
      repositoryPathToken: 'repo-a',
    });

    expect(result.readme).toBeNull();
    expect(result.unavailableReason).toMatch(/unavailable/i);
  });
});
