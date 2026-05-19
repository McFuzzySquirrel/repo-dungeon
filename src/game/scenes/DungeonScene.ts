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
  private readonly roomObjectsById: Map<string, RoomObject[]> = new Map();
  private readonly contributorsById: Map<string, NPCContributor[]> = new Map();
  private activeRoomObjects: RoomObject[] = [];
  private activeContributors: NPCContributor[] = [];
  private interactionKey: Phaser.Input.Keyboard.Key | null = null;
  private currentAmbientSound: Phaser.Sound.BaseSound | null = null;
  private reducedMotion = false;
  private tutorialMessage: Phaser.GameObjects.Text | null = null;
  private tutorialStep = 0;
  private tutorialCompleted = false;
  private lastPlayerPosition: { x: number; y: number } | null = null;
  private interactionCount = 0;

  constructor() {
    super('DungeonScene');
  }

  preload(): void {
    this.reducedMotion = isReducedMotionPreferred();
    this.ensureBiomePlaceholderTextures();
    this.ensureEntityPlaceholderTextures();
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
      const keys = this.input.keyboard.addKeys({
        up: [Phaser.Input.Keyboard.KeyCodes.W, Phaser.Input.Keyboard.KeyCodes.UP],
        down: [Phaser.Input.Keyboard.KeyCodes.S, Phaser.Input.Keyboard.KeyCodes.DOWN],
        left: [Phaser.Input.Keyboard.KeyCodes.A, Phaser.Input.Keyboard.KeyCodes.LEFT],
        right: [Phaser.Input.Keyboard.KeyCodes.D, Phaser.Input.Keyboard.KeyCodes.RIGHT],
      }, false);
      this.interactionKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, false);

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
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown);
  }

  update(_: number, delta: number): void {
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
    this.updateActiveContributors(delta);
    this.handleInteractionInput();
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
      this.add
        .rectangle(
          zone.bounds.x + zone.bounds.width / 2,
          zone.bounds.y + zone.bounds.height / 2,
          zone.bounds.width,
          zone.bounds.height,
          presentation.palette.floor,
          0.2,
        )
        .setStrokeStyle(2, color);
      this.decorateZone(zone, presentation.palette.accent);

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
      const presentation = zone ? getBiomePresentation(zone.biome.id) : null;

      // Room rectangle
      const graphics = this.add.graphics();
      graphics.fillStyle(presentation?.palette.floor ?? color, 0.65);
      graphics.fillRect(
        room.position.x - room.size.width / 2,
        room.position.y - room.size.height / 2,
        room.size.width,
        room.size.height,
      );
      graphics.lineStyle(2, presentation?.palette.accent ?? color, 1);
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
      if (room.type !== 'repo' || !room.zoneId) {
        continue;
      }

      const zone = this.zoneById.get(room.zoneId);
      const biomeId = zone?.biome.id ?? 'lost-archive';

      const roomObjects = RoomObject.spawnForRoom(this, room, biomeId, this.reducedMotion);
      const contributors = NPCContributor.spawnForRoom(this, room, biomeId, this.reducedMotion);

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

  private handleInteractionInput(): void {
    if (!this.player || !this.interactionKey || !Phaser.Input.Keyboard.JustDown(this.interactionKey)) {
      return;
    }

    const fromX = this.player.x;
    const fromY = this.player.y;

    const roomObject = this.activeRoomObjects.find((candidate) => candidate.canInteractFrom(fromX, fromY));
    if (roomObject) {
      this.interactionCount += 1;
      this.emitRoomObjectInteraction(roomObject.interact());
      return;
    }

    const contributor = this.activeContributors.find((candidate) => candidate.canInteractFrom(fromX, fromY));
    if (contributor) {
      this.interactionCount += 1;
      this.emitContributorInteraction(contributor.getInteractionPayload());
    }
  }

  private emitRoomObjectInteraction(payload: RoomObjectInteractionPayload): void {
    this.events.emit('roomObjectInteracted', payload);
  }

  private emitContributorInteraction(payload: ContributorInteractionPayload): void {
    this.events.emit('contributorInteracted', payload);
  }

  private preloadAmbientAudioHooks(): void {
    for (const presentation of getAllBiomePresentations()) {
      this.load.audio(presentation.ambientAudio.key, presentation.ambientAudio.path);
    }
  }

  private updateAmbientForBiome(biomeId?: string): void {
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
    if (!this.textures.exists('npc-contributor')) {
      const graphics = this.make.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(7, 7, 7);
      graphics.generateTexture('npc-contributor', 14, 14);
      graphics.destroy();
    }
  }

  private decorateZone(zone: DungeonZone, color: number): void {
    const markerCount = Math.max(3, Math.floor(zone.roomIds.length / 2));
    for (let i = 0; i < markerCount; i += 1) {
      const markerX = zone.bounds.x + 18 + i * 14;
      const markerY = zone.bounds.y + zone.bounds.height - 16;
      this.add.circle(markerX, markerY, 2, color, 0.5);
    }
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('repo-dungeon:audio-settings-changed', this.applyAudioSettings);
    }
  };
}
