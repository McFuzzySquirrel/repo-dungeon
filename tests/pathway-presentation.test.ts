import { describe, expect, it } from 'vitest';
import { getAllPathwaySprites, getPathwayMaterialForBiomes, getPathwaySprite } from '@/game/config/pathwayPresentation';

describe('pathway presentation config', () => {
  it('returns the shipped pathway sprite collection', () => {
    const all = getAllPathwaySprites();

    expect(all).toHaveLength(5);
    expect(all.map((sprite) => sprite.id)).toEqual(['straight', 'corner', 'end', 'tee', 'cross']);
  });

  it('maps sprite ids to unique texture keys and asset paths', () => {
    const straight = getPathwaySprite('straight');
    const corner = getPathwaySprite('corner');

    expect(straight.textureKey).not.toBe(corner.textureKey);
    expect(straight.assetPath).toContain('/assets/sprites/pathways/');
    expect(corner.assetPath).toContain('/assets/sprites/pathways/');
  });

  it('derives pathway materials from biome accent colors', () => {
    const neonCorridor = getPathwayMaterialForBiomes('neon-circuit-city', 'neon-circuit-city', 'corridor');
    const mixedGateway = getPathwayMaterialForBiomes('ancient-library', 'iron-forge', 'gateway');

    expect(neonCorridor.tint).toBe(0x63f5ff);
    expect(neonCorridor.alpha).toBe(0.88);
    expect(mixedGateway.tint).not.toBe(neonCorridor.tint);
    expect(mixedGateway.alpha).toBe(0.94);
  });
});