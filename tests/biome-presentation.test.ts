import { describe, expect, it } from 'vitest';
import { getAllBiomePresentations, getBiomePresentation } from '@/game/config/biomePresentation';

describe('biome presentation config', () => {
  it('returns all 8 biome presentation entries', () => {
    const all = getAllBiomePresentations();
    expect(all.length).toBe(8);
  });

  it('maps known biome to distinct placeholder texture and ambient key', () => {
    const neon = getBiomePresentation('neon-circuit-city');
    const rust = getBiomePresentation('iron-forge');

    expect(neon.tilesetTextureKey).not.toBe(rust.tilesetTextureKey);
    expect(neon.ambientAudio.key).not.toBe(rust.ambientAudio.key);
    expect(neon.palette.floor).not.toBe(rust.palette.floor);
  });

  it('falls back to lost archive for unknown biome ids', () => {
    const fallback = getBiomePresentation('unknown-biome-id');
    expect(fallback.biomeId).toBe('lost-archive');
  });
});
