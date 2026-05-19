/**
 * Character class definitions for Repo Dungeon
 * Each class has distinct bonuses and special abilities
 */

export type PlayerClass = 'explorer' | 'archivist' | 'hacker' | 'contributor';

export interface ClassDefinition {
  id: PlayerClass;
  name: string;
  description: string;
  color: string; // hex color for UI
  emoji: string;
  startingBonus: string;
  specialAbility: string;
  xpMultiplier: number; // base 1.0
  readmeXpMultiplier: number; // base 1.0
  codeHeavyXpMultiplier: number; // base 1.0
  collaborativeXpMultiplier: number; // base 1.0
}

export const CLASSES: Record<PlayerClass, ClassDefinition> = {
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Balanced adventurer focused on discovering new repositories',
    color: '#4a9eff',
    emoji: '🗺️',
    startingBonus: '+10% XP (discovery bonus)',
    specialAbility: 'Start with "Pathfinder" badge if visiting 5 unique repos in first session',
    xpMultiplier: 1.1,
    readmeXpMultiplier: 1.0,
    codeHeavyXpMultiplier: 1.0,
    collaborativeXpMultiplier: 1.0,
  },
  archivist: {
    id: 'archivist',
    name: 'Archivist',
    description: 'Knowledge seeker who reads faster and learns from documentation',
    color: '#9b59b6',
    emoji: '📚',
    startingBonus: '+20% XP from READMEs, faster README reading',
    specialAbility: 'Bonus 2x loot from README-heavy repos',
    xpMultiplier: 1.0,
    readmeXpMultiplier: 1.2,
    codeHeavyXpMultiplier: 1.0,
    collaborativeXpMultiplier: 1.0,
  },
  hacker: {
    id: 'hacker',
    name: 'Hacker',
    description: 'Code explorer who thrives on complex, low-level repositories',
    color: '#2ecc71',
    emoji: '💻',
    startingBonus: '+25% XP from code-heavy repos (Rust, C, assembly)',
    specialAbility: 'Unlock "hidden topics" (additional topics earned)',
    xpMultiplier: 1.0,
    readmeXpMultiplier: 1.0,
    codeHeavyXpMultiplier: 1.25,
    collaborativeXpMultiplier: 1.0,
  },
  contributor: {
    id: 'contributor',
    name: 'Contributor',
    description: 'Community builder who excels in collaborative environments',
    color: '#e74c3c',
    emoji: '👥',
    startingBonus: '+15% XP from highly-collaborative repos (5+ contributors)',
    specialAbility: 'Bonus 1.5x loot from multi-contributor repos',
    xpMultiplier: 1.0,
    readmeXpMultiplier: 1.0,
    codeHeavyXpMultiplier: 1.0,
    collaborativeXpMultiplier: 1.15,
  },
};

/**
 * Code-heavy languages that trigger Hacker bonus
 */
export const CODE_HEAVY_LANGUAGES = ['rust', 'c', 'assembly', 'c++', 'asm', 'wasm'];

/**
 * Get a class definition by ID
 */
export function getClass(classId: PlayerClass): ClassDefinition {
  return CLASSES[classId];
}
