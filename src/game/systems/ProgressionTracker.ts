/**
 * ProgressionTracker manages XP, leveling, and progression state
 * Handles class-based XP modifiers and level-up events
 */

import type { PlayerClass } from '@/game/config/classes';
import { CLASSES, CODE_HEAVY_LANGUAGES } from '@/game/config/classes';
import type { GitHubRoomData } from '@/github/types';
import { EventEmitter } from 'eventemitter3';

export interface LevelUpEvent {
  newLevel: number;
  totalXp: number;
}

export interface ProgressionState {
  selectedClass: PlayerClass;
  currentLevel: number;
  totalXp: number;
  xpTowardNextLevel: number;
}

/**
 * XP thresholds for leveling
 * Returns the total XP needed to reach a given level
 */
export function getXpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 5) return (level - 1) * 100; // 100 XP per level
  if (level <= 10) return 500 + (level - 5) * 200; // 200 XP per level
  if (level <= 20) return 500 + 1000 + (level - 10) * 300; // 300 XP per level
  // 21+: 500 XP per level
  return 500 + 1000 + 3000 + (level - 20) * 500;
}

/**
 * Get the required XP to reach the next level from current level
 */
export function getXpForNextLevel(currentLevel: number): number {
  return getXpThresholdForLevel(currentLevel + 1) - getXpThresholdForLevel(currentLevel);
}

/**
 * Determine if a repo is "code-heavy" (Hacker bonus)
 */
function isCodeHeavyRepo(roomData: GitHubRoomData): boolean {
  if (!roomData.repo.language) return false;
  const lang = roomData.repo.language.toLowerCase();
  return CODE_HEAVY_LANGUAGES.some((h) => lang.includes(h));
}

/**
 * Determine if a repo is "README-heavy" (Archivist bonus)
 */
function isReadmeHeavyRepo(roomData: GitHubRoomData): boolean {
  return (
    roomData.readme.plainText !== null &&
    roomData.readme.plainText.length > 100 &&
    roomData.repo.topics.length > 0 &&
    roomData.repo.stargazersCount >= 100
  );
}

/**
 * Determine if a repo is "collaborative" (Contributor bonus)
 */
function isCollaborativeRepo(roomData: GitHubRoomData): boolean {
  return roomData.contributors.length > 5;
}

export class ProgressionTracker extends EventEmitter {
  private selectedClass: PlayerClass;
  private currentLevel: number = 1;
  private totalXp: number = 0;

  constructor(selectedClass: PlayerClass) {
    super();
    this.selectedClass = selectedClass;
  }

  /**
   * Add XP and trigger level-up if threshold is reached
   */
  addXp(baseAmount: number, roomData?: GitHubRoomData): void {
    let amount = baseAmount;

    // Apply class bonuses
    const classConfig = CLASSES[this.selectedClass];
    amount *= classConfig.xpMultiplier;

    // Apply room-type bonuses
    if (roomData) {
      if (isReadmeHeavyRepo(roomData)) {
        amount *= classConfig.readmeXpMultiplier;
      }
      if (isCodeHeavyRepo(roomData)) {
        amount *= classConfig.codeHeavyXpMultiplier;
      }
      if (isCollaborativeRepo(roomData)) {
        amount *= classConfig.collaborativeXpMultiplier;
      }
    }

    amount = Math.floor(amount);
    this.totalXp += amount;

    // Check for level-ups
    while (this.totalXp >= getXpThresholdForLevel(this.currentLevel + 1)) {
      this.currentLevel++;
      const event: LevelUpEvent = {
        newLevel: this.currentLevel,
        totalXp: this.totalXp,
      };
      this.emit('levelUp', event);
    }
  }

  /**
   * Get the player's current level
   */
  getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Get total XP earned
   */
  getTotalXp(): number {
    return this.totalXp;
  }

  /**
   * Get XP toward next level (0 to required amount)
   */
  getXpTowardNextLevel(): number {
    const currentThreshold = getXpThresholdForLevel(this.currentLevel);
    return this.totalXp - currentThreshold;
  }

  /**
   * Get progress to next level as percentage (0-100)
   */
  getProgressToNextLevel(): number {
    const xpRequired = getXpForNextLevel(this.currentLevel);
    const xpToward = this.getXpTowardNextLevel();
    if (xpRequired === 0) return 100;
    return Math.floor((xpToward / xpRequired) * 100);
  }

  /**
   * Get selected class
   */
  getSelectedClass(): PlayerClass {
    return this.selectedClass;
  }

  /**
   * Get full progression state
   */
  getState(): ProgressionState {
    return {
      selectedClass: this.selectedClass,
      currentLevel: this.currentLevel,
      totalXp: this.totalXp,
      xpTowardNextLevel: this.getXpTowardNextLevel(),
    };
  }

  /**
   * Restore progression state
   */
  restoreState(state: ProgressionState): void {
    this.selectedClass = state.selectedClass;
    this.totalXp = state.totalXp;
    // Recalculate level from total XP
    this.currentLevel = 1;
    while (this.totalXp >= getXpThresholdForLevel(this.currentLevel + 1)) {
      this.currentLevel++;
    }
  }

  /**
   * Reset progression
   */
  reset(): void {
    this.currentLevel = 1;
    this.totalXp = 0;
  }
}
