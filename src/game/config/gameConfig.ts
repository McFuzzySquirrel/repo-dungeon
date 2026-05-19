import Phaser from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { StaticRoomScene } from '@/game/scenes/StaticRoomScene';
import { DungeonScene } from '@/game/scenes/DungeonScene';

export const GAME_DIMENSIONS = {
  width: 960,
  height: 720,
};

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_DIMENSIONS.width,
    height: GAME_DIMENSIONS.height,
    backgroundColor: '#0d0f16',
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, StaticRoomScene, DungeonScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };
}
