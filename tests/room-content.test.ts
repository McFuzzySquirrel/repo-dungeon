import { describe, expect, it } from 'vitest';
import {
  buildContributorNPCData,
  buildRoomObjectBlueprints,
  createDeterministicOffsets,
} from '@/game/entities/roomContent';
import type { DungeonRoomNode } from '@/game/systems/dungeonTypes';

const repoRoom: DungeonRoomNode = {
  id: 'room:repo:1',
  type: 'repo',
  zoneId: 'zone:typescript',
  name: 'Repo Room',
  position: { x: 100, y: 120 },
  size: { width: 140, height: 100 },
  repo: {
    id: 1,
    name: 'repo-dungeon',
    fullName: 'octocat/repo-dungeon',
    ownerLogin: 'octocat',
    description: 'Test',
    htmlUrl: 'https://github.com/octocat/repo-dungeon',
    language: 'TypeScript',
    stargazersCount: 20,
    forksCount: 5,
    topics: ['game'],
    isPrivate: false,
    defaultBranch: 'main',
  },
};

describe('room content scaffolding', () => {
  it('creates all three interactable room object blueprints', () => {
    const objects = buildRoomObjectBlueprints(repoRoom);
    expect(objects).toHaveLength(3);
    expect(objects.map((obj) => obj.objectType)).toEqual([
      'readme-scroll',
      'file-tree-archive',
      'contributors-gallery',
    ]);
  });

  it('creates deterministic contributor npc data for a repo room', () => {
    const first = buildContributorNPCData(repoRoom);
    const second = buildContributorNPCData(repoRoom);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first[0].login).toBe('octocat');
  });

  it('deterministically generates offset cycles from a seed', () => {
    const offsetsA = createDeterministicOffsets('seed-1', 4, 20);
    const offsetsB = createDeterministicOffsets('seed-1', 4, 20);
    const offsetsC = createDeterministicOffsets('seed-2', 4, 20);

    expect(offsetsA).toEqual(offsetsB);
    expect(offsetsA).not.toEqual(offsetsC);
  });
});
