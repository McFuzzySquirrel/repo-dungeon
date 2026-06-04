import { describe, expect, it } from 'vitest';
import {
  getDungeonRestoreKeys,
  getProgressionRestoreKeys,
  getRoomDetailRestoreKeys,
  STORAGE_KEYS,
} from '@/store/persistence';

describe('STORAGE_KEYS', () => {
  it('creates deterministic, lower-cased dungeon keys', () => {
    expect(STORAGE_KEYS.dungeonForUser('McFuzzySquirrel')).toBe('repo-dungeon:v1:dungeon:mcfuzzysquirrel');
  });

  it('creates source-aware keys for github and local identities', () => {
    expect(STORAGE_KEYS.dungeonForSource({ kind: 'github', username: 'McFuzzySquirrel' })).toBe(
      'repo-dungeon:v1:dungeon:github:mcfuzzysquirrel',
    );
    expect(STORAGE_KEYS.dungeonForSource({ kind: 'local', rootId: 'Workstation/Repos' })).toBe(
      'repo-dungeon:v1:dungeon:local:workstation%2Frepos',
    );
  });

  it('returns github restore keys with legacy fallback ordering', () => {
    expect(getDungeonRestoreKeys({ kind: 'github', username: 'McFuzzySquirrel' })).toEqual([
      'repo-dungeon:v1:dungeon:github:mcfuzzysquirrel',
      'repo-dungeon:v1:dungeon:mcfuzzysquirrel',
    ]);

    expect(getRoomDetailRestoreKeys({ kind: 'github', username: 'McFuzzySquirrel' }, 'Owner', 'Repo')).toEqual([
      'repo-dungeon:v1:room:github:mcfuzzysquirrel:owner:repo',
      'repo-dungeon:v1:room:owner:repo',
    ]);

    expect(getProgressionRestoreKeys({ kind: 'github', username: 'McFuzzySquirrel' })).toEqual([
      'repo-dungeon:v1:progression:github:mcfuzzysquirrel',
      'repo-dungeon:v1:progression',
    ]);
  });

  it('returns local restore keys without github legacy fallback', () => {
    expect(getDungeonRestoreKeys({ kind: 'local', rootId: 'workstation/repos' })).toEqual([
      'repo-dungeon:v1:dungeon:local:workstation%2Frepos',
    ]);

    expect(getRoomDetailRestoreKeys({ kind: 'local', rootId: 'workstation/repos' }, 'owner', 'repo')).toEqual([
      'repo-dungeon:v1:room:local:workstation%2Frepos:owner:repo',
    ]);

    expect(getProgressionRestoreKeys({ kind: 'local', rootId: 'workstation/repos' })).toEqual([
      'repo-dungeon:v1:progression:local:workstation%2Frepos',
    ]);
  });
});
