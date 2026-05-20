import { getBiomePresentation } from '@/game/config/biomePresentation';
import { resolveAssetPath } from '@/game/config/assetPaths';

export type PathwaySpriteId = 'straight' | 'corner' | 'end' | 'tee' | 'cross';

export interface PathwayMaterial {
  tint: number;
  alpha: number;
}

export interface PathwaySpriteDefinition {
  id: PathwaySpriteId;
  textureKey: string;
  assetPath: string;
  width: number;
  height: number;
  swapHint: string;
}

// Pathway SVGs are authored in a single base orientation and rotated in-scene.
// Keep replacements centered in the same 32x32 frame so Phaser rotation still lines up cleanly.
const PATHWAY_SPRITES: Record<PathwaySpriteId, PathwaySpriteDefinition> = {
  straight: {
    id: 'straight',
    textureKey: 'pathway-straight',
    assetPath: resolveAssetPath('/assets/sprites/pathways/straight.svg'),
    width: 32,
    height: 32,
    swapHint: 'Base orientation is horizontal, left-to-right through the center of the tile.',
  },
  corner: {
    id: 'corner',
    textureKey: 'pathway-corner',
    assetPath: resolveAssetPath('/assets/sprites/pathways/corner.svg'),
    width: 32,
    height: 32,
    swapHint: 'Base orientation connects right and down from the center joint.',
  },
  end: {
    id: 'end',
    textureKey: 'pathway-end',
    assetPath: resolveAssetPath('/assets/sprites/pathways/end.svg'),
    width: 32,
    height: 32,
    swapHint: 'Base orientation points from the center joint toward the right edge.',
  },
  tee: {
    id: 'tee',
    textureKey: 'pathway-tee',
    assetPath: resolveAssetPath('/assets/sprites/pathways/tee.svg'),
    width: 32,
    height: 32,
    swapHint: 'Base orientation opens left, right, and down from the center joint.',
  },
  cross: {
    id: 'cross',
    textureKey: 'pathway-cross',
    assetPath: resolveAssetPath('/assets/sprites/pathways/cross.svg'),
    width: 32,
    height: 32,
    swapHint: 'Base orientation is a four-way intersection centered in the tile.',
  },
};

export function getPathwaySprite(id: PathwaySpriteId): PathwaySpriteDefinition {
  return PATHWAY_SPRITES[id];
}

export function getAllPathwaySprites(): PathwaySpriteDefinition[] {
  return Object.values(PATHWAY_SPRITES);
}

export function getPathwayMaterialForBiomes(
  fromBiomeId: string | null | undefined,
  toBiomeId: string | null | undefined,
  edgeType: 'corridor' | 'gateway',
): PathwayMaterial {
  const fromPresentation = getBiomePresentation(fromBiomeId ?? 'lost-archive');
  const toPresentation = getBiomePresentation(toBiomeId ?? fromPresentation.biomeId);
  const tint = blendHexColors(fromPresentation.palette.accent, toPresentation.palette.accent);

  return {
    tint: edgeType === 'gateway' ? brightenColor(tint, 0.12) : tint,
    alpha: edgeType === 'gateway' ? 0.94 : 0.88,
  };
}

function blendHexColors(left: number, right: number): number {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);

  const red = Math.round((leftRgb.red + rightRgb.red) / 2);
  const green = Math.round((leftRgb.green + rightRgb.green) / 2);
  const blue = Math.round((leftRgb.blue + rightRgb.blue) / 2);

  return rgbToHex(red, green, blue);
}

function brightenColor(value: number, factor: number): number {
  const { red, green, blue } = hexToRgb(value);

  const nextRed = red + (255 - red) * factor;
  const nextGreen = green + (255 - green) * factor;
  const nextBlue = blue + (255 - blue) * factor;

  return rgbToHex(Math.round(nextRed), Math.round(nextGreen), Math.round(nextBlue));
}

function hexToRgb(value: number): { red: number; green: number; blue: number } {
  return {
    red: (value >> 16) & 0xff,
    green: (value >> 8) & 0xff,
    blue: value & 0xff,
  };
}

function rgbToHex(red: number, green: number, blue: number): number {
  return (red << 16) | (green << 8) | blue;
}