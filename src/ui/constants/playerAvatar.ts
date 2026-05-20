import type { PlayerClass } from '@/game/config/classes';
import { resolveAssetPath } from '@/game/config/assetPaths';
import { getPlayerClassSprite } from '@/game/config/characterSprites';

export const PLAYER_AVATAR_PRIMARY_SRC = getPlayerClassSprite('explorer').assetPath;
export const PLAYER_AVATAR_FALLBACK_SRC = resolveAssetPath('/assets/sprites/player.svg');

export function getPlayerAvatarSrc(playerClass: PlayerClass | null | undefined): string {
	return getPlayerClassSprite(playerClass).assetPath;
}
