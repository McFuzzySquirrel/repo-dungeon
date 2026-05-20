import Phaser from 'phaser';
import { getPlayerClassSprite } from '@/game/config/characterSprites';
import type { PlayerClass } from '@/game/config/classes';
import type { DungeonPoint, DungeonRoomNode } from '@/game/systems/dungeonTypes';

interface KeyLike {
  isDown: boolean;
}

interface NavigationRegion {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PlayerState {
  position: DungeonPoint;
  currentRoomId: string;
  facingDirection: 'up' | 'down' | 'left' | 'right';
}

/**
 * Player entity representing the controllable character in the dungeon.
 * Handles position, room tracking, and animation state.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private currentRoom: DungeonRoomNode | null = null;
  private facingDirection: 'up' | 'down' | 'left' | 'right' = 'down';

  private readonly MOVE_SPEED = 340; // pixels per second
  private readonly PLAYER_RADIUS = 8; // collision radius

  constructor(scene: Phaser.Scene, x: number, y: number, playerClass: PlayerClass = 'explorer') {
    const classTextureKey = getPlayerClassSprite(playerClass).textureKey;
    const textureKey = scene.textures.exists(classTextureKey)
      ? classTextureKey
      : scene.textures.exists('sprite-player')
        ? 'sprite-player'
        : 'player-placeholder';
    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set up physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(0);
    body.setDrag(1);
    body.setMaxSpeed(this.MOVE_SPEED);

    // Create a simple circle representation if no sprite available
    this.setDisplaySize(22, 22);
    if (textureKey === 'player-placeholder') {
      this.setTint(0x4a90e2);
    }
  }

  applyClassVisual(playerClass: PlayerClass): void {
    const textureKey = getPlayerClassSprite(playerClass).textureKey;
    if (this.scene.textures.exists(textureKey)) {
      this.setTexture(textureKey);
      this.clearTint();
      this.setDisplaySize(22, 22);
      return;
    }

    if (this.scene.textures.exists('sprite-player')) {
      this.setTexture('sprite-player');
      this.clearTint();
      this.setDisplaySize(22, 22);
      return;
    }

    this.setTexture('player-placeholder');
    this.setTint(0x4a90e2);
    this.setDisplaySize(22, 22);
  }

  /**
   * Set the current room the player is in.
   */
  setCurrentRoom(room: DungeonRoomNode | null): void {
    this.currentRoom = room;
  }

  /**
   * Get the current room the player is in.
   */
  getCurrentRoom(): DungeonRoomNode | null {
    return this.currentRoom;
  }

  /**
   * Get the current facing direction.
   */
  getFacingDirection(): 'up' | 'down' | 'left' | 'right' {
    return this.facingDirection;
  }

  /**
   * Update facing direction and velocity based on input.
   */
  updateMovement(cursors: {
    up: KeyLike;
    down: KeyLike;
    left: KeyLike;
    right: KeyLike;
  }, speedMultiplier = 1): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const movementSpeed = this.MOVE_SPEED * Phaser.Math.Clamp(speedMultiplier, 0.8, 2.2);

    // Reset velocity
    body.setVelocity(0, 0);

    let vx = 0;
    let vy = 0;

    // Check input
    if (cursors.up.isDown) {
      vy = -movementSpeed;
      this.facingDirection = 'up';
    }
    if (cursors.down.isDown) {
      vy = movementSpeed;
      this.facingDirection = 'down';
    }
    if (cursors.left.isDown) {
      vx = -movementSpeed;
      this.facingDirection = 'left';
    }
    if (cursors.right.isDown) {
      vx = movementSpeed;
      this.facingDirection = 'right';
    }

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    body.setVelocity(vx, vy);
  }

  /**
   * Constrain player movement to a rectangular room bounds with collision margin.
   */
  constrainToRoomBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    const constrainedX = Phaser.Math.Clamp(this.x, minX + this.PLAYER_RADIUS, maxX - this.PLAYER_RADIUS);
    const constrainedY = Phaser.Math.Clamp(this.y, minY + this.PLAYER_RADIUS, maxY - this.PLAYER_RADIUS);

    if (constrainedX !== this.x || constrainedY !== this.y) {
      this.setPosition(constrainedX, constrainedY);
      body.setVelocity(0, 0);
    }
  }

  /**
   * Keep player inside any navigable region (rooms and corridor bands).
   */
  constrainToNavigationRegions(regions: NavigationRegion[]): void {
    if (regions.length === 0) {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;

    for (const region of regions) {
      const minX = region.minX + this.PLAYER_RADIUS;
      const minY = region.minY + this.PLAYER_RADIUS;
      const maxX = region.maxX - this.PLAYER_RADIUS;
      const maxY = region.maxY - this.PLAYER_RADIUS;

      if (this.x >= minX && this.x <= maxX && this.y >= minY && this.y <= maxY) {
        return;
      }
    }

    let closestX = this.x;
    let closestY = this.y;
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    for (const region of regions) {
      const minX = region.minX + this.PLAYER_RADIUS;
      const minY = region.minY + this.PLAYER_RADIUS;
      const maxX = region.maxX - this.PLAYER_RADIUS;
      const maxY = region.maxY - this.PLAYER_RADIUS;

      const candidateX = Phaser.Math.Clamp(this.x, minX, maxX);
      const candidateY = Phaser.Math.Clamp(this.y, minY, maxY);
      const dx = this.x - candidateX;
      const dy = this.y - candidateY;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closestX = candidateX;
        closestY = candidateY;
      }
    }

    if (closestX !== this.x || closestY !== this.y) {
      this.setPosition(closestX, closestY);
      body.setVelocity(0, 0);
    }
  }

  /**
   * Get the player's current state for export to other systems.
   */
  getState(): PlayerState {
    return {
      position: {
        x: Math.round(this.x),
        y: Math.round(this.y),
      },
      currentRoomId: this.currentRoom?.id ?? 'unknown',
      facingDirection: this.facingDirection,
    };
  }

  /**
   * Check if the player is within a given rectangular region.
   */
  isInRegion(minX: number, minY: number, maxX: number, maxY: number): boolean {
    return this.x >= minX && this.x <= maxX && this.y >= minY && this.y <= maxY;
  }
}
