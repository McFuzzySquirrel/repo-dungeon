import { describe, expect, it } from 'vitest';
import { resolveAssetPath } from '@/game/config/assetPaths';

describe('resolveAssetPath', () => {
  it('resolves against the runtime document base URI when available', () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      value: {
        baseURI: 'https://example.com/repo-dungeon/index.html',
      },
      configurable: true,
    });

    try {
      expect(resolveAssetPath('/assets/sprites/player.svg')).toBe('https://example.com/repo-dungeon/assets/sprites/player.svg');
    } finally {
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        configurable: true,
      });
    }
  });
});
