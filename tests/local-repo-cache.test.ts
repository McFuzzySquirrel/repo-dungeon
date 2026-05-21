import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocalScanCache,
  clearLocalSourceSelection,
  loadLocalScanCache,
  loadLocalSourceSelection,
  saveLocalScanCache,
  saveLocalSourceSelection,
} from '@/localRepos/cache';
import type { LocalRepoScanResult, LocalSourceSelection } from '@/localRepos/types';

describe('local repo cache helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and restores the selected local source', () => {
    const selection: LocalSourceSelection = {
      rootPathToken: 'electron://abc123',
      rootLabel: 'workspace',
      rootId: 'electron://abc123',
      pickedAt: new Date().toISOString(),
    };

    saveLocalSourceSelection(selection);
    expect(loadLocalSourceSelection()).toEqual(selection);

    clearLocalSourceSelection();
    expect(loadLocalSourceSelection()).toBeNull();
  });

  it('persists and restores scan cache snapshots for the same machine root id', () => {
    const selection: LocalSourceSelection = {
      rootPathToken: 'electron://abc123',
      rootLabel: 'workspace',
      rootId: 'electron://abc123',
      pickedAt: new Date().toISOString(),
    };
    const scan: LocalRepoScanResult = {
      rootPathToken: selection.rootPathToken,
      rootLabel: selection.rootLabel,
      scannedAt: new Date().toISOString(),
      ignoredFolders: ['.git', 'node_modules'],
      repositories: [],
    };

    saveLocalScanCache(selection, scan);
    const restored = loadLocalScanCache(selection.rootId);

    expect(restored?.schemaVersion).toBe(1);
    expect(restored?.source.rootId).toBe(selection.rootId);
    expect(restored?.scan.rootPathToken).toBe(selection.rootPathToken);

    clearLocalScanCache(selection.rootId);
    expect(loadLocalScanCache(selection.rootId)).toBeNull();
  });
});