import Phaser from 'phaser';
import { DungeonGenerator } from '@/game/systems/DungeonGenerator';
import type { DungeonMap, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import { Player } from '@/game/entities/Player';
import type { GitHubRepoSummary } from '@/github/types';
import { getAllBiomePresentations, getBiomePresentation } from '@/game/config/biomePresentation';
import { RoomObject, type RoomObjectInteractionPayload } from '@/game/entities/RoomObject';
import { NPCContributor, type ContributorInteractionPayload } from '@/game/entities/NPCContributor';
import { isReducedMotionPreferred, readAudioSettings } from '@/game/audio/audioSettings';

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

const CORRIDOR_HALF_WIDTH = 18;
const TILE_SURFACE_FILL_ALPHA = 0.08;
const TILE_SURFACE_TEXTURE_ALPHA = 0.68;
const TILE_SURFACE_ZONE_TILE_SCALE = 0.5;
const TILE_SURFACE_ROOM_TILE_SCALE = 0.75;

interface NavigationRegion {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface DoorAnchor {
  x: number;
  y: number;
  rotation: number;
}

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
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
  } | null = null;
  private currentRoomId: string | null = null;
  private roomById: Map<string, DungeonRoomNode> = new Map();
  private zoneById: Map<string, DungeonZone> = new Map();
  private readonly roomObjectsById: Map<string, RoomObject[]> = new Map();
  private readonly contributorsById: Map<string, NPCContributor[]> = new Map();
  private activeRoomObjects: RoomObject[] = [];
  private activeContributors: NPCContributor[] = [];
  private interactionKey: Phaser.Input.Keyboard.Key | null = null;
  private sprintKey: Phaser.Input.Keyboard.Key | null = null;
  private currentAmbientSound: Phaser.Sound.BaseSound | null = null;
  private reducedMotion = false;
  private tutorialMessage: Phaser.GameObjects.Text | null = null;
  private interactionPrompt: Phaser.GameObjects.Text | null = null;
  private tutorialStep = 0;
  private tutorialCompleted = false;
  private lastPlayerPosition: { x: number; y: number } | null = null;
  private interactionCount = 0;
  private readonly ambientAudioEnabled = import.meta.env.VITE_ENABLE_AMBIENT_AUDIO === 'true';
  private navigationRegions: NavigationRegion[] = [];
  private pendingInteractionRequest = false;

  constructor() {
    super('DungeonScene');
  }

  preload(): void {
    this.reducedMotion = isReducedMotionPreferred();
    this.preloadVisualAssets();
    this.preloadAmbientAudioHooks();
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
    this.navigationRegions = this.buildNavigationRegions();
    this.ensureBiomePlaceholderTextures();
    this.ensureEntityPlaceholderTextures();

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.dungeon.width, this.dungeon.height);

    // Render the dungeon
    this.renderDungeon();
    this.spawnRoomContent();
    this.initializeTutorialState();

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
      const keyboard = this.input.keyboard;
      const keys = {
        up: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP, false),
        ],
        down: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false),
        ],
        left: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
        ],
        right: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
        ],
      };
      this.interactionKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, false);
      this.sprintKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);

      this.cursors = keys;
    }

    // Set up camera to follow the player
    if (this.player) {
      this.cameras.main.startFollow(this.player);
      this.cameras.main.setBounds(0, 0, this.dungeon.width, this.dungeon.height);
      this.lastPlayerPosition = { x: this.player.x, y: this.player.y };
      const currentRoom = this.player.getCurrentRoom();
      if (currentRoom?.zoneId) {
        const zone = this.zoneById.get(currentRoom.zoneId);
        if (zone) {
          this.updateAmbientForBiome(zone.biome.id);
        }
      }
    }

    this.applyAudioSettings();
    if (typeof window !== 'undefined') {
      window.addEventListener('repo-dungeon:audio-settings-changed', this.applyAudioSettings);
      window.addEventListener('keydown', this.handleGlobalInteractionKeyDown);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown);
  }

  update(_: number, delta: number): void {
    if (!this.player || !this.cursors || !this.dungeon) {
      return;
    }

    // Update player movement
    this.player.updateMovement({
      up: { isDown: this.isAnyKeyDown(this.cursors.up) },
      down: { isDown: this.isAnyKeyDown(this.cursors.down) },
      left: { isDown: this.isAnyKeyDown(this.cursors.left) },
      right: { isDown: this.isAnyKeyDown(this.cursors.right) },
    }, this.sprintKey?.isDown ? 1.6 : 1);

    this.player.constrainToNavigationRegions(this.navigationRegions);

    // Check for room transitions
    this.checkRoomTransitions();
    this.updateActiveContributors(delta);
    this.handleInteractionInput();
    this.updateInteractionPrompt();
    this.advanceTutorialProgress();

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
      const presentation = getBiomePresentation(zone.biome.id);
      if (this.textures.exists(presentation.tilesetTextureKey)) {
        this.add
          .tileSprite(
            zone.bounds.x,
            zone.bounds.y,
            zone.bounds.width,
            zone.bounds.height,
            presentation.tilesetTextureKey,
          )
          .setOrigin(0)
          .setTileScale(TILE_SURFACE_ZONE_TILE_SCALE)
          .setAlpha(TILE_SURFACE_TEXTURE_ALPHA)
          .setTilePosition(zone.bounds.x, zone.bounds.y);
      }
      this.add
        .rectangle(
          zone.bounds.x + zone.bounds.width / 2,
          zone.bounds.y + zone.bounds.height / 2,
          zone.bounds.width,
          zone.bounds.height,
          presentation.palette.floor,
          TILE_SURFACE_FILL_ALPHA,
        )
        .setStrokeStyle(2, color);
      this.decorateZone(zone, presentation.palette.accent);

      // Zone label
      this.add
        .text(zone.bounds.x + 12, zone.bounds.y + 12, zone.label, {
          color: '#f7edd7',
          fontFamily: 'monospace',
          fontSize: '12px',
          backgroundColor: '#0c1018d9',
          padding: {
            x: 8,
            y: 5,
          },
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0);
    }

    // Draw rooms
    for (const room of this.dungeon.rooms) {
      const zoneId = room.zoneId;
      const zone = zoneId ? this.zoneById.get(zoneId) : null;
      const color = zone ? BIOME_COLORS[zone.biome.id] : 0x52a9ff;
      const presentation = zone ? getBiomePresentation(zone.biome.id) : null;
      const textureKey = presentation?.tilesetTextureKey;

      if (textureKey && this.textures.exists(textureKey)) {
        this.add
          .tileSprite(
            room.position.x - room.size.width / 2,
            room.position.y - room.size.height / 2,
            room.size.width,
            room.size.height,
            textureKey,
          )
          .setOrigin(0)
          .setTileScale(TILE_SURFACE_ROOM_TILE_SCALE)
          .setAlpha(TILE_SURFACE_TEXTURE_ALPHA)
          .setTilePosition(room.position.x - room.size.width / 2, room.position.y - room.size.height / 2);
      }

      // Room rectangle
      const graphics = this.add.graphics();
      graphics.fillStyle(presentation?.palette.floor ?? color, TILE_SURFACE_FILL_ALPHA);
      graphics.fillRect(
        room.position.x - room.size.width / 2,
        room.position.y - room.size.height / 2,
        room.size.width,
        room.size.height,
      );
      graphics.lineStyle(2, presentation?.palette.accent ?? color, 0.95);
      graphics.strokeRect(
        room.position.x - room.size.width / 2,
        room.position.y - room.size.height / 2,
        room.size.width,
        room.size.height,
      );

      // Room center marker
      graphics.fillStyle(presentation?.palette.prop ?? 0xffffff, 0.85);
      graphics.fillCircle(room.position.x, room.position.y, 4);

      if (presentation) {
        this.decorateRoom(room, presentation.placeholderPattern, presentation.palette.wall);
      }

      // Room signpost label
      this.addRoomSignpost(
        room.position.x,
        room.position.y - room.size.height / 2,
        room.name,
        presentation?.palette.accent ?? color,
      );
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

    this.renderDoorways();
  }

  /**
   * Check if the player has entered a new room and emit transition event.
   */
  private checkRoomTransitions(): void {
    if (!this.player || !this.dungeon) return;

    let nextRoom: DungeonRoomNode | null = null;

    for (const room of this.dungeon.rooms) {
      const minX = room.position.x - room.size.width / 2;
      const minY = room.position.y - room.size.height / 2;
      const maxX = room.position.x + room.size.width / 2;
      const maxY = room.position.y + room.size.height / 2;

      if (this.player.isInRegion(minX, minY, maxX, maxY)) {
        nextRoom = room;
        break;
      }
    }

    if (nextRoom) {
      if (this.currentRoomId !== nextRoom.id) {
        this.currentRoomId = nextRoom.id;
        this.player.setCurrentRoom(nextRoom);
        this.emitRoomEntryEvent(nextRoom);
      }
      return;
    }

    if (this.currentRoomId !== null) {
      this.currentRoomId = null;
      this.player.setCurrentRoom(null);
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
      repo: room.repo
        ? {
            ...room.repo,
            owner: room.repo.ownerLogin,
          }
        : null,
      zone: room.zoneId ? this.zoneById.get(room.zoneId) : null,
    });
    this.updateActiveRoomContent(room.id);
    const zone = room.zoneId ? this.zoneById.get(room.zoneId) : null;
    this.updateAmbientForBiome(zone?.biome.id);
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

  private spawnRoomContent(): void {
    if (!this.dungeon) {
      return;
    }

    this.roomObjectsById.clear();
    this.contributorsById.clear();

    for (const room of this.dungeon.rooms) {
      const zone = room.zoneId ? this.zoneById.get(room.zoneId) : null;
      const biomeId = zone?.biome.id ?? 'lost-archive';

      const roomObjects = RoomObject.spawnForRoom(this, room, biomeId, this.reducedMotion);
      const contributors = room.type === 'repo'
        ? NPCContributor.spawnForRoom(this, room, biomeId, this.reducedMotion)
        : [];

      roomObjects.forEach((obj) => obj.setVisible(false));
      contributors.forEach((npc) => npc.setVisible(false));

      this.roomObjectsById.set(room.id, roomObjects);
      this.contributorsById.set(room.id, contributors);
    }
  }

  private updateActiveRoomContent(roomId: string): void {
    this.activeRoomObjects.forEach((obj) => obj.setVisible(false));
    this.activeContributors.forEach((npc) => npc.setVisible(false));

    this.activeRoomObjects = this.roomObjectsById.get(roomId) ?? [];
    this.activeContributors = this.contributorsById.get(roomId) ?? [];
    this.activeRoomObjects.forEach((obj) => obj.setVisible(true));
    this.activeContributors.forEach((npc) => npc.setVisible(true));
  }

  private updateActiveContributors(deltaMs: number): void {
    for (const npc of this.activeContributors) {
      npc.updateBehavior(deltaMs);
    }
  }

  private isAnyKeyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.some((key) => key.isDown);
  }

  private buildNavigationRegions(): NavigationRegion[] {
    if (!this.dungeon) {
      return [];
    }

    const regions: NavigationRegion[] = [];

    for (const room of this.dungeon.rooms) {
      regions.push({
        minX: room.position.x - room.size.width / 2,
        minY: room.position.y - room.size.height / 2,
        maxX: room.position.x + room.size.width / 2,
        maxY: room.position.y + room.size.height / 2,
      });
    }

    for (const edge of this.dungeon.edges) {
      if (edge.path.length < 2) {
        continue;
      }

      for (let i = 0; i < edge.path.length - 1; i += 1) {
        const from = edge.path[i];
        const to = edge.path[i + 1];

        regions.push({
          minX: Math.min(from.x, to.x) - CORRIDOR_HALF_WIDTH,
          minY: Math.min(from.y, to.y) - CORRIDOR_HALF_WIDTH,
          maxX: Math.max(from.x, to.x) + CORRIDOR_HALF_WIDTH,
          maxY: Math.max(from.y, to.y) + CORRIDOR_HALF_WIDTH,
        });
      }
    }

    return regions;
  }

  private handleInteractionInput(): void {
    if (!this.player || !this.interactionKey) {
      return;
    }

    const interactionRequested = Phaser.Input.Keyboard.JustDown(this.interactionKey) || this.pendingInteractionRequest;
    if (!interactionRequested) {
      return;
    }

    this.pendingInteractionRequest = false;

    const nearest = this.findNearestInteractable(this.player.x, this.player.y);
    if (!nearest) {
      return;
    }

    if (nearest.type === 'room-object') {
      this.interactionCount += 1;
      this.emitRoomObjectInteraction(nearest.object.interact());
      return;
    }

    this.interactionCount += 1;
    this.emitContributorInteraction(nearest.contributor.getInteractionPayload());
  }

  private updateInteractionPrompt(): void {
    if (!this.player) {
      this.interactionPrompt?.setVisible(false);
      return;
    }

    const nearest = this.findNearestInteractable(this.player.x, this.player.y);
    if (!nearest) {
      this.interactionPrompt?.setVisible(false);
      return;
    }

    if (!this.interactionPrompt) {
      this.interactionPrompt = this.add
        .text(12, 42, '', {
          color: '#e6f4ff',
          backgroundColor: '#0b1629d9',
          padding: { x: 8, y: 5 },
          fontFamily: 'monospace',
          fontSize: '11px',
        })
        .setScrollFactor(0)
        .setDepth(1001);
    }

    const prompt = nearest.type === 'room-object'
      ? `Press E to collect ${nearest.object.interact().title}`
      : `Press E to greet ${nearest.contributor.getInteractionPayload().contributor.login}`;

    this.interactionPrompt.setText(prompt);
    this.interactionPrompt.setVisible(true);
  }

  private findNearestInteractable(playerX: number, playerY: number):
    | { type: 'room-object'; object: RoomObject; distance: number }
    | { type: 'contributor'; contributor: NPCContributor; distance: number }
    | null {
    let nearest:
      | { type: 'room-object'; object: RoomObject; distance: number }
      | { type: 'contributor'; contributor: NPCContributor; distance: number }
      | null = null;

    for (const candidate of this.activeRoomObjects) {
      if (!candidate.canInteractFrom(playerX, playerY)) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(playerX, playerY, candidate.x, candidate.y);
      if (!nearest || distance < nearest.distance) {
        nearest = { type: 'room-object', object: candidate, distance };
      }
    }

    for (const candidate of this.activeContributors) {
      if (!candidate.canInteractFrom(playerX, playerY)) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(playerX, playerY, candidate.x, candidate.y);
      if (!nearest || distance < nearest.distance) {
        nearest = { type: 'contributor', contributor: candidate, distance };
      }
    }

    return nearest;
  }

  private readonly handleGlobalInteractionKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === 'e') {
      this.pendingInteractionRequest = true;
    }
  };

  private emitRoomObjectInteraction(payload: RoomObjectInteractionPayload): void {
    this.events.emit('roomObjectInteracted', payload);
  }

  private emitContributorInteraction(payload: ContributorInteractionPayload): void {
    this.events.emit('contributorInteracted', payload);
  }

  private preloadAmbientAudioHooks(): void {
    if (!this.ambientAudioEnabled) {
      return;
    }

    for (const presentation of getAllBiomePresentations()) {
      this.load.audio(presentation.ambientAudio.key, presentation.ambientAudio.path);
    }
  }

  private preloadVisualAssets(): void {
    for (const presentation of getAllBiomePresentations()) {
      if (presentation.tilesetAssetPath) {
        this.load.image(presentation.tilesetTextureKey, presentation.tilesetAssetPath);
      }
    }

    this.load.image('sprite-player', '/assets/sprites/player.svg');
    this.load.image('sprite-door', '/assets/sprites/door.svg');
    this.load.image('npc-contributor', '/assets/sprites/npc-contributor.svg');
  }

  private updateAmbientForBiome(biomeId?: string): void {
    if (!this.ambientAudioEnabled) {
      return;
    }

    if (!biomeId) {
      return;
    }

    const ambient = getBiomePresentation(biomeId).ambientAudio;
    if (!this.cache.audio.exists(ambient.key)) {
      this.events.emit('ambientAudioMissing', { biomeId, key: ambient.key });
      return;
    }

    if (this.currentAmbientSound?.key === ambient.key && this.currentAmbientSound.isPlaying) {
      return;
    }

    this.currentAmbientSound?.stop();
    this.currentAmbientSound?.destroy();
    this.currentAmbientSound = this.sound.add(ambient.key, {
      loop: true,
      volume: ambient.volume,
    });
    this.currentAmbientSound.play();
    this.applyAudioSettings();
  }

  private applyAudioSettings = (): void => {
    const settings = readAudioSettings();
    this.sound.setMute(settings.muted);
    this.sound.setVolume(settings.masterVolume);
  };

  private ensureBiomePlaceholderTextures(): void {
    for (const presentation of getAllBiomePresentations()) {
      if (this.textures.exists(presentation.tilesetTextureKey)) {
        continue;
      }
      const graphics = this.make.graphics();
      graphics.fillStyle(presentation.palette.floor, 1);
      graphics.fillRect(0, 0, 32, 32);
      graphics.fillStyle(presentation.palette.wall, 0.6);
      graphics.fillRect(0, 24, 32, 8);
      graphics.fillStyle(presentation.palette.accent, 0.9);
      graphics.fillRect(4, 4, 24, 2);
      graphics.generateTexture(presentation.tilesetTextureKey, 32, 32);
      graphics.destroy();
    }
  }

  private ensureEntityPlaceholderTextures(): void {
    if (!this.textures.exists('player-placeholder')) {
      const graphics = this.make.graphics();
      graphics.fillStyle(0x4a90e2, 1);
      graphics.fillCircle(8, 8, 7);
      graphics.lineStyle(2, 0xffffff, 0.8);
      graphics.strokeCircle(8, 8, 7);
      graphics.generateTexture('player-placeholder', 16, 16);
      graphics.destroy();
    }

    if (!this.textures.exists('npc-contributor')) {
      const graphics = this.make.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(7, 7, 7);
      graphics.generateTexture('npc-contributor', 14, 14);
      graphics.destroy();
    }

    if (!this.textures.exists('sprite-door')) {
      const graphics = this.make.graphics();
      graphics.fillStyle(0xb58a5a, 1);
      graphics.fillRect(0, 0, 10, 14);
      graphics.fillStyle(0x6b4a2e, 1);
      graphics.fillRect(1, 1, 8, 12);
      graphics.generateTexture('sprite-door', 10, 14);
      graphics.destroy();
    }
  }

  private renderDoorways(): void {
    if (!this.dungeon) {
      return;
    }

    for (const edge of this.dungeon.edges) {
      const fromRoom = this.roomById.get(edge.fromRoomId);
      const toRoom = this.roomById.get(edge.toRoomId);
      if (!fromRoom || !toRoom) {
        continue;
      }

      const firstTarget = edge.path[1] ?? toRoom.position;
      const lastTarget = edge.path[edge.path.length - 2] ?? fromRoom.position;
      this.drawDoorAt(this.getDoorAnchor(fromRoom, firstTarget));
      this.drawDoorAt(this.getDoorAnchor(toRoom, lastTarget));
    }
  }

  private getDoorAnchor(room: DungeonRoomNode, target: { x: number; y: number }): DoorAnchor {
    const dx = target.x - room.position.x;
    const dy = target.y - room.position.y;
    const roomMinX = room.position.x - room.size.width / 2;
    const roomMaxX = room.position.x + room.size.width / 2;
    const roomMinY = room.position.y - room.size.height / 2;
    const roomMaxY = room.position.y + room.size.height / 2;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return {
        x: dx >= 0 ? roomMaxX - 2 : roomMinX + 2,
        y: Phaser.Math.Clamp(target.y, roomMinY + 10, roomMaxY - 10),
        rotation: Math.PI / 2,
      };
    }

    return {
      x: Phaser.Math.Clamp(target.x, roomMinX + 10, roomMaxX - 10),
      y: dy >= 0 ? roomMaxY - 2 : roomMinY + 2,
      rotation: 0,
    };
  }

  private drawDoorAt(anchor: DoorAnchor): void {
    this.add
      .image(anchor.x, anchor.y, 'sprite-door')
      .setDisplaySize(12, 16)
      .setRotation(anchor.rotation)
      .setDepth(8)
      .setAlpha(0.95);
  }

  private decorateZone(zone: DungeonZone, color: number): void {
    const markerCount = Math.max(3, Math.floor(zone.roomIds.length / 2));
    for (let i = 0; i < markerCount; i += 1) {
      const markerX = zone.bounds.x + 18 + i * 14;
      const markerY = zone.bounds.y + zone.bounds.height - 16;
      this.add.circle(markerX, markerY, 2, color, 0.5);
    }
  }

  /**
   * Draw a dungeon-style signpost (post + board) above a room.
   */
  private addRoomSignpost(
    cx: number,
    roomTopY: number,
    label: string,
    accentColor: number,
  ): void {
    // Approximate monospace 10 px character width; cap board width for very long names
    const charW = 6.2;
    const boardPadX = 9;
    const boardPadY = 5;
    const boardH = 10 + boardPadY * 2; // font-size + vertical padding
    const boardW = Math.min(Math.max(label.length * charW + boardPadX * 2, 48), 160);
    const postH = 14;
    const postW = 4;

    // Positions (all in world space)
    const boardBottom = roomTopY - postH;
    const boardTop = boardBottom - boardH;
    const boardLeft = cx - boardW / 2;

    const g = this.add.graphics();

    // Post — biome-tinted thin pillar
    g.fillStyle(accentColor, 0.55);
    g.fillRect(cx - postW / 2, boardBottom, postW, postH);

    // Subtle drop-shadow offset
    g.fillStyle(0x000000, 0.35);
    g.fillRect(boardLeft + 2, boardTop + 2, boardW, boardH);

    // Board border (biome accent)
    g.fillStyle(accentColor, 0.7);
    g.fillRect(boardLeft - 1, boardTop - 1, boardW + 2, boardH + 2);

    // Board fill — dark parchment
    g.fillStyle(0x0e1420, 0.91);
    g.fillRect(boardLeft, boardTop, boardW, boardH);

    // Label text centred on board
    this.add
      .text(cx, boardTop + boardH / 2, label, {
        color: '#f0e6cc',
        fontFamily: 'monospace',
        fontSize: '10px',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5);
  }

  private decorateRoom(
    room: DungeonRoomNode,
    pattern: 'grid' | 'stone' | 'forge' | 'wind' | 'dungeon' | 'pipes' | 'vines' | 'parchment',
    color: number,
  ): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, color, 0.25);
    const left = room.position.x - room.size.width / 2 + 6;
    const top = room.position.y - room.size.height / 2 + 6;
    const right = room.position.x + room.size.width / 2 - 6;
    const bottom = room.position.y + room.size.height / 2 - 6;

    if (pattern === 'grid' || pattern === 'pipes') {
      for (let x = left; x <= right; x += 16) {
        graphics.lineBetween(x, top, x, bottom);
      }
    }
    if (pattern === 'stone' || pattern === 'dungeon' || pattern === 'forge') {
      for (let y = top; y <= bottom; y += 16) {
        graphics.lineBetween(left, y, right, y);
      }
    }
    if (pattern === 'wind' || pattern === 'vines' || pattern === 'parchment') {
      graphics.strokeEllipse(room.position.x, room.position.y, room.size.width - 14, room.size.height - 14);
    }
  }

  private initializeTutorialState(): void {
    this.tutorialCompleted =
      typeof window !== 'undefined' &&
      window.localStorage.getItem('repo-dungeon:v1:tutorial-complete') === 'true';
    if (this.tutorialCompleted) {
      return;
    }

    this.tutorialStep = 0;
    this.tutorialMessage = this.add
      .text(12, 12, 'Tutorial: Move with WASD or Arrow keys.', {
        color: '#ffffff',
        backgroundColor: '#101828cc',
        padding: {
          x: 8,
          y: 6,
        },
        fontFamily: 'monospace',
        fontSize: '12px',
      })
      .setScrollFactor(0)
      .setDepth(1000);
    this.events.emit('tutorialUpdated', { step: this.tutorialStep, completed: false });
  }

  private advanceTutorialProgress(): void {
    if (this.tutorialCompleted || !this.player || !this.tutorialMessage) {
      return;
    }

    if (this.tutorialStep === 0 && this.lastPlayerPosition) {
      const distance = Phaser.Math.Distance.Between(
        this.lastPlayerPosition.x,
        this.lastPlayerPosition.y,
        this.player.x,
        this.player.y,
      );
      if (distance > 6) {
        this.tutorialStep = 1;
        this.tutorialMessage.setText('Tutorial: Press E near room props or contributors.');
        this.events.emit('tutorialUpdated', { step: this.tutorialStep, completed: false });
      }
    } else if (this.tutorialStep === 1 && this.interactionCount > 0) {
      this.tutorialStep = 2;
      this.tutorialMessage.setText('Tutorial: Press M for full map. Explore freely!');
      this.events.emit('tutorialUpdated', { step: this.tutorialStep, completed: false });
    } else if (this.tutorialStep === 2) {
      this.tutorialCompleted = true;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('repo-dungeon:v1:tutorial-complete', 'true');
      }
      this.tutorialMessage.destroy();
      this.tutorialMessage = null;
      this.events.emit('tutorialUpdated', { step: this.tutorialStep, completed: true });
    }

    this.lastPlayerPosition = { x: this.player.x, y: this.player.y };
  }

  private readonly handleSceneShutdown = (): void => {
    this.currentAmbientSound?.stop();
    this.currentAmbientSound?.destroy();
    this.currentAmbientSound = null;
    this.interactionPrompt?.destroy();
    this.interactionPrompt = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('repo-dungeon:audio-settings-changed', this.applyAudioSettings);
      window.removeEventListener('keydown', this.handleGlobalInteractionKeyDown);
    }
  };
}
