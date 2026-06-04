/**
 * Progression Store - manages all progression state with Zustand
 */

import { create } from 'zustand';
import { STORAGE_KEYS, getProgressionRestoreKeys } from '@/store/persistence';
import { parseSourceIdentityFromStorage } from '@/repository/source';
import type { PlayerClass } from '@/game/config/classes';
import type { LootItem } from '@/game/systems/LootGenerator';
import type { BadgeId } from '@/game/systems/BadgeTracker';
import type { ProgressionState } from '@/game/systems/ProgressionTracker';

export interface ArchaeologyLogEntry {
  id: string;
  roomId: string;
  roomName: string;
  action: 'review-checkpoint' | 'review-pass';
  timestamp: number;
}

interface PersistedProgression {
  level: number;
  totalXp: number;
  xpTowardNextLevel: number;
  inventory: LootItem[];
  unlockedBadges: BadgeId[];
  discoveryCount: number;
  readmeCount: number;
  githubLinkClicks: number;
  archaeologyReviewCount: number;
  reviewPassCount: number;
  roomsTowardNextPass: number;
  archaeologyLog: ArchaeologyLogEntry[];
}

function parsePersistedProgression(raw: string | null): Partial<PersistedProgression> {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as PersistedProgression;
  } catch {
    return {};
  }
}

function resolveStorageKeys(): { writeKey: string; restoreKeys: string[] } {
  if (typeof localStorage === 'undefined') {
    return { writeKey: STORAGE_KEYS.progression, restoreKeys: [STORAGE_KEYS.progression] };
  }

  const selectedSourceRaw = localStorage.getItem(STORAGE_KEYS.selectedSource);
  const selectedSource = selectedSourceRaw ? parseSourceIdentityFromStorage(selectedSourceRaw) : null;
  if (!selectedSource) {
    return { writeKey: STORAGE_KEYS.progression, restoreKeys: [STORAGE_KEYS.progression] };
  }

  const restoreKeys = getProgressionRestoreKeys(selectedSource);
  return {
    writeKey: STORAGE_KEYS.progressionForSource(selectedSource),
    restoreKeys,
  };
}

function loadPersistedProgression(): Partial<PersistedProgression> {
  try {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    const { restoreKeys } = resolveStorageKeys();
    for (const key of restoreKeys) {
      const parsed = parsePersistedProgression(localStorage.getItem(key));
      if (Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function saveProgression(state: PersistedProgression): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const { writeKey } = resolveStorageKeys();
    localStorage.setItem(writeKey, JSON.stringify(state));
  } catch {
    // storage unavailable — silently ignore
  }
}

function buildStateFromSaved(saved: Partial<PersistedProgression>) {
  return {
    selectedClass: null as PlayerClass | null,
    level: saved.level ?? 1,
    totalXp: saved.totalXp ?? 0,
    xpTowardNextLevel: saved.xpTowardNextLevel ?? 0,
    inventory: saved.inventory ?? ([] as LootItem[]),
    unlockedBadges: saved.unlockedBadges ?? ([] as BadgeId[]),
    discoveryCount: saved.discoveryCount ?? 0,
    readmeCount: saved.readmeCount ?? 0,
    githubLinkClicks: saved.githubLinkClicks ?? 0,
    archaeologyReviewCount: saved.archaeologyReviewCount ?? 0,
    reviewPassCount: saved.reviewPassCount ?? 0,
    roomsTowardNextPass: saved.roomsTowardNextPass ?? 0,
    archaeologyLog: saved.archaeologyLog ?? ([] as ArchaeologyLogEntry[]),
  };
}

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
  archaeologyReviewCount: number;
  reviewPassCount: number;
  roomsTowardNextPass: number;
  archaeologyLog: ArchaeologyLogEntry[];

  // Actions
  setSelectedClass: (classId: PlayerClass) => void;
  updateProgression: (state: ProgressionState) => void;
  addLoot: (item: LootItem) => void;
  addBadge: (badgeId: BadgeId) => void;
  incrementDiscoveryCount: () => void;
  incrementReadmeCount: () => void;
  incrementGitHubLinkClicks: () => void;
  incrementArchaeologyReviewCount: () => void;
  incrementReviewPassCount: () => void;
  setRoomsTowardNextPass: (value: number) => void;
  addArchaeologyLogEntry: (entry: Omit<ArchaeologyLogEntry, 'id' | 'timestamp'> & Partial<Pick<ArchaeologyLogEntry, 'id' | 'timestamp'>>) => void;
  setInventory: (items: LootItem[]) => void;
  setBadges: (badges: BadgeId[]) => void;
  rehydrateFromActiveSource: () => void;
  reset: () => void;
}

const initialState = buildStateFromSaved(loadPersistedProgression());

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

  incrementArchaeologyReviewCount: () =>
    set((state) => ({
      archaeologyReviewCount: state.archaeologyReviewCount + 1,
    })),

  incrementReviewPassCount: () =>
    set((state) => ({
      reviewPassCount: state.reviewPassCount + 1,
    })),

  setRoomsTowardNextPass: (value) => set({ roomsTowardNextPass: Math.max(0, value) }),

  addArchaeologyLogEntry: (entry) =>
    set((state) => {
      const timestamp = entry.timestamp ?? Date.now();
      const id = entry.id ?? `${entry.action}:${entry.roomId}:${timestamp}`;
      const next = [...state.archaeologyLog, { ...entry, id, timestamp }];
      return {
        archaeologyLog: next.slice(-40),
      };
    }),

  setInventory: (items) => set({ inventory: items }),

  setBadges: (badges) => set({ unlockedBadges: badges }),

  rehydrateFromActiveSource: () =>
    set((state) => ({
      ...buildStateFromSaved(loadPersistedProgression()),
      selectedClass: state.selectedClass,
    })),

  reset: () => {
    set(buildStateFromSaved({}));
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const { restoreKeys } = resolveStorageKeys();
      restoreKeys.forEach((key) => localStorage.removeItem(key));
    } catch {
      // ignore
    }
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
    archaeologyReviewCount: state.archaeologyReviewCount,
    reviewPassCount: state.reviewPassCount,
    roomsTowardNextPass: state.roomsTowardNextPass,
    archaeologyLog: state.archaeologyLog,
  });
});
