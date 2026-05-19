/**
 * Progression Store - manages all progression state with Zustand
 */

import { create } from 'zustand';
import type { PlayerClass } from '@/game/config/classes';
import type { LootItem } from '@/game/systems/LootGenerator';
import type { BadgeId } from '@/game/systems/BadgeTracker';
import type { ProgressionState } from '@/game/systems/ProgressionTracker';

export interface ProgressionStoreState {
  // Selected class and progression
  selectedClass: PlayerClass | null;
  level: number;
  totalXp: number;
  xpTowardNextLevel: number;

  // Inventory
  inventory: LootItem[];

  // Badges
  unlockedBadges: BadgeId[];

  // Counters for badge tracking
  discoveryCount: number;
  readmeCount: number;
  githubLinkClicks: number;

  // Actions
  setSelectedClass: (classId: PlayerClass) => void;
  updateProgression: (state: ProgressionState) => void;
  addLoot: (item: LootItem) => void;
  addBadge: (badgeId: BadgeId) => void;
  incrementDiscoveryCount: () => void;
  incrementReadmeCount: () => void;
  incrementGitHubLinkClicks: () => void;
  setInventory: (items: LootItem[]) => void;
  setBadges: (badges: BadgeId[]) => void;
  reset: () => void;
}

const initialState = {
  selectedClass: null as PlayerClass | null,
  level: 1,
  totalXp: 0,
  xpTowardNextLevel: 0,
  inventory: [] as LootItem[],
  unlockedBadges: [] as BadgeId[],
  discoveryCount: 0,
  readmeCount: 0,
  githubLinkClicks: 0,
};

export const useProgressionStore = create<ProgressionStoreState>((set) => ({
  ...initialState,

  setSelectedClass: (classId) => set({ selectedClass: classId }),

  updateProgression: (state) =>
    set({
      level: state.currentLevel,
      totalXp: state.totalXp,
      xpTowardNextLevel: state.xpTowardNextLevel,
    }),

  addLoot: (item) =>
    set((state) => ({
      inventory: [...state.inventory, item],
    })),

  addBadge: (badgeId) =>
    set((state) => {
      if (state.unlockedBadges.includes(badgeId)) {
        return {};
      }
      return {
        unlockedBadges: [...state.unlockedBadges, badgeId],
      };
    }),

  incrementDiscoveryCount: () =>
    set((state) => ({
      discoveryCount: state.discoveryCount + 1,
    })),

  incrementReadmeCount: () =>
    set((state) => ({
      readmeCount: state.readmeCount + 1,
    })),

  incrementGitHubLinkClicks: () =>
    set((state) => ({
      githubLinkClicks: state.githubLinkClicks + 1,
    })),

  setInventory: (items) => set({ inventory: items }),

  setBadges: (badges) => set({ unlockedBadges: badges }),

  reset: () => set(initialState),
}));
