import { describe, expect, it } from 'vitest';
import { DungeonGenerator } from '@/game/systems/DungeonGenerator';
import type { GitHubRepoSummary } from '@/github/types';

function makeRepo(
  index: number,
  overrides: Partial<Pick<GitHubRepoSummary, 'language' | 'topics' | 'name'>> = {},
): GitHubRepoSummary {
  const name = overrides.name ?? `repo-${index}`;
  const language = Object.prototype.hasOwnProperty.call(overrides, 'language') ? (overrides.language ?? null) : 'TypeScript';
  return {
    id: index,
    name,
    fullName: `octocat/${name}`,
    ownerLogin: 'octocat',
    description: null,
    htmlUrl: `https://github.com/octocat/${name}`,
    language,
    stargazersCount: index,
    forksCount: 0,
    topics: overrides.topics ?? ['demo'],
    isPrivate: false,
    defaultBranch: 'main',
  };
}

describe('DungeonGenerator', () => {
  it('is deterministic for same seed + repos regardless of input ordering', () => {
    const repos = [makeRepo(1), makeRepo(2, { language: 'Python' }), makeRepo(3, { language: 'Rust' })];
    const shuffledRepos = [repos[2], repos[0], repos[1]];
    const generator = new DungeonGenerator();

    const first = generator.generate(repos, { seed: 'same-seed' });
    const second = generator.generate(shuffledRepos, { seed: 'same-seed' });

    expect(projectLayout(first)).toEqual(projectLayout(second));
  });

  it('groups repos by language and falls back to first topic or miscellaneous', () => {
    const repos = [
      makeRepo(1, { language: 'TypeScript', topics: ['web'] }),
      makeRepo(2, { language: null, topics: ['ops-tooling'] }),
      makeRepo(3, { language: null, topics: [] }),
    ];
    const generator = new DungeonGenerator();
    const dungeon = generator.generate(repos, { seed: 'zones' });

    const byLabel = new Map(dungeon.zones.map((zone) => [zone.label, zone]));
    expect(byLabel.has('TypeScript')).toBe(true);
    expect(byLabel.has('Ops Tooling')).toBe(true);
    expect(byLabel.has('Miscellaneous')).toBe(true);
  });

  it('creates exactly one repo room per repository and places a profile room entrance', () => {
    const repos = Array.from({ length: 9 }, (_, index) => makeRepo(index + 1, { language: index % 2 ? 'Go' : 'Rust' }));
    const generator = new DungeonGenerator();
    const dungeon = generator.generate(repos, { seed: 'room-count' });

    const repoRooms = dungeon.rooms.filter((room) => room.type === 'repo');
    const profileRooms = dungeon.rooms.filter((room) => room.type === 'profile');

    expect(repoRooms).toHaveLength(repos.length);
    expect(new Set(repoRooms.map((room) => room.repo?.id)).size).toBe(repos.length);
    expect(profileRooms).toHaveLength(1);
    expect(dungeon.entranceRoomId).toBe(profileRooms[0].id);
  });

  it('connects all zones and repo rooms through corridors and gateways', () => {
    const repos = [
      makeRepo(1, { language: 'TypeScript' }),
      makeRepo(2, { language: 'TypeScript' }),
      makeRepo(3, { language: 'Python' }),
      makeRepo(4, { language: null, topics: ['data-pipelines'] }),
      makeRepo(5, { language: null, topics: [] }),
    ];
    const generator = new DungeonGenerator();
    const dungeon = generator.generate(repos, { seed: 'connectivity' });

    dungeon.zones.forEach((zone) => {
      const corridorCount = dungeon.edges.filter(
        (edge) =>
          edge.type === 'corridor' &&
          [edge.fromRoomId, edge.toRoomId].some((roomId) => roomId.startsWith(`room:gateway:${zone.id}`)),
      ).length;
      expect(corridorCount).toBeGreaterThan(0);
    });

    const adjacency = new Map<string, Set<string>>();
    dungeon.rooms.forEach((room) => {
      adjacency.set(room.id, new Set());
    });
    dungeon.edges.forEach((edge) => {
      adjacency.get(edge.fromRoomId)?.add(edge.toRoomId);
      adjacency.get(edge.toRoomId)?.add(edge.fromRoomId);
    });

    const visited = new Set<string>();
    const queue = [dungeon.entranceRoomId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    const roomIds = dungeon.rooms.map((room) => room.id);
    roomIds.forEach((roomId) => {
      expect(visited.has(roomId)).toBe(true);
    });
  });
});

function projectLayout(dungeon: ReturnType<DungeonGenerator['generate']>) {
  return {
    width: dungeon.width,
    height: dungeon.height,
    entranceRoomId: dungeon.entranceRoomId,
    zones: dungeon.zones.map((zone) => ({
      id: zone.id,
      key: zone.key,
      label: zone.label,
      roomIds: zone.roomIds,
      gatewayRoomId: zone.gatewayRoomId,
      bounds: zone.bounds,
    })),
    rooms: dungeon.rooms.map((room) => ({
      id: room.id,
      type: room.type,
      zoneId: room.zoneId,
      name: room.name,
      position: room.position,
      size: room.size,
      repoId: room.repo?.id,
    })),
    edges: dungeon.edges.map((edge) => ({
      id: edge.id,
      type: edge.type,
      fromRoomId: edge.fromRoomId,
      toRoomId: edge.toRoomId,
    })),
    seed: dungeon.metadata.seed,
    numericSeed: dungeon.metadata.numericSeed,
  };
}
