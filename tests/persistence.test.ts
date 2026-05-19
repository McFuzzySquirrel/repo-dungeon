import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/store/persistence';

describe('STORAGE_KEYS', () => {
  it('creates deterministic, lower-cased dungeon keys', () => {
    expect(STORAGE_KEYS.dungeonForUser('McFuzzySquirrel')).toBe('repo-dungeon:v1:dungeon:mcfuzzysquirrel');
  });
});
