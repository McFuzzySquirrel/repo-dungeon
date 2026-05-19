/**
 * useProgression hook - provides access to player progression state
 */

import { useProgressionStore } from '@/store/progressionStore';
import { CLASSES } from '@/game/config/classes';

export function useProgression() {
  const {
    selectedClass,
    level,
    totalXp,
    xpTowardNextLevel,
    inventory,
    unlockedBadges,
  } = useProgressionStore();

  const classConfig = selectedClass ? CLASSES[selectedClass] : null;

  // Calculate XP bar progress (assuming ~300 XP per level on average)
  const maxXpPerLevel = 300;
  const xpProgress = Math.min((xpTowardNextLevel / maxXpPerLevel) * 100, 100);

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
  };
}
