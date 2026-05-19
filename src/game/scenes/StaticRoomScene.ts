import Phaser from 'phaser';
import { GAME_DIMENSIONS } from '@/game/config/gameConfig';

const TILE_SIZE = 64;

export class StaticRoomScene extends Phaser.Scene {
  constructor() {
    super('StaticRoomScene');
  }

  preload(): void {}

  create(): void {
    this.cameras.main.setBackgroundColor('#171b27');

    const cols = Math.ceil(GAME_DIMENSIONS.width / TILE_SIZE);
    const rows = Math.ceil(GAME_DIMENSIONS.height / TILE_SIZE);

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const isBoundary = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        const color = isBoundary ? 0x2e3b5f : (x + y) % 2 === 0 ? 0x1e273f : 0x243050;
        const alpha = isBoundary ? 1 : 0.85;
        this.add
          .rectangle(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE - 2,
            TILE_SIZE - 2,
            color,
            alpha,
          )
          .setStrokeStyle(1, 0x0f1424);
      }
    }

    this.add
      .rectangle(GAME_DIMENSIONS.width / 2, GAME_DIMENSIONS.height / 2, 120, 120, 0x52a9ff, 0.9)
      .setStrokeStyle(3, 0xd9f0ff);

    this.add
      .text(GAME_DIMENSIONS.width / 2, 30, 'Static Repo Room', {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '24px',
      })
      .setOrigin(0.5, 0);
  }

  update(): void {}
}
