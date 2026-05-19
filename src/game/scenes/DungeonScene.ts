import Phaser from 'phaser';
import { DungeonGenerator } from '@/game/systems/DungeonGenerator';
import type { DungeonMap, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import { Player } from '@/game/entities/Player';
import type { GitHubRepoSummary } from '@/github/types';

const BIOME_COLORS: Record<string, number> = {
  'neon-circuit-city': 0x1e3a5f, // Cyan/purple
  'ancient-library': 0x5c4033, // Warm brown
  'iron-forge': 0x3a2f1f, // Orange/grey
  'wind-temple': 0x2d5f2f, // Green/white
  'deep-dungeon': 0x2a2a2a, // Grey
  'utility-vault': 0x3d3d3d, // Industrial grey
  'garden-ruins': 0x4a5f3f, // Pastel green
  'lost-archive': 0x6b5d4f, // Sepia
};

/**
 * DungeonScene renders a procedurally generated dungeon and handles player exploration.
 *
 * Responsibilities:
 * - Generate a dungeon using DungeonGenerator
 * - Render rooms and corridors
 * - Manage player movement and room transitions
 * - Emit events for other systems (UI, progression, etc.)
 */
export class DungeonScene extends Phaser.Scene {
  private player: Player | null = null;
  private dungeon: DungeonMap | null = null;
  private cursors: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  } | null = null;
  private currentRoomId: string | null = null;
  private roomById: Map<string, DungeonRoomNode> = new Map();
  private zoneById: Map<string, DungeonZone> = new Map();

  constructor() {
    super('DungeonScene');
  }

  preload(): void {
    // In a full implementation, we would load tileset and sprite assets here.
    // For now, we'll render with basic shapes and colors.
  }

  create(data: { repos?: GitHubRepoSummary[]; username?: string; seed?: string } = {}): void {
    // Generate dungeon
    const generator = new DungeonGenerator();
    const repos = data.repos || [];
    const seed = data.seed || '42';
    this.dungeon = generator.generate(repos, {
      seed,
      username: data.username,
    });

    // Build lookup maps
    this.roomById.clear();
    this.zoneById.clear();
    for (const room of this.dungeon.rooms) {
      this.roomById.set(room.id, room);
    }
    for (const zone of this.dungeon.zones) {
      this.zoneById.set(zone.id, zone);
    }

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.dungeon.width, this.dungeon.height);

    // Render the dungeon
    this.renderDungeon();

    // Create the player
    const entranceRoom = this.roomById.get(this.dungeon.entranceRoomId);
    if (entranceRoom) {
      this.player = new Player(this, entranceRoom.position.x, entranceRoom.position.y);
      this.player.setCurrentRoom(entranceRoom);
      this.currentRoomId = entranceRoom.id;

      // Emit initial room entry event
      this.emitRoomEntryEvent(entranceRoom);
    }

    // Set up input
    if (this.input.keyboard) {
      const keys = this.input.keyboard.addKeys({
        up: [Phaser.Input.Keyboard.KeyCodes.W, Phaser.Input.Keyboard.KeyCodes.UP],
        down: [Phaser.Input.Keyboard.KeyCodes.S, Phaser.Input.Keyboard.KeyCodes.DOWN],
        left: [Phaser.Input.Keyboard.KeyCodes.A, Phaser.Input.Keyboard.KeyCodes.LEFT],
        right: [Phaser.Input.Keyboard.KeyCodes.D, Phaser.Input.Keyboard.KeyCodes.RIGHT],
      });

      this.cursors = keys as {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
      };
    }

    // Set up camera to follow the player
    if (this.player) {
      this.cameras.main.startFollow(this.player);
      this.cameras.main.setBounds(0, 0, this.dungeon.width, this.dungeon.height);
    }
  }

  update(): void {
    if (!this.player || !this.cursors || !this.dungeon) {
      return;
    }

    // Update player movement
    this.player.updateMovement(this.cursors);

    // Constrain player to current room bounds
    const currentRoom = this.player.getCurrentRoom();
    if (currentRoom) {
      const minX = currentRoom.position.x - currentRoom.size.width / 2;
      const minY = currentRoom.position.y - currentRoom.size.height / 2;
      const maxX = currentRoom.position.x + currentRoom.size.width / 2;
      const maxY = currentRoom.position.y + currentRoom.size.height / 2;

      this.player.constrainToRoomBounds(minX, minY, maxX, maxY);
    }

    // Check for room transitions
    this.checkRoomTransitions();

    // Emit player state update
    this.emitPlayerStateUpdate();
  }

  /**
   * Render the dungeon: rooms, corridors, and room labels.
   */
  private renderDungeon(): void {
    if (!this.dungeon) return;

    // Draw zones as background regions
    for (const zone of this.dungeon.zones) {
      const color = BIOME_COLORS[zone.biome.id] || 0x3a3a3a;
      this.add
        .rectangle(
          zone.bounds.x + zone.bounds.width / 2,
          zone.bounds.y + zone.bounds.height / 2,
          zone.bounds.width,
          zone.bounds.height,
          color,
          0.2,
        )
        .setStrokeStyle(2, color);

      // Zone label
      this.add
        .text(zone.bounds.x + 10, zone.bounds.y + 10, zone.label, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '12px',
        })
        .setOrigin(0);
    }

    // Draw rooms
    for (const room of this.dungeon.rooms) {
      const zoneId = room.zoneId;
      const zone = zoneId ? this.zoneById.get(zoneId) : null;
      const color = zone ? BIOME_COLORS[zone.biome.id] : 0x52a9ff;

      // Room rectangle
      const graphics = this.add.graphics();
      graphics.fillStyle(color, 0.6);
      graphics.fillRect(
        room.position.x - room.size.width / 2,
        room.position.y - room.size.height / 2,
        room.size.width,
        room.size.height,
      );
      graphics.lineStyle(2, color, 1);
      graphics.strokeRect(
        room.position.x - room.size.width / 2,
        room.position.y - room.size.height / 2,
        room.size.width,
        room.size.height,
      );

      // Room center marker
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillCircle(room.position.x, room.position.y, 4);

      // Room label/ID
      this.add
        .text(room.position.x, room.position.y - room.size.height / 2 - 15, room.name, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '10px',
        })
        .setOrigin(0.5);
    }

    // Draw corridors
    for (const edge of this.dungeon.edges) {
      const graphics = this.add.graphics();
      const lineColor = edge.type === 'corridor' ? 0x7ba3d1 : 0x9f8f6b;

      graphics.lineStyle(3, lineColor, 0.6);
      if (edge.path.length >= 2) {
        for (let i = 0; i < edge.path.length - 1; i += 1) {
          const from = edge.path[i];
          const to = edge.path[i + 1];
          graphics.lineBetween(from.x, from.y, to.x, to.y);
        }
      }
    }
  }

  /**
   * Check if the player has entered a new room and emit transition event.
   */
  private checkRoomTransitions(): void {
    if (!this.player || !this.dungeon) return;

    for (const room of this.dungeon.rooms) {
      const minX = room.position.x - room.size.width / 2;
      const minY = room.position.y - room.size.height / 2;
      const maxX = room.position.x + room.size.width / 2;
      const maxY = room.position.y + room.size.height / 2;

      if (this.player.isInRegion(minX, minY, maxX, maxY)) {
        if (this.currentRoomId !== room.id) {
          this.currentRoomId = room.id;
          this.player.setCurrentRoom(room);
          this.emitRoomEntryEvent(room);
        }
        return;
      }
    }
  }

  /**
   * Emit a room entry event for other systems to consume.
   */
  private emitRoomEntryEvent(room: DungeonRoomNode): void {
    this.events.emit('roomEntered', {
      roomId: room.id,
      roomType: room.type,
      roomName: room.name,
      repo: room.repo || null,
      zone: room.zoneId ? this.zoneById.get(room.zoneId) : null,
    });
  }

  /**
   * Emit player state update event for UI systems.
   */
  private emitPlayerStateUpdate(): void {
    if (!this.player) return;

    const state = this.player.getState();
    this.events.emit('playerMoved', state);
  }

  /**
   * Get the current dungeon.
   */
  getDungeon(): DungeonMap | null {
    return this.dungeon;
  }

  /**
   * Get the player.
   */
  getPlayer(): Player | null {
    return this.player;
  }

  /**
   * Get the current room the player is in.
   */
  getCurrentRoom(): DungeonRoomNode | null {
    if (!this.currentRoomId) return null;
    return this.roomById.get(this.currentRoomId) || null;
  }
}

