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

export type BadgeSignalKey =
  | 'discoveryCount'
  | 'readmeCount'
  | 'githubLinkClicks'
  | 'reviewPassCount';

export interface BadgeMilestone {
  target: number;
  label: string;
  unlockDetail: string;
}

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  icon: string;
  description: string;
  emoji: string;
  unlockDetail: string;
  signalKey?: BadgeSignalKey;
  milestones?: BadgeMilestone[];
}

export interface ProgressionSignals {
  discoveryCount: number;
  readmeCount: number;
  githubLinkClicks: number;
  reviewPassCount: number;
}

export interface BadgeProgress {
  current: number;
  unlocked: boolean;
  completedMilestones: number;
  totalMilestones: number;
  nextMilestone: BadgeMilestone | null;
  nextMilestoneProgress: number;
}

export interface RankThreshold {
  name: string;
  minXp: number;
}

export interface RankProgress {
  currentRank: RankThreshold;
  nextRank: RankThreshold | null;
  percentToNextRank: number;
}

export const EXPLORER_RANKS: RankThreshold[] = [
  { name: 'Seeker', minXp: 0 },
  { name: 'Pathfinder', minXp: 350 },
  { name: 'Cartographer', minXp: 900 },
  { name: 'Curator', minXp: 1800 },
  { name: 'Mythic Explorer', minXp: 3000 },
];

export const BADGES: Record<BadgeId, BadgeDefinition> = {
  'first-steps': {
    id: 'first-steps',
    name: 'First Steps',
    icon: '📍',
    emoji: '📍',
    description: 'Entered the dungeon for the first time',
    unlockDetail: 'Discover your first room.',
  },
  archaeologist: {
    id: 'archaeologist',
    name: 'Archaeologist',
    icon: '🔎',
    emoji: '🔎',
    description: 'Marked rooms as discoveries',
    unlockDetail: 'Discover 3 unique rooms to unlock this badge.',
    signalKey: 'discoveryCount',
    milestones: [
      { target: 3, label: 'Bronze Dig', unlockDetail: 'Discover 3 unique rooms.' },
      { target: 8, label: 'Silver Dig', unlockDetail: 'Discover 8 unique rooms.' },
      { target: 15, label: 'Golden Dig', unlockDetail: 'Discover 15 unique rooms.' },
    ],
  },
  'lore-keeper': {
    id: 'lore-keeper',
    name: 'Lore Keeper',
    icon: '📖',
    emoji: '📖',
    description: 'Read repository lore',
    unlockDetail: 'Read 10 READMEs in room panels.',
    signalKey: 'readmeCount',
    milestones: [{ target: 10, label: 'Lore Keeper', unlockDetail: 'Read 10 READMEs.' }],
  },
  'star-gazer': {
    id: 'star-gazer',
    name: 'Star Gazer',
    icon: '⭐',
    emoji: '⭐',
    description: 'Visited a repo with 1000+ stars',
    unlockDetail: 'Enter a room for a repository with at least 1,000 stars.',
  },
  'zone-cleared': {
    id: 'zone-cleared',
    name: 'Zone Cleared',
    icon: '🏛️',
    emoji: '🏛️',
    description: 'Completed archaeology review passes',
    unlockDetail: 'Complete 1 archaeology review pass.',
    signalKey: 'reviewPassCount',
    milestones: [
      { target: 1, label: 'First Pass', unlockDetail: 'Complete 1 review pass.' },
      { target: 3, label: 'Deep Pass', unlockDetail: 'Complete 3 review passes.' },
      { target: 6, label: 'Master Pass', unlockDetail: 'Complete 6 review passes.' },
    ],
  },
  'dungeon-master': {
    id: 'dungeon-master',
    name: 'Dungeon Master',
    icon: '👑',
    emoji: '👑',
    description: 'Visited all rooms in the dungeon',
    unlockDetail: 'Visit every room in the current dungeon run.',
  },
  'portal-walker': {
    id: 'portal-walker',
    name: 'Portal Walker',
    icon: '🌐',
    emoji: '🌐',
    description: 'Visited GitHub from room panels',
    unlockDetail: 'Use "Visit on GitHub" 5 times.',
    signalKey: 'githubLinkClicks',
    milestones: [{ target: 5, label: 'Portal Walker', unlockDetail: 'Click "Visit on GitHub" 5 times.' }],
  },
  'guild-finder': {
    id: 'guild-finder',
    name: 'Guild Finder',
    icon: '👫',
    emoji: '👫',
    description: 'Discovered a repo with 10+ contributors',
    unlockDetail: 'Enter a room for a repository with 10+ contributors.',
  },
  archivist: {
    id: 'archivist',
    name: 'Archivist',
    icon: '🗂️',
    emoji: '🗂️',
    description: 'Explored an archived repository',
    unlockDetail: 'Enter a room for an archived repository.',
  },
};

export function getBadgeSignalValue(signals: ProgressionSignals, badgeId: BadgeId): number {
  const signalKey = BADGES[badgeId].signalKey;
  if (!signalKey) {
    return 0;
  }
  return signals[signalKey];
}

export function getBadgeProgress(
  badgeId: BadgeId,
  signals: ProgressionSignals,
  unlocked: boolean,
): BadgeProgress {
  const definition = BADGES[badgeId];
  const milestones = definition.milestones ?? [];
  if (milestones.length === 0 || !definition.signalKey) {
    return {
      current: 0,
      unlocked,
      completedMilestones: unlocked ? 1 : 0,
      totalMilestones: unlocked ? 1 : 0,
      nextMilestone: null,
      nextMilestoneProgress: unlocked ? 100 : 0,
    };
  }

  const current = signals[definition.signalKey];
  const completedMilestones = milestones.filter((milestone) => current >= milestone.target).length;
  const nextMilestone = milestones.find((milestone) => current < milestone.target) ?? null;
  const previousTarget = milestones[Math.max(completedMilestones - 1, 0)]?.target ?? 0;
  const deltaTarget = (nextMilestone?.target ?? previousTarget) - previousTarget;
  const toward = Math.max(current - previousTarget, 0);
  const nextMilestoneProgress = nextMilestone
    ? Math.min(100, Math.round((toward / Math.max(deltaTarget, 1)) * 100))
    : 100;

  return {
    current,
    unlocked,
    completedMilestones,
    totalMilestones: milestones.length,
    nextMilestone,
    nextMilestoneProgress,
  };
}

export function getUnlockTarget(badgeId: BadgeId): number | null {
  const milestones = BADGES[badgeId].milestones;
  return milestones?.[0]?.target ?? null;
}

export function getRankProgress(totalXp: number): RankProgress {
  const currentRank = [...EXPLORER_RANKS].reverse().find((rank) => totalXp >= rank.minXp) ?? EXPLORER_RANKS[0];
  const currentIndex = EXPLORER_RANKS.findIndex((rank) => rank.name === currentRank.name);
  const nextRank = EXPLORER_RANKS[currentIndex + 1] ?? null;
  if (!nextRank) {
    return {
      currentRank,
      nextRank,
      percentToNextRank: 100,
    };
  }

  const floor = currentRank.minXp;
  const ceiling = nextRank.minXp;
  const percentToNextRank = Math.max(0, Math.min(100, Math.round(((totalXp - floor) / (ceiling - floor)) * 100)));
  return {
    currentRank,
    nextRank,
    percentToNextRank,
  };
}

export const REVIEW_PASS_ROOM_TARGET_MIN = 3;
export const REVIEW_PASS_ROOM_TARGET_MAX = 8;
