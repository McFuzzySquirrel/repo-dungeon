import type { PlayerClass } from '@/game/config/classes';
import { resolveAssetPath } from '@/game/config/assetPaths';

export interface CharacterSpriteDefinition {
  id: string;
  textureKey: string;
  assetPath: string;
}

export type NpcSpriteId = 'scribe' | 'smith' | 'contributor';

const PLAYER_CLASS_SPRITES: Record<PlayerClass, CharacterSpriteDefinition> = {
  explorer: {
    id: 'explorer',
    textureKey: 'sprite-player-explorer',
    assetPath: resolveAssetPath('/assets/sprites/player-explorer.svg'),
  },
  archivist: {
    id: 'archivist',
    textureKey: 'sprite-player-archivist',
    assetPath: resolveAssetPath('/assets/sprites/player-archivist.svg'),
  },
  hacker: {
    id: 'hacker',
    textureKey: 'sprite-player-hacker',
    assetPath: resolveAssetPath('/assets/sprites/player-hacker.svg'),
  },
  contributor: {
    id: 'contributor',
    textureKey: 'sprite-player-contributor',
    assetPath: resolveAssetPath('/assets/sprites/player-contributor.svg'),
  },
};

const NPC_SPRITES: Record<NpcSpriteId, CharacterSpriteDefinition> = {
  scribe: {
    id: 'scribe',
    textureKey: 'sprite-npc-scribe',
    assetPath: resolveAssetPath('/assets/sprites/npc-scribe.svg'),
  },
  smith: {
    id: 'smith',
    textureKey: 'sprite-npc-smith',
    assetPath: resolveAssetPath('/assets/sprites/npc-smith.svg'),
  },
  contributor: {
    id: 'contributor',
    textureKey: 'sprite-npc-contributor',
    assetPath: resolveAssetPath('/assets/sprites/npc-contributor.svg'),
  },
};

const NPC_SPRITE_ORDER: NpcSpriteId[] = ['scribe', 'smith', 'contributor'];

export function getPlayerClassSprite(playerClass: PlayerClass | null | undefined): CharacterSpriteDefinition {
  return PLAYER_CLASS_SPRITES[playerClass ?? 'explorer'];
}

export function getAllPlayerClassSprites(): CharacterSpriteDefinition[] {
  return Object.values(PLAYER_CLASS_SPRITES);
}

export function getAllNpcSprites(): CharacterSpriteDefinition[] {
  return Object.values(NPC_SPRITES);
}

export function getNpcSpriteForSeed(seed: string): CharacterSpriteDefinition {
  const index = hashString(seed) % NPC_SPRITE_ORDER.length;
  return NPC_SPRITES[NPC_SPRITE_ORDER[index]];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}