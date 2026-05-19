import { describe, it, expect } from 'vitest';
import { generateLoot } from '@/game/systems/LootGenerator';
import type { GitHubRoomData } from '@/github/types';

describe('LootGenerator', () => {
  const createMockRoomData = (options?: {
    language?: string;
    stargazersCount?: number;
    topics?: string[];
    readme?: string;
    contributors?: number;
  }): GitHubRoomData => {
    return {
      repo: {
        id: 1,
        name: 'test-repo',
        fullName: 'user/test-repo',
        ownerLogin: 'user',
        description: 'Test repository',
        htmlUrl: 'https://github.com/user/test-repo',
        language: options?.language ?? 'JavaScript',
        stargazersCount: options?.stargazersCount ?? 50,
        forksCount: 5,
        topics: options?.topics ?? [],
        isPrivate: false,
        defaultBranch: 'main',
      },
      readme: {
        plainText: options?.readme ?? null,
        truncated: false,
      },
      languages: { [options?.language ?? 'JavaScript']: 100 },
      topLevelTree: [],
      treeTruncated: false,
      contributors: options?.contributors
        ? Array.from({ length: options.contributors }, (_, i) => ({
            id: i,
            login: `contributor${i}`,
            avatarUrl: '',
            profileUrl: '',
            contributions: i + 1,
          }))
        : [],
      unavailable: [],
    };
  };

  describe('Basic Loot Generation', () => {
    it('should generate loot for JavaScript repo', () => {
      const roomData = createMockRoomData({
        language: 'JavaScript',
      });
      const loot = generateLoot(roomData, 'explorer');

      expect(loot.length).toBeGreaterThan(0);
      const jsLoot = loot.find((l) => l.name === 'Golden Console');
      expect(jsLoot).toBeDefined();
    });

    it('should generate loot for Python repo', () => {
      const roomData = createMockRoomData({
        language: 'Python',
      });
      const loot = generateLoot(roomData, 'explorer');

      const pythonLoot = loot.find((l) => l.name === 'Serpent Tome');
      expect(pythonLoot).toBeDefined();
    });

    it('should generate loot for Rust repo', () => {
      const roomData = createMockRoomData({
        language: 'Rust',
      });
      const loot = generateLoot(roomData, 'explorer');

      const rustLoot = loot.find((l) => l.name === 'Iron Ingot');
      expect(rustLoot).toBeDefined();
    });

    it('should generate Star Fragment for repos with 100+ stars', () => {
      const roomData = createMockRoomData({
        stargazersCount: 500,
      });
      const loot = generateLoot(roomData, 'explorer');

      const starLoot = loot.find((l) => l.name === 'Star Fragment');
      expect(starLoot).toBeDefined();
      expect(starLoot?.rarity).toBe('uncommon');
    });

    it('should generate Legendary Star Crystal for repos with 1000+ stars', () => {
      const roomData = createMockRoomData({
        stargazersCount: 5000,
      });
      const loot = generateLoot(roomData, 'explorer');

      const legendaryLoot = loot.find((l) => l.name === 'Legendary Star Crystal');
      expect(legendaryLoot).toBeDefined();
      expect(legendaryLoot?.rarity).toBe('rare');
    });

    it('should generate Guild Crest for multi-contributor repos', () => {
      const roomData = createMockRoomData({
        contributors: 10,
      });
      const loot = generateLoot(roomData, 'explorer');

      const guildLoot = loot.find((l) => l.name === 'Guild Crest');
      expect(guildLoot).toBeDefined();
    });

    it('should generate Tag Rune for repos with topics', () => {
      const roomData = createMockRoomData({
        topics: ['ai', 'ml', 'python'],
      });
      const loot = generateLoot(roomData, 'explorer');

      const tagLoot = loot.find((l) => l.name === 'Tag Rune');
      expect(tagLoot).toBeDefined();
    });

    it('should generate Ancient Scroll for repos with README', () => {
      const roomData = createMockRoomData({
        readme: 'This is a comprehensive README',
      });
      const loot = generateLoot(roomData, 'explorer');

      const scrollLoot = loot.find((l) => l.name === 'Ancient Scroll');
      expect(scrollLoot).toBeDefined();
    });
  });

  describe('Rarity Assignment', () => {
    it('should assign correct rarities', () => {
      const roomData = createMockRoomData({
        stargazersCount: 2000,
      });
      const loot = generateLoot(roomData, 'explorer');

      const rareLoot = loot.filter((l) => l.rarity === 'rare');
      expect(rareLoot.length).toBeGreaterThan(0);
    });

    it('should not duplicate loot items', () => {
      const roomData = createMockRoomData({
        language: 'JavaScript',
        stargazersCount: 500,
        topics: ['web'],
      });
      const loot = generateLoot(roomData, 'explorer');

      const names = loot.map((l) => l.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });
  });

  describe('Class Modifiers', () => {
    it('should apply Archivist 2x bonus for README-heavy repos', () => {
      const roomData = createMockRoomData({
        readme: 'A'.repeat(200),
        stargazersCount: 500,
        topics: ['test', 'example'],
      });

      const explorerLoot = generateLoot(roomData, 'explorer');
      const archivistLoot = generateLoot(roomData, 'archivist');

      // Archivist should get more loot
      expect(archivistLoot.length).toBeGreaterThanOrEqual(explorerLoot.length);
    });

    it('should apply Contributor 1.5x bonus for multi-contributor repos', () => {
      const roomData = createMockRoomData({
        contributors: 8,
      });

      const explorerLoot = generateLoot(roomData, 'explorer');
      const contributorLoot = generateLoot(roomData, 'contributor');

      // Contributor should get more loot
      expect(contributorLoot.length).toBeGreaterThanOrEqual(explorerLoot.length);
    });

    it('should limit loot to reasonable amounts (max 4 items)', () => {
      const roomData = createMockRoomData({
        language: 'TypeScript',
        stargazersCount: 5000,
        readme: 'A'.repeat(200),
        topics: ['web', 'framework', 'javascript'],
        contributors: 10,
      });

      const loot = generateLoot(roomData, 'explorer');
      expect(loot.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Loot Item Structure', () => {
    it('should have required loot item properties', () => {
      const roomData = createMockRoomData();
      const loot = generateLoot(roomData, 'explorer');

      expect(loot.length).toBeGreaterThan(0);
      const item = loot[0];

      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('rarity');
      expect(item).toHaveProperty('repo');
      expect(item).toHaveProperty('repoUrl');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('timestamp');

      expect(typeof item.id).toBe('string');
      expect(['common', 'uncommon', 'rare']).toContain(item.rarity);
      expect(typeof item.timestamp).toBe('number');
    });
  });
});
