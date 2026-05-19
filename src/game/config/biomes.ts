import type { GitHubRepoSummary } from '@/github/types';

export interface BiomeTheme {
  id: string;
  name: string;
  visualTheme: string;
}

export type ZoneSource = 'language' | 'topic' | 'misc';

export interface ZoneClassification {
  zoneKey: string;
  zoneLabel: string;
  source: ZoneSource;
  biome: BiomeTheme;
}

const LOST_ARCHIVE_BIOME: BiomeTheme = {
  id: 'lost-archive',
  name: 'Lost Archive',
  visualTheme: 'Sepia tones, dusty parchment textures',
};

const BIOME_BY_LANGUAGE: Record<string, BiomeTheme> = {
  javascript: {
    id: 'neon-circuit-city',
    name: 'Neon Circuit City',
    visualTheme: 'Glowing cyan/purple grid floors, circuit-board walls',
  },
  typescript: {
    id: 'neon-circuit-city',
    name: 'Neon Circuit City',
    visualTheme: 'Glowing cyan/purple grid floors, circuit-board walls',
  },
  python: {
    id: 'ancient-library',
    name: 'Ancient Library',
    visualTheme: 'Stone shelves, scrolls, warm amber torchlight',
  },
  rust: {
    id: 'iron-forge',
    name: 'Iron Forge',
    visualTheme: 'Metal grates, forge fires, orange/grey palette',
  },
  go: {
    id: 'wind-temple',
    name: 'Wind Temple',
    visualTheme: 'Light stone, sky motifs, green/white palette',
  },
  c: {
    id: 'deep-dungeon',
    name: 'Deep Dungeon',
    visualTheme: 'Classic grey stone, darker palette',
  },
  'c++': {
    id: 'deep-dungeon',
    name: 'Deep Dungeon',
    visualTheme: 'Classic grey stone, darker palette',
  },
  shell: {
    id: 'utility-vault',
    name: 'Utility Vault',
    visualTheme: 'Industrial pipes, utility theme',
  },
  config: {
    id: 'utility-vault',
    name: 'Utility Vault',
    visualTheme: 'Industrial pipes, utility theme',
  },
  html: {
    id: 'garden-ruins',
    name: 'Garden Ruins',
    visualTheme: 'Vines, pastel colours, ruined stonework',
  },
  css: {
    id: 'garden-ruins',
    name: 'Garden Ruins',
    visualTheme: 'Vines, pastel colours, ruined stonework',
  },
};

const LANGUAGE_ALIASES: Record<string, string> = {
  'objective-c': 'c',
  'objective-c++': 'c++',
  zsh: 'shell',
  bash: 'shell',
  sh: 'shell',
  scss: 'css',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function toZoneLabel(value: string): string {
  return value
    .split(/[\s_-]+/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function classifyRepoZone(repo: GitHubRepoSummary): ZoneClassification {
  if (repo.language) {
    const normalizedLanguage = normalizeKey(repo.language);
    const canonicalLanguage = LANGUAGE_ALIASES[normalizedLanguage] ?? normalizedLanguage;
    const biome = BIOME_BY_LANGUAGE[canonicalLanguage] ?? LOST_ARCHIVE_BIOME;

    return {
      zoneKey: `language:${canonicalLanguage}`,
      zoneLabel: toZoneLabel(repo.language),
      source: 'language',
      biome,
    };
  }

  const firstTopic = repo.topics[0];
  if (firstTopic) {
    const normalizedTopic = normalizeKey(firstTopic);
    const canonicalTopic = LANGUAGE_ALIASES[normalizedTopic] ?? normalizedTopic;
    const biome = BIOME_BY_LANGUAGE[canonicalTopic] ?? LOST_ARCHIVE_BIOME;

    return {
      zoneKey: `topic:${canonicalTopic}`,
      zoneLabel: toZoneLabel(firstTopic),
      source: 'topic',
      biome,
    };
  }

  return {
    zoneKey: 'misc:miscellaneous',
    zoneLabel: 'Miscellaneous',
    source: 'misc',
    biome: LOST_ARCHIVE_BIOME,
  };
}

