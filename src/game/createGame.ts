import Phaser from 'phaser';
import { createGameConfig } from '@/game/config/gameConfig';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game(createGameConfig(parent));
}
