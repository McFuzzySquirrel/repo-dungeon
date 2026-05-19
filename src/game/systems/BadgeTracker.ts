/**
 * BadgeTracker manages badge unlocks and persistence
 */

import { EventEmitter } from 'eventemitter3';

export type BadgeId =
  | 'first-steps'
  | 'archaeologist'
  | 'lore-keeper'
  | 'star-gazer'
  | 'zone-cleared'
  | 'dungeon-master'
  | 'portal-walker'
  | 'guild-finder'
  | 'archivist';

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  icon: string;
  description: string;
  emoji: string;
}

export interface BadgeUnlockedEvent {
  badgeId: BadgeId;
  timestamp: number;
}

/**
 * Badge definitions
 */
export const BADGES: Record<BadgeId, BadgeDefinition> = {
  'first-steps': {
    id: 'first-steps',
    name: 'First Steps',
    icon: '📍',
    emoji: '📍',
    description: 'Entered the dungeon for the first time',
  },
  archaeologist: {
    id: 'archaeologist',
    name: 'Archaeologist',
    icon: '🔎',
    emoji: '🔎',
    description: 'Marked 3 rooms as "new discovery"',
  },
  'lore-keeper': {
    id: 'lore-keeper',
    name: 'Lore Keeper',
    icon: '📖',
    emoji: '📖',
    description: 'Read 10 full READMEs',
  },
  'star-gazer': {
    id: 'star-gazer',
    name: 'Star Gazer',
    icon: '⭐',
    emoji: '⭐',
    description: 'Visited a repo with 1000+ stars',
  },
  'zone-cleared': {
    id: 'zone-cleared',
    name: 'Zone Cleared',
    icon: '🏛️',
    emoji: '🏛️',
    description: 'Visited all rooms in a zone',
  },
  'dungeon-master': {
    id: 'dungeon-master',
    name: 'Dungeon Master',
    icon: '👑',
    emoji: '👑',
    description: 'Visited all rooms in the dungeon',
  },
  'portal-walker': {
    id: 'portal-walker',
    name: 'Portal Walker',
    icon: '🌐',
    emoji: '🌐',
    description: 'Clicked "Visit on GitHub" 5 or more times',
  },
  'guild-finder': {
    id: 'guild-finder',
    name: 'Guild Finder',
    icon: '👫',
    emoji: '👫',
    description: 'Discovered a repo with 10+ contributors',
  },
  archivist: {
    id: 'archivist',
    name: 'Archivist',
    icon: '🗂️',
    emoji: '🗂️',
    description: 'Explored an archived repository',
  },
};

export interface BadgeTrackerState {
  unlockedBadges: BadgeId[];
  unlockedTimestamps: Record<BadgeId, number>;
  discoveryCount: number;
  readmeCount: number;
  githubLinkClicks: number;
  zonesClearedCount: number;
}

export class BadgeTracker extends EventEmitter {
  private unlockedBadges: Set<BadgeId> = new Set();
  private unlockedTimestamps: Partial<Record<BadgeId, number>> = {};
  private discoveryCount: number = 0;
  private readmeCount: number = 0;
  private githubLinkClicks: number = 0;
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
    if (this.discoveryCount >= 3 && !this.hasBadge('archaeologist')) {
      this.unlockBadge('archaeologist');
    }
  }

  /**
   * Track README read and check for Lore Keeper badge
   */
  trackReadmeRead(): void {
    this.readmeCount++;
    if (this.readmeCount >= 10 && !this.hasBadge('lore-keeper')) {
      this.unlockBadge('lore-keeper');
    }
  }

  /**
   * Track GitHub link click and check for Portal Walker badge
   */
  trackGitHubLinkClick(): void {
    this.githubLinkClicks++;
    if (this.githubLinkClicks >= 5 && !this.hasBadge('portal-walker')) {
      this.unlockBadge('portal-walker');
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
    this.zonesClearedCount = 0;
  }
}
