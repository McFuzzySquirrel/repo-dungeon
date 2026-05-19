import Phaser from 'phaser';
import type { DungeonPoint, DungeonRoomNode } from '@/game/systems/dungeonTypes';

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

  private readonly MOVE_SPEED = 200; // pixels per second
  private readonly PLAYER_RADIUS = 8; // collision radius

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set up physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(0);
    body.setDrag(1);
    body.setMaxSpeed(this.MOVE_SPEED);

    // Create a simple circle representation if no sprite available
    this.setDisplaySize(16, 16);
    this.setTint(0x4a90e2);
  }

  /**
   * Set the current room the player is in.
   */
  setCurrentRoom(room: DungeonRoomNode): void {
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
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  }): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Reset velocity
    body.setVelocity(0, 0);

    let vx = 0;
    let vy = 0;

    // Check input
    if (cursors.up.isDown) {
      vy = -this.MOVE_SPEED;
      this.facingDirection = 'up';
    }
    if (cursors.down.isDown) {
      vy = this.MOVE_SPEED;
      this.facingDirection = 'down';
    }
    if (cursors.left.isDown) {
      vx = -this.MOVE_SPEED;
      this.facingDirection = 'left';
    }
    if (cursors.right.isDown) {
      vx = this.MOVE_SPEED;
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

