import type { BiomeTheme } from '@/game/config/biomes';
import { resolveAssetPath } from '@/game/config/assetPaths';

export interface BiomePalette {
  floor: number;
  wall: number;
  accent: number;
  prop: number;
}

export interface BiomePresentation {
  biomeId: string;
  tilesetTextureKey: string;
  tilesetAssetPath?: string;
  placeholderPattern: 'grid' | 'stone' | 'forge' | 'wind' | 'dungeon' | 'pipes' | 'vines' | 'parchment';
  palette: BiomePalette;
  ambientAudio: {
    key: string;
    path: string;
    volume: number;
  };
}

const DEFAULT_PRESENTATION: BiomePresentation = {
  biomeId: 'lost-archive',
  tilesetTextureKey: 'tileset-lost-archive',
  tilesetAssetPath: resolveAssetPath('/assets/tilesets/lost-archive.svg'),
  placeholderPattern: 'parchment',
  palette: {
    floor: 0x6b5d4f,
    wall: 0x3b3329,
    accent: 0xcbb89d,
    prop: 0x8f7a63,
  },
  ambientAudio: {
    key: 'ambient-lost-archive',
    path: resolveAssetPath('/assets/audio/ambient/lost-archive.ogg'),
    volume: 0.2,
  },
};

const BIOME_PRESENTATIONS: Record<string, BiomePresentation> = {
  'neon-circuit-city': {
    biomeId: 'neon-circuit-city',
    tilesetTextureKey: 'tileset-neon-circuit-city',
    tilesetAssetPath: resolveAssetPath('/assets/tilesets/neon-circuit-city.svg'),
    placeholderPattern: 'grid',
    palette: {
      floor: 0x243a7a,
      wall: 0x171f47,
      accent: 0x63f5ff,
      prop: 0xb869ff,
    },
    ambientAudio: {
      key: 'ambient-neon-circuit-city',
      path: resolveAssetPath('/assets/audio/ambient/neon-circuit-city.ogg'),
      volume: 0.22,
    },
  },
  'ancient-library': {
    biomeId: 'ancient-library',
    tilesetTextureKey: 'tileset-ancient-library',
    tilesetAssetPath: resolveAssetPath('/assets/tilesets/ancient-library.svg'),
    placeholderPattern: 'stone',
    palette: {
      floor: 0x70553f,
      wall: 0x4b3629,
      accent: 0xf7c06d,
      prop: 0xd9a066,
    },
    ambientAudio: {
      key: 'ambient-ancient-library',
      path: resolveAssetPath('/assets/audio/ambient/ancient-library.ogg'),
      volume: 0.18,
    },
  },
  'iron-forge': {
    biomeId: 'iron-forge',
    tilesetTextureKey: 'tileset-iron-forge',
    tilesetAssetPath: resolveAssetPath('/assets/tilesets/iron-forge.svg'),
    placeholderPattern: 'forge',
    palette: {
      floor: 0x594238,
      wall: 0x2d2624,
      accent: 0xff8f4a,
      prop: 0xb8b4ae,
    },
    ambientAudio: {
      key: 'ambient-iron-forge',
      path: resolveAssetPath('/assets/audio/ambient/iron-forge.ogg'),
      volume: 0.2,
    },
  },
  'wind-temple': {
    biomeId: 'wind-temple',
    tilesetTextureKey: 'tileset-wind-temple',
    tilesetAssetPath: resolveAssetPath('/assets/tilesets/wind-temple.svg'),
    placeholderPattern: 'wind',
    palette: {
      floor: 0x6ba8a1,
      wall: 0x446d6d,
      accent: 0xeaffff,
      prop: 0x8ac6a6,
    },
    ambientAudio: {
      key: 'ambient-wind-temple',
      path: resolveAssetPath('/assets/audio/ambient/wind-temple.ogg'),
      volume: 0.17,
    },
  },
  'deep-dungeon': {
    biomeId: 'deep-dungeon',
    tilesetTextureKey: 'tileset-deep-dungeon',
    tilesetAssetPath: resolveAssetPath('/assets/tilesets/deep-dungeon.svg'),
    placeholderPattern: 'dungeon',
    palette: {
      floor: 0x474747,
      wall: 0x252525,
      accent: 0xb8b8b8,
      prop: 0x6c6c6c,
    },
    ambientAudio: {
      key: 'ambient-deep-dungeon',
      path: resolveAssetPath('/assets/audio/ambient/deep-dungeon.ogg'),
      volume: 0.16,
    },
  },
  'utility-vault': {
    biomeId: 'utility-vault',
    tilesetTextureKey: 'tileset-utility-vault',
    tilesetAssetPath: resolveAssetPath('/assets/tilesets/utility-vault.svg'),
    placeholderPattern: 'pipes',
    palette: {
      floor: 0x4e5a61,
      wall: 0x2f363d,
      accent: 0x94c4df,
      prop: 0x8e9988,
    },
    ambientAudio: {
      key: 'ambient-utility-vault',
      path: resolveAssetPath('/assets/audio/ambient/utility-vault.ogg'),
      volume: 0.16,
    },
  },
  'garden-ruins': {
    biomeId: 'garden-ruins',
    tilesetTextureKey: 'tileset-garden-ruins',
    tilesetAssetPath: resolveAssetPath('/assets/tilesets/garden-ruins.svg'),
    placeholderPattern: 'vines',
    palette: {
      floor: 0x7f9f76,
      wall: 0x4d5f42,
      accent: 0xbdf2b2,
      prop: 0xd4b8c8,
    },
    ambientAudio: {
      key: 'ambient-garden-ruins',
      path: resolveAssetPath('/assets/audio/ambient/garden-ruins.ogg'),
      volume: 0.19,
    },
  },
  'lost-archive': DEFAULT_PRESENTATION,
};

export function getBiomePresentation(biomeId: string): BiomePresentation {
  return BIOME_PRESENTATIONS[biomeId] ?? DEFAULT_PRESENTATION;
}

export function getBiomePresentationForTheme(theme: BiomeTheme): BiomePresentation {
  return getBiomePresentation(theme.id);
}

export function getAllBiomePresentations(): BiomePresentation[] {
  return Object.values(BIOME_PRESENTATIONS);
}
