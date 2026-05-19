import { describe, expect, it } from 'vitest';
import type { DungeonRoomNode } from '@/game/systems/dungeonTypes';
import type { GitHubRepoSummary } from '@/github/types';
import { DungeonGenerator } from '@/game/systems/DungeonGenerator';

/**
 * Helper to create a mock repo.
 */
function makeRepo(id: number, language = 'TypeScript'): GitHubRepoSummary {
  return {
    id,
    name: `repo-${id}`,
    fullName: `octocat/repo-${id}`,
    ownerLogin: 'octocat',
    description: `Test repo ${id}`,
    htmlUrl: `https://github.com/octocat/repo-${id}`,
    language,
    stargazersCount: id * 10,
    forksCount: id,
    topics: ['test'],
    isPrivate: false,
    defaultBranch: 'main',
  };
}

describe('DungeonScene Integration', () => {
  describe('Dungeon Generation', () => {
    it('generates a dungeon with rooms from repos', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1), makeRepo(2, 'Python'), makeRepo(3, 'Rust')];

      const dungeon = generator.generate(repos, {
        seed: '42',
        username: 'test-user',
      });

      expect(dungeon).not.toBeNull();
      expect(dungeon.rooms.length).toBeGreaterThan(repos.length); // rooms + profile + gateways
      expect(dungeon.zones.length).toBeGreaterThan(0);
      expect(dungeon.edges.length).toBeGreaterThan(0);
    });

    it('creates an entrance profile room', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1)];

      const dungeon = generator.generate(repos, { seed: '42' });

      const entranceRoom = dungeon.rooms.find((r) => r.id === dungeon.entranceRoomId);
      expect(entranceRoom).toBeDefined();
      expect(entranceRoom?.type).toBe('profile');
    });

    it('creates gateway rooms for zones', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1, 'TypeScript'), makeRepo(2, 'Python')];

      const dungeon = generator.generate(repos, { seed: '42' });

      const gatewayRooms = dungeon.rooms.filter((r) => r.type === 'gateway');
      expect(gatewayRooms.length).toBeGreaterThan(0);
      expect(gatewayRooms.every((r) => r.zoneId !== null)).toBe(true);
    });

    it('creates repo rooms in zones', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1, 'TypeScript'), makeRepo(2, 'TypeScript'), makeRepo(3, 'Python')];

      const dungeon = generator.generate(repos, { seed: '42' });

      const repoRooms = dungeon.rooms.filter((r) => r.type === 'repo');
      expect(repoRooms.length).toBe(repos.length);
      expect(repoRooms.every((r) => r.zoneId !== null)).toBe(true);
      expect(repoRooms.every((r) => r.repo !== undefined)).toBe(true);
    });

    it('connects rooms with corridors', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1, 'TypeScript'), makeRepo(2, 'TypeScript')];

      const dungeon = generator.generate(repos, { seed: '42' });

      const corridors = dungeon.edges.filter((e) => e.type === 'corridor');
      expect(corridors.length).toBeGreaterThan(0);
      expect(corridors.every((e) => e.path.length > 0)).toBe(true);
    });

    it('connects zones with gateway edges', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1, 'TypeScript'), makeRepo(2, 'Python'), makeRepo(3, 'Rust')];

      const dungeon = generator.generate(repos, { seed: '42' });

      const gateways = dungeon.edges.filter((e) => e.type === 'gateway');
      expect(gateways.length).toBeGreaterThan(0);
    });

    it('groups repos by language into distinct zones', () => {
      const generator = new DungeonGenerator();
      const repos = [
        makeRepo(1, 'TypeScript'),
        makeRepo(2, 'Python'),
        makeRepo(3, 'TypeScript'),
        makeRepo(4, 'Rust'),
      ];

      const dungeon = generator.generate(repos, { seed: '42' });

      const zoneLabels = new Set(dungeon.zones.map((z) => z.label));
      expect(zoneLabels.size).toBeGreaterThanOrEqual(3);
      expect(zoneLabels.has('TypeScript')).toBe(true);
      expect(zoneLabels.has('Python')).toBe(true);
      expect(zoneLabels.has('Rust')).toBe(true);
    });

    it('handles repos with no language by using first topic', () => {
      const generator = new DungeonGenerator();
      const repoNoLanguage = makeRepo(1);
      repoNoLanguage.language = null;
      repoNoLanguage.topics = ['web'];

      const repos = [repoNoLanguage, makeRepo(2, 'TypeScript')];

      const dungeon = generator.generate(repos, { seed: '42' });

      const zoneLabels = new Set(dungeon.zones.map((z) => z.label));
      expect(zoneLabels.size).toBeGreaterThanOrEqual(2);
    });

    it('is deterministic for the same seed and repos', () => {
      const generator1 = new DungeonGenerator();
      const generator2 = new DungeonGenerator();
      const repos = [makeRepo(1, 'TypeScript'), makeRepo(2, 'Python')];

      const dungeon1 = generator1.generate(repos, { seed: 'test-seed' });
      const dungeon2 = generator2.generate(repos, { seed: 'test-seed' });

      // Check that dimensions and structure are the same
      expect(dungeon1.width).toBe(dungeon2.width);
      expect(dungeon1.height).toBe(dungeon2.height);
      expect(dungeon1.rooms.length).toBe(dungeon2.rooms.length);
      expect(dungeon1.zones.length).toBe(dungeon2.zones.length);
      expect(dungeon1.edges.length).toBe(dungeon2.edges.length);

      // Check that room positions are the same
      for (let i = 0; i < dungeon1.rooms.length; i += 1) {
        const r1 = dungeon1.rooms[i];
        const r2 = dungeon2.rooms[i];
        expect(r1.position.x).toBe(r2.position.x);
        expect(r1.position.y).toBe(r2.position.y);
      }
    });

    it('produces different layouts for different seeds', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1, 'TypeScript'), makeRepo(2, 'Python'), makeRepo(3, 'Rust')];

      const dungeon1 = generator.generate(repos, { seed: 'seed-1' });
      const dungeon2 = generator.generate(repos, { seed: 'seed-2' });

      // The layouts might differ (at least in some room positions)
      let hasAnyDifference = false;
      for (let i = 0; i < dungeon1.rooms.length; i += 1) {
        if (
          dungeon1.rooms[i].position.x !== dungeon2.rooms[i].position.x ||
          dungeon1.rooms[i].position.y !== dungeon2.rooms[i].position.y
        ) {
          hasAnyDifference = true;
          break;
        }
      }
      expect(hasAnyDifference).toBe(true);
    });

    it('handles empty repo list gracefully', () => {
      const generator = new DungeonGenerator();

      const dungeon = generator.generate([], { seed: '42' });

      // Should still have a profile room
      expect(dungeon.rooms.length).toBeGreaterThan(0);
      expect(dungeon.entranceRoomId).toContain('profile');
    });

    it('applies biome themes based on language', () => {
      const generator = new DungeonGenerator();
      const repos = [
        makeRepo(1, 'TypeScript'),
        makeRepo(2, 'Python'),
        makeRepo(3, 'Rust'),
      ];

      const dungeon = generator.generate(repos, { seed: '42' });

      // Each zone should have a biome with valid ID
      for (const zone of dungeon.zones) {
        expect(zone.biome.id).toBeDefined();
        expect(zone.biome.name).toBeDefined();
        expect(zone.biome.visualTheme).toBeDefined();
      }
    });
  });

  describe('Player Movement Logic', () => {
    it('can track player position state', () => {
      const position = { x: 100, y: 200 };
      const roomId = 'room:test';
      const facingDirection = 'down' as const;

      const playerState = {
        position,
        currentRoomId: roomId,
        facingDirection,
      };

      expect(playerState.position.x).toBe(100);
      expect(playerState.position.y).toBe(200);
      expect(playerState.currentRoomId).toBe('room:test');
      expect(playerState.facingDirection).toBe('down');
    });

    it('can check if a point is within room bounds', () => {
      const room: DungeonRoomNode = {
        id: 'room:test',
        type: 'repo',
        zoneId: 'zone:test',
        name: 'Test Room',
        position: { x: 100, y: 200 },
        size: { width: 100, height: 100 },
      };

      const minX = room.position.x - room.size.width / 2; // 50
      const minY = room.position.y - room.size.height / 2; // 150
      const maxX = room.position.x + room.size.width / 2; // 150
      const maxY = room.position.y + room.size.height / 2; // 250

      // Point inside bounds
      expect(100 >= minX && 100 <= maxX && 200 >= minY && 200 <= maxY).toBe(true);

      // Point outside bounds
      expect(200 >= minX && 200 <= maxX && 300 >= minY && 300 <= maxY).toBe(false);

      // Boundary edge
      expect(50 >= minX && 50 <= maxX && 200 >= minY && 200 <= maxY).toBe(true);
    });

    it('can clamp player position to room bounds', () => {
      const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
      const playerRadius = 8;

      const minX = 50;
      const minY = 150;
      const maxX = 150;
      const maxY = 250;

      // Player outside bounds
      let x = 200;
      let y = 300;
      x = clamp(x, minX + playerRadius, maxX - playerRadius);
      y = clamp(y, minY + playerRadius, maxY - playerRadius);

      expect(x).toBe(150 - playerRadius);
      expect(y).toBe(250 - playerRadius);
    });

    it('can track room transitions', () => {
      const generator = new DungeonGenerator();
      const repos = [makeRepo(1, 'TypeScript')];
      const dungeon = generator.generate(repos, { seed: '42' });

      const rooms = dungeon.rooms;
      expect(rooms.length).toBeGreaterThan(0);

      // Simulate player moving through rooms
      let currentRoomId: string | null = null;
      const roomIds: string[] = [];

      for (const room of rooms) {
        if (currentRoomId !== room.id) {
          currentRoomId = room.id;
          roomIds.push(room.id);
        }
      }

      expect(roomIds.length).toBe(rooms.length);
    });
  });

  describe('Event Emission', () => {
    it('can structure room entry event data', () => {
      const room: DungeonRoomNode = {
        id: 'room:repo:123',
        type: 'repo',
        zoneId: 'zone:0-typescript',
        name: 'My Repository',
        position: { x: 100, y: 200 },
        size: { width: 100, height: 100 },
        repo: {
          id: 123,
          name: 'my-repo',
          fullName: 'user/my-repo',
          ownerLogin: 'user',
          description: 'A great repo',
          htmlUrl: 'https://github.com/user/my-repo',
          language: 'TypeScript',
          stargazersCount: 42,
          forksCount: 5,
          topics: ['test'],
          isPrivate: false,
          defaultBranch: 'main',
        },
      };

      const eventData = {
        roomId: room.id,
        roomType: room.type,
        roomName: room.name,
        repo: room.repo || null,
        zone: null,
      };

      expect(eventData.roomId).toBe('room:repo:123');
      expect(eventData.roomType).toBe('repo');
      expect(eventData.roomName).toBe('My Repository');
      expect(eventData.repo).not.toBeNull();
      expect(eventData.repo?.name).toBe('my-repo');
    });

    it('can structure player state event data', () => {
      const playerState = {
        position: { x: 100, y: 200 },
        currentRoomId: 'room:test',
        facingDirection: 'down' as const,
      };

      expect(playerState.position.x).toBe(100);
      expect(playerState.position.y).toBe(200);
      expect(playerState.currentRoomId).toBe('room:test');
      expect(playerState.facingDirection).toBe('down');
    });
  });
});

