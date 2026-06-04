import { describe, it, expect, beforeEach } from 'vitest';
import { BadgeTracker, type BadgeId } from '@/game/systems/BadgeTracker';

describe('BadgeTracker', () => {
  let tracker: BadgeTracker;

  beforeEach(() => {
    tracker = new BadgeTracker();
  });

  describe('Badge Unlocking', () => {
    it('should start with no badges', () => {
      expect(tracker.getAllBadges()).toHaveLength(0);
      expect(tracker.getBadgeCount()).toBe(0);
    });

    it('should unlock a badge', () => {
      const unlocked = tracker.unlockBadge('first-steps');
      expect(unlocked).toBe(true);
      expect(tracker.hasBadge('first-steps')).toBe(true);
      expect(tracker.getAllBadges()).toContain('first-steps');
    });

    it('should not unlock the same badge twice', () => {
      tracker.unlockBadge('first-steps');
      const unlocked = tracker.unlockBadge('first-steps');
      expect(unlocked).toBe(false);
      expect(tracker.getBadgeCount()).toBe(1);
    });

    it('should emit badgeUnlocked event', async () => {
      const badgeUnlockedPromise = new Promise<void>((resolve) => {
        tracker.on('badgeUnlocked', (event: Record<string, unknown>) => {
          expect(event.badgeId).toBe('first-steps');
          expect(typeof event.timestamp).toBe('number');
          expect((event.timestamp as number) > 0).toBe(true);
          resolve();
        });
      });

      tracker.unlockBadge('first-steps');
      await badgeUnlockedPromise;
    });

    it('should track all unlocked badges', () => {
      const badgesToUnlock: BadgeId[] = ['first-steps', 'archaeologist', 'lore-keeper'];

      badgesToUnlock.forEach((badgeId) => {
        tracker.unlockBadge(badgeId);
      });

      expect(tracker.getBadgeCount()).toBe(3);
      badgesToUnlock.forEach((badgeId) => {
        expect(tracker.hasBadge(badgeId)).toBe(true);
      });
    });
  });

  describe('Discovery Tracking', () => {
    it('should track discoveries', () => {
      expect(tracker.getDiscoveryCount()).toBe(0);

      tracker.trackDiscovery();
      expect(tracker.getDiscoveryCount()).toBe(1);

      tracker.trackDiscovery();
      expect(tracker.getDiscoveryCount()).toBe(2);
    });

    it('should unlock Archaeologist badge at 3 discoveries', () => {
      tracker.trackDiscovery();
      tracker.trackDiscovery();
      expect(tracker.hasBadge('archaeologist')).toBe(false);

      tracker.trackDiscovery();
      expect(tracker.hasBadge('archaeologist')).toBe(true);
    });
  });

  describe('README Tracking', () => {
    it('should track README reads', () => {
      expect(tracker.getReadmeCount()).toBe(0);

      for (let i = 0; i < 5; i++) {
        tracker.trackReadmeRead();
      }

      expect(tracker.getReadmeCount()).toBe(5);
    });

    it('should unlock Lore Keeper badge at 10 READMEs', () => {
      for (let i = 0; i < 9; i++) {
        tracker.trackReadmeRead();
      }
      expect(tracker.hasBadge('lore-keeper')).toBe(false);

      tracker.trackReadmeRead();
      expect(tracker.hasBadge('lore-keeper')).toBe(true);
    });
  });

  describe('GitHub Link Tracking', () => {
    it('should track GitHub link clicks', () => {
      expect(tracker.getGitHubLinkClickCount()).toBe(0);

      for (let i = 0; i < 3; i++) {
        tracker.trackGitHubLinkClick();
      }

      expect(tracker.getGitHubLinkClickCount()).toBe(3);
    });

    describe('Review Pass Tracking', () => {
      it('should unlock Zone Cleared badge at first review pass', () => {
        expect(tracker.hasBadge('zone-cleared')).toBe(false);
        tracker.trackReviewPass();
        expect(tracker.hasBadge('zone-cleared')).toBe(true);
      });
    });

    it('should unlock Portal Walker badge at 5 clicks', () => {
      for (let i = 0; i < 4; i++) {
        tracker.trackGitHubLinkClick();
      }
      expect(tracker.hasBadge('portal-walker')).toBe(false);

      tracker.trackGitHubLinkClick();
      expect(tracker.hasBadge('portal-walker')).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should save and restore state', () => {
      tracker.unlockBadge('first-steps');
      tracker.unlockBadge('archaeologist');
      tracker.trackDiscovery();
      tracker.trackReadmeRead();
      tracker.trackGitHubLinkClick();

      const state = tracker.getState();

      const newTracker = new BadgeTracker();
      newTracker.restoreState(state);

      expect(newTracker.getAllBadges()).toEqual(tracker.getAllBadges());
      expect(newTracker.getDiscoveryCount()).toBe(tracker.getDiscoveryCount());
      expect(newTracker.getReadmeCount()).toBe(tracker.getReadmeCount());
      expect(newTracker.getGitHubLinkClickCount()).toBe(tracker.getGitHubLinkClickCount());
    });

    it('should reset state', () => {
      tracker.unlockBadge('first-steps');
      tracker.trackDiscovery();
      tracker.trackReadmeRead();

      tracker.reset();

      expect(tracker.getAllBadges()).toHaveLength(0);
      expect(tracker.getDiscoveryCount()).toBe(0);
      expect(tracker.getReadmeCount()).toBe(0);
      expect(tracker.getGitHubLinkClickCount()).toBe(0);
    });
  });

  describe('State Persistence', () => {
    it('should include all counters in state', () => {
      tracker.unlockBadge('first-steps');
      tracker.trackDiscovery();
      tracker.trackReadmeRead();
      tracker.trackGitHubLinkClick();

      const state = tracker.getState();

      expect(state).toHaveProperty('unlockedBadges');
      expect(state).toHaveProperty('unlockedTimestamps');
      expect(state).toHaveProperty('discoveryCount');
      expect(state).toHaveProperty('readmeCount');
      expect(state).toHaveProperty('githubLinkClicks');
      expect(state).toHaveProperty('reviewPassCount');

      expect(state.unlockedBadges).toContain('first-steps');
      expect(state.discoveryCount).toBe(1);
      expect(state.readmeCount).toBe(1);
      expect(state.githubLinkClicks).toBe(1);
      expect(state.reviewPassCount).toBe(0);
    });
  });
});
