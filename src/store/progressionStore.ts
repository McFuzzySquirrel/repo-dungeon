/**
 * Progression Store - manages all progression state with Zustand
 */

import { create } from 'zustand';
import { STORAGE_KEYS } from '@/store/persistence';

interface PersistedProgression {
  level: number;
  totalXp: number;
  xpTowardNextLevel: number;
  inventory: LootItem[];
  unlockedBadges: BadgeId[];
  discoveryCount: number;
  readmeCount: number;
  githubLinkClicks: number;
}

function loadPersistedProgression(): Partial<PersistedProgression> {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.progression)
      : null;
    if (!raw) return {};
    return JSON.parse(raw) as PersistedProgression;
  } catch {
    return {};
  }
}

function saveProgression(state: PersistedProgression): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.progression, JSON.stringify(state));
    }
  } catch {
    // storage unavailable — silently ignore
  }
}
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

const saved = loadPersistedProgression();

const initialState = {
  selectedClass: null as PlayerClass | null,
  level: saved.level ?? 1,
  totalXp: saved.totalXp ?? 0,
  xpTowardNextLevel: saved.xpTowardNextLevel ?? 0,
  inventory: saved.inventory ?? ([] as LootItem[]),
  unlockedBadges: saved.unlockedBadges ?? ([] as BadgeId[]),
  discoveryCount: saved.discoveryCount ?? 0,
  readmeCount: saved.readmeCount ?? 0,
  githubLinkClicks: saved.githubLinkClicks ?? 0,
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

  reset: () => {
    set(initialState);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.progression);
      }
    } catch { /* ignore */ }
  },
}));

// Persist to localStorage on every relevant state change
useProgressionStore.subscribe((state) => {
  saveProgression({
    level: state.level,
    totalXp: state.totalXp,
    xpTowardNextLevel: state.xpTowardNextLevel,
    inventory: state.inventory,
    unlockedBadges: state.unlockedBadges,
    discoveryCount: state.discoveryCount,
    readmeCount: state.readmeCount,
    githubLinkClicks: state.githubLinkClicks,
  });
});
