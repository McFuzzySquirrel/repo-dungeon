import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressionTracker } from '@/game/systems/ProgressionTracker';
import type { GitHubRoomData } from '@/github/types';

describe('ProgressionTracker', () => {
  let tracker: ProgressionTracker;

  beforeEach(() => {
    tracker = new ProgressionTracker('explorer');
  });

  describe('XP and Leveling', () => {
    it('should start at level 1 with 0 XP', () => {
      expect(tracker.getCurrentLevel()).toBe(1);
      expect(tracker.getTotalXp()).toBe(0);
      expect(tracker.getXpTowardNextLevel()).toBe(0);
    });

    it('should add XP correctly', () => {
      tracker.addXp(50);
      expect(tracker.getTotalXp()).toBe(55); // 50 * 1.1 (Explorer bonus)
    });

    it('should apply class XP multipliers', () => {
      const explorer = new ProgressionTracker('explorer');
      const archivist = new ProgressionTracker('archivist');

      explorer.addXp(100);
      archivist.addXp(100);

      // Explorer: 100 * 1.1 = 110
      expect(explorer.getTotalXp()).toBe(110);
      // Archivist: 100 * 1.0 = 100
      expect(archivist.getTotalXp()).toBe(100);
    });

    it('should level up at correct thresholds', () => {
      // Level 1: 0 XP, needs 100 XP total to reach level 2
      for (let i = 0; i < 20; i++) {
        tracker.addXp(50);
      }
      // Total: 50 * 20 * 1.1 = 1100 XP
      const level = tracker.getCurrentLevel();
      expect(level).toBeGreaterThan(1);
    });

    it('should emit levelUp event when leveling', async () => {
      const levelUpPromise = new Promise<void>((resolve) => {
        tracker.on('levelUp', (event: Record<string, unknown>) => {
          expect(typeof event.newLevel).toBe('number');
          expect((event.newLevel as number) > 1).toBe(true);
          expect(typeof event.totalXp).toBe('number');
          expect((event.totalXp as number) > 0).toBe(true);
          resolve();
        });
      });

      // Add enough XP to level up (level 1 needs 100 XP)
      for (let i = 0; i < 20; i++) {
        tracker.addXp(50);
      }

      await levelUpPromise;
    });

    it('should calculate XP progress correctly', () => {
      tracker.addXp(50); // 55 XP toward level 2 (need 100)
      const progress = tracker.getProgressToNextLevel();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  describe('Class Selection', () => {
    it('should return selected class', () => {
      expect(tracker.getSelectedClass()).toBe('explorer');
    });

    it('should create tracker for each class', () => {
      const classes = ['explorer', 'archivist', 'hacker', 'contributor'] as const;
      classes.forEach((classId) => {
        const t = new ProgressionTracker(classId);
        expect(t.getSelectedClass()).toBe(classId);
      });
    });
  });

  describe('State Management', () => {
    it('should restore state correctly', () => {
      tracker.addXp(50);
      const state = tracker.getState();

      const newTracker = new ProgressionTracker('explorer');
      newTracker.restoreState(state);

      expect(newTracker.getTotalXp()).toBe(tracker.getTotalXp());
      expect(newTracker.getCurrentLevel()).toBe(tracker.getCurrentLevel());
    });

    it('should reset state', () => {
      tracker.addXp(100);
      tracker.reset();

      expect(tracker.getCurrentLevel()).toBe(1);
      expect(tracker.getTotalXp()).toBe(0);
    });
  });

  describe('Room Data Bonuses', () => {
    const mockRoomData = {
      repo: {
        id: 1,
        name: 'test-repo',
        fullName: 'user/test-repo',
        ownerLogin: 'user',
        description: 'Test repo',
        htmlUrl: 'https://github.com/user/test-repo',
        language: 'Rust',
        stargazersCount: 1500,
        forksCount: 10,
        topics: ['test'],
        isPrivate: false,
        defaultBranch: 'main',
      },
      readme: {
        plainText: 'A long README with substantial content'.repeat(10),
        truncated: false,
      },
      languages: { Rust: 100 },
      topLevelTree: [],
      treeTruncated: false,
      contributors: Array.from({ length: 10 }, (_, i) => ({
        id: i,
        login: `contributor${i}`,
        avatarUrl: '',
        profileUrl: '',
        contributions: i + 1,
      })),
      unavailable: [],
    } as GitHubRoomData;

    it('should apply Hacker bonus for code-heavy languages', () => {
      const hacker = new ProgressionTracker('hacker');
      hacker.addXp(100, mockRoomData);

      // Hacker: 100 * 1.25 (code-heavy) = 125
      expect(hacker.getTotalXp()).toBe(125);
    });

    it('should apply Archivist bonus for README-heavy repos', () => {
      const archivist = new ProgressionTracker('archivist');
      archivist.addXp(100, mockRoomData);

      // Archivist: 100 * 1.2 (README-heavy) = 120
      expect(archivist.getTotalXp()).toBe(120);
    });

    it('should apply Contributor bonus for multi-contributor repos', () => {
      const contributor = new ProgressionTracker('contributor');
      contributor.addXp(100, mockRoomData);

      // Contributor: 100 * 1.15 (collaborative) = 114.999... ≈ 114 (floored)
      expect(contributor.getTotalXp()).toBe(114);
    });
  });
});
