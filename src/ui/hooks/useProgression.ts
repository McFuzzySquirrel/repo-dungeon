/**
 * useProgression hook - provides access to player progression state
 */

import { useProgressionStore } from '@/store/progressionStore';
import { CLASSES } from '@/game/config/classes';
import { getXpForNextLevel } from '@/game/systems/ProgressionTracker';
import { getRankProgress } from '@/game/systems/progressionEngine';

export function useProgression() {
  const {
    selectedClass,
    level,
    totalXp,
    xpTowardNextLevel,
    inventory,
    unlockedBadges,
    archaeologyReviewCount,
    reviewPassCount,
    roomsTowardNextPass,
    archaeologyLog,
  } = useProgressionStore();

  const classConfig = selectedClass ? CLASSES[selectedClass] : null;

  const maxXpPerLevel = getXpForNextLevel(level);
  const xpProgress = Math.min((xpTowardNextLevel / maxXpPerLevel) * 100, 100);
  const rankProgress = getRankProgress(totalXp);

  return {
    selectedClass,
    classConfig,
    level,
    totalXp,
    xpTowardNextLevel,
    xpProgress,
    inventory,
    inventoryCount: inventory.length,
    unlockedBadges,
    badgeCount: unlockedBadges.length,
    archaeologyReviewCount,
    reviewPassCount,
    roomsTowardNextPass,
    archaeologyLog,
    rankProgress,
  };
}
