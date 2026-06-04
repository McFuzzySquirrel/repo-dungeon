/**
 * BadgeTracker manages badge unlocks and persistence
 */

import { EventEmitter } from 'eventemitter3';
import {
  BADGES,
  getUnlockTarget,
  type BadgeId,
  type BadgeDefinition,
} from '@/game/systems/progressionEngine';

export interface BadgeUnlockedEvent {
  badgeId: BadgeId;
  timestamp: number;
}

export { BADGES };
export type { BadgeDefinition, BadgeId };

export interface BadgeTrackerState {
  unlockedBadges: BadgeId[];
  unlockedTimestamps: Record<BadgeId, number>;
  discoveryCount: number;
  readmeCount: number;
  githubLinkClicks: number;
  reviewPassCount: number;
  zonesClearedCount: number;
}

export class BadgeTracker extends EventEmitter {
  private unlockedBadges: Set<BadgeId> = new Set();
  private unlockedTimestamps: Partial<Record<BadgeId, number>> = {};
  private discoveryCount: number = 0;
  private readmeCount: number = 0;
  private githubLinkClicks: number = 0;
  private reviewPassCount: number = 0;
  private zonesClearedCount: number = 0;

  /**
   * Unlock a badge if not already earned
   */
  unlockBadge(badgeId: BadgeId): boolean {
    if (this.unlockedBadges.has(badgeId)) {
      return false;
    }

    this.unlockedBadges.add(badgeId);
    const timestamp = Date.now();
    this.unlockedTimestamps[badgeId] = timestamp;

    const event: BadgeUnlockedEvent = {
      badgeId,
      timestamp,
    };
    this.emit('badgeUnlocked', event);

    return true;
  }

  /**
   * Check if a badge has been unlocked
   */
  hasBadge(badgeId: BadgeId): boolean {
    return this.unlockedBadges.has(badgeId);
  }

  /**
   * Get all unlocked badges
   */
  getAllBadges(): BadgeId[] {
    return Array.from(this.unlockedBadges);
  }

  /**
   * Get count of unlocked badges
   */
  getBadgeCount(): number {
    return this.unlockedBadges.size;
  }

  /**
   * Track a discovery and check for Archaeologist badge
   */
  trackDiscovery(): void {
    this.discoveryCount++;
    if (this.discoveryCount >= (getUnlockTarget('archaeologist') ?? Number.MAX_SAFE_INTEGER) && !this.hasBadge('archaeologist')) {
      this.unlockBadge('archaeologist');
    }
  }

  /**
   * Track README read and check for Lore Keeper badge
   */
  trackReadmeRead(): void {
    this.readmeCount++;
    if (this.readmeCount >= (getUnlockTarget('lore-keeper') ?? Number.MAX_SAFE_INTEGER) && !this.hasBadge('lore-keeper')) {
      this.unlockBadge('lore-keeper');
    }
  }

  /**
   * Track GitHub link click and check for Portal Walker badge
   */
  trackGitHubLinkClick(): void {
    this.githubLinkClicks++;
    if (this.githubLinkClicks >= (getUnlockTarget('portal-walker') ?? Number.MAX_SAFE_INTEGER) && !this.hasBadge('portal-walker')) {
      this.unlockBadge('portal-walker');
    }
  }

  trackReviewPass(): void {
    this.reviewPassCount++;
    if (this.reviewPassCount >= (getUnlockTarget('zone-cleared') ?? Number.MAX_SAFE_INTEGER) && !this.hasBadge('zone-cleared')) {
      this.unlockBadge('zone-cleared');
    }
  }

  /**
   * Get GitHub link click count
   */
  getGitHubLinkClickCount(): number {
    return this.githubLinkClicks;
  }

  /**
   * Get discovery count
   */
  getDiscoveryCount(): number {
    return this.discoveryCount;
  }

  /**
   * Get readme count
   */
  getReadmeCount(): number {
    return this.readmeCount;
  }

  /**
   * Get full badge tracker state
   */
  getState(): BadgeTrackerState {
    return {
      unlockedBadges: Array.from(this.unlockedBadges),
      unlockedTimestamps: { ...this.unlockedTimestamps } as Record<BadgeId, number>,
      discoveryCount: this.discoveryCount,
      readmeCount: this.readmeCount,
      githubLinkClicks: this.githubLinkClicks,
      reviewPassCount: this.reviewPassCount,
      zonesClearedCount: this.zonesClearedCount,
    };
  }

  /**
   * Restore badge tracker state
   */
  restoreState(state: BadgeTrackerState): void {
    this.unlockedBadges = new Set(state.unlockedBadges);
    this.unlockedTimestamps = { ...state.unlockedTimestamps };
    this.discoveryCount = state.discoveryCount;
    this.readmeCount = state.readmeCount;
    this.githubLinkClicks = state.githubLinkClicks;
    this.reviewPassCount = state.reviewPassCount ?? 0;
    this.zonesClearedCount = state.zonesClearedCount;
  }

  /**
   * Reset badge state
   */
  reset(): void {
    this.unlockedBadges.clear();
    this.unlockedTimestamps = {};
    this.discoveryCount = 0;
    this.readmeCount = 0;
    this.githubLinkClicks = 0;
    this.reviewPassCount = 0;
    this.zonesClearedCount = 0;
  }
}
