import { describe, expect, it } from 'vitest';
import { getAllNpcSprites, getAllPlayerClassSprites, getNpcSpriteForSeed, getPlayerClassSprite } from '@/game/config/characterSprites';

describe('character sprite config', () => {
  it('returns a sprite for each player class', () => {
    const all = getAllPlayerClassSprites();
    expect(all).toHaveLength(4);
    expect(getPlayerClassSprite('explorer').textureKey).toBe('sprite-player-explorer');
    expect(getPlayerClassSprite('contributor').assetPath).toContain('player-contributor.svg');
  });

  it('returns deterministic npc variants', () => {
    const all = getAllNpcSprites();
    expect(all).toHaveLength(3);
    expect(getNpcSpriteForSeed('room:repo:1:npc:0').textureKey).toBe(getNpcSpriteForSeed('room:repo:1:npc:0').textureKey);
  });
});