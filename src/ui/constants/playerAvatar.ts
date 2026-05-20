import type { PlayerClass } from '@/game/config/classes';
import { getPlayerClassSprite } from '@/game/config/characterSprites';

export const PLAYER_AVATAR_PRIMARY_SRC = getPlayerClassSprite('explorer').assetPath;
export const PLAYER_AVATAR_FALLBACK_SRC = '/assets/sprites/player.svg';

export function getPlayerAvatarSrc(playerClass: PlayerClass | null | undefined): string {
	return getPlayerClassSprite(playerClass).assetPath;
}
