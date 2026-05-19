/**
 * LootGenerator creates loot items based on repository properties
 */

import type { PlayerClass } from '@/game/config/classes';
import type { GitHubRoomData } from '@/github/types';

export type LootRarity = 'common' | 'uncommon' | 'rare';

export interface LootItem {
  id: string;
  name: string;
  rarity: LootRarity;
  repo: string;
  repoUrl: string;
  language?: string;
  description: string;
  timestamp: number;
}

interface LootDropRule {
  condition: (roomData: GitHubRoomData) => boolean;
  name: string;
  rarity: LootRarity;
  description: string;
}

/**
 * Loot table - rules for generating loot based on repo properties
 */
const LOOT_TABLE: LootDropRule[] = [
  {
    condition: (data) => data.repo.language?.toLowerCase().includes('javascript') ?? false,
    name: 'Golden Console',
    rarity: 'common',
    description: 'A shimmering browser console filled with logs of discovery',
  },
  {
    condition: (data) => data.repo.language?.toLowerCase().includes('python') ?? false,
    name: 'Serpent Tome',
    rarity: 'common',
    description: 'An ancient tome bound in scales, filled with Python wisdom',
  },
  {
    condition: (data) => data.repo.language?.toLowerCase().includes('rust') ?? false,
    name: 'Iron Ingot',
    rarity: 'common',
    description: 'A piece of unyielding iron, forged in safety',
  },
  {
    condition: (data) => data.repo.language?.toLowerCase().includes('typescript') ?? false,
    name: 'Blueprint Scroll',
    rarity: 'common',
    description: 'A precisely drawn blueprint with type annotations in the margins',
  },
  {
    condition: (data) => data.repo.topics.length > 0,
    name: 'Tag Rune',
    rarity: 'common',
    description: 'A mystical rune inscribed with repository tags',
  },
  {
    condition: (data) => data.repo.stargazersCount >= 100 && data.repo.stargazersCount < 1000,
    name: 'Star Fragment',
    rarity: 'uncommon',
    description: 'A fragment of light from a favorited repository',
  },
  {
    condition: (data) => data.repo.stargazersCount >= 1000,
    name: 'Legendary Star Crystal',
    rarity: 'rare',
    description: 'A radiant crystal formed from thousands of stars',
  },
  {
    condition: (data) => data.contributors.length > 5,
    name: 'Guild Crest',
    rarity: 'uncommon',
    description: 'An emblem symbolizing the contributions of many developers',
  },
  {
    condition: (data) => data.readme.plainText !== null && data.readme.plainText.length > 0,
    name: 'Ancient Scroll',
    rarity: 'common',
    description: 'A well-worn manuscript containing project documentation',
  },
  {
    condition: () => false, // Handled separately: is_fork
    name: 'Mirror Shard',
    rarity: 'uncommon',
    description: 'A reflective fragment from a forked repository',
  },
  {
    condition: () => false, // Handled separately: is_archived
    name: 'Fossilized Code',
    rarity: 'rare',
    description: 'Preserved code from a repository frozen in time',
  },
];

/**
 * Generate a unique ID for a loot item
 */
function generateLootId(roomData: GitHubRoomData, itemName: string, index: number): string {
  return `loot-${roomData.repo.fullName}-${itemName.replace(/\s+/g, '-').toLowerCase()}-${index}-${Date.now()}`;
}

/**
 * Determine if a repo is "README-heavy" for Archivist bonus
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
 * Check if a repo is a fork (special case)
 */
function isForkRepo(roomData: GitHubRoomData): boolean {
  // Note: GitHubRoomData doesn't include isFork, so we'll check fullName pattern
  // In real implementation, this would come from the repo metadata
  return roomData.repo.fullName.includes('/');
}

/**
 * Generate loot for a room
 */
export function generateLoot(roomData: GitHubRoomData, selectedClass: PlayerClass): LootItem[] {
  const items: LootItem[] = [];
  const appliedRules = new Set<string>();

  // Generate loot based on rules
  for (const rule of LOOT_TABLE) {
    if (rule.condition(roomData)) {
      const itemName = rule.name;
      if (!appliedRules.has(itemName)) {
        appliedRules.add(itemName);
        const lootItem: LootItem = {
          id: generateLootId(roomData, itemName, items.length),
          name: itemName,
          rarity: rule.rarity,
          repo: roomData.repo.name,
          repoUrl: roomData.repo.htmlUrl,
          language: roomData.repo.language ?? undefined,
          description: rule.description,
          timestamp: Date.now(),
        };
        items.push(lootItem);
      }
    }
  }

  // Handle fork status
  if (isForkRepo(roomData) && !appliedRules.has('Mirror Shard')) {
    items.push({
      id: generateLootId(roomData, 'Mirror Shard', items.length),
      name: 'Mirror Shard',
      rarity: 'uncommon',
      repo: roomData.repo.name,
      repoUrl: roomData.repo.htmlUrl,
      language: roomData.repo.language ?? undefined,
      description: 'A reflective fragment from a forked repository',
      timestamp: Date.now(),
    });
    appliedRules.add('Mirror Shard');
  }

  // Handle archived status (this would need to come from repo metadata)
  // For now, we skip this as it's not in GitHubRoomData

  // Apply class modifiers to get additional items
  if (selectedClass === 'archivist' && isReadmeHeavyRepo(roomData)) {
    // Archivist gets 2x loot from README-heavy repos
    // Duplicate current items (max 3 additional)
    const toAdd = Math.min(items.length, 3);
    for (let i = 0; i < toAdd; i++) {
      const original = items[i];
      items.push({
        ...original,
        id: generateLootId(roomData, original.name + '-duplicate', items.length),
        timestamp: Date.now(),
      });
    }
  }

  if (selectedClass === 'contributor' && roomData.contributors.length > 5) {
    // Contributor gets 1.5x loot from multi-contributor repos
    // Add 50% more items
    const toAdd = Math.ceil(items.length * 0.5);
    for (let i = 0; i < toAdd && i < items.length; i++) {
      const original = items[i];
      items.push({
        ...original,
        id: generateLootId(roomData, original.name + '-extra', items.length),
        timestamp: Date.now(),
      });
    }
  }

  // Limit loot drops to reasonable amounts (max 3-4 items per room)
  return items.slice(0, 4);
}
