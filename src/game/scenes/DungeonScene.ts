import Phaser from 'phaser';
import { GAME_DIMENSIONS } from '@/game/config/gameConfig';
import type { PlayerClass } from '@/game/config/classes';
import { getAllNpcSprites, getAllPlayerClassSprites } from '@/game/config/characterSprites';
import { DungeonGenerator } from '@/game/systems/DungeonGenerator';
import type { DungeonEdge, DungeonMap, DungeonPoint, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import { Player } from '@/game/entities/Player';
import type { GitHubRepoSummary } from '@/github/types';
import { getAllBiomePresentations, getBiomePresentation } from '@/game/config/biomePresentation';
import { getAllPathwaySprites, getPathwayMaterialForBiomes, getPathwaySprite } from '@/game/config/pathwayPresentation';
import { RoomObject, type RoomObjectInteractionPayload } from '@/game/entities/RoomObject';
import { NPCContributor, type ContributorInteractionPayload } from '@/game/entities/NPCContributor';
import { isReducedMotionPreferred, readAudioSettings } from '@/game/audio/audioSettings';
import { usePlayerStore } from '@/store/playerStore';

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
const PATHWAY_TILE_SPACING = 24;
const PATHWAY_WIDTH = CORRIDOR_HALF_WIDTH * 2;
const PATHWAY_JOINT_SIZE = 42;
const TILE_SURFACE_FILL_ALPHA = 0.08;
const TILE_SURFACE_TEXTURE_ALPHA = 0.68;
const TILE_SURFACE_ZONE_TILE_SCALE = 0.5;
const TILE_SURFACE_ROOM_TILE_SCALE = 0.75;
const CAMERA_BASE_ZOOM_MIN = 0.85;
const CAMERA_BASE_ZOOM_MAX = 2.4;
const CAMERA_CORRIDOR_ZOOM_MULTIPLIER = 0.94;
const CAMERA_ROOM_PADDING = 112;

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

type DirectionKey = 'up' | 'down' | 'left' | 'right';

type PathwayNodeKind = 'end' | 'straight' | 'corner' | 'tee' | 'cross';

type VirtualDirectionState = Record<DirectionKey, boolean>;

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
  private preferredCameraZoom = 1;
  private cameraZoomTween: Phaser.Tweens.Tween | null = null;
  private selectedPlayerClass: PlayerClass = 'explorer';
  private playerClassUnsubscribe: (() => void) | null = null;
  private virtualDirectionState: VirtualDirectionState = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

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
    this.ensurePathwayPlaceholderTextures();
    this.ensureEntityPlaceholderTextures();
    this.selectedPlayerClass = usePlayerStore.getState().selectedClass ?? 'explorer';

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.dungeon.width, this.dungeon.height);

    // Render the dungeon
    this.renderDungeon();
    this.spawnRoomContent();
    this.initializeTutorialState();

    // Create the player
    const entranceRoom = this.roomById.get(this.dungeon.entranceRoomId);
    if (entranceRoom) {
      this.player = new Player(this, entranceRoom.position.x, entranceRoom.position.y, this.selectedPlayerClass);
      this.player.setCurrentRoom(entranceRoom);
      this.currentRoomId = entranceRoom.id;

      // Emit initial room entry event
      this.emitRoomEntryEvent(entranceRoom);
    }

    this.playerClassUnsubscribe?.();
    this.playerClassUnsubscribe = usePlayerStore.subscribe((state, previousState) => {
      const nextClass = state.selectedClass ?? 'explorer';
      const previousClass = previousState.selectedClass ?? 'explorer';
      if (nextClass === previousClass) {
        return;
      }

      this.selectedPlayerClass = nextClass;
      this.player?.applyClassVisual(nextClass);
    });

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
      this.applyContextualCameraZoom(true);
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
      up: { isDown: this.isDirectionActive('up') },
      down: { isDown: this.isDirectionActive('down') },
      left: { isDown: this.isDirectionActive('left') },
      right: { isDown: this.isDirectionActive('right') },
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
              zone.bounds.x + zone.bounds.width / 2,
              zone.bounds.y + zone.bounds.height / 2,
            zone.bounds.width,
            zone.bounds.height,
            presentation.tilesetTextureKey,
          )
          .setTileScale(TILE_SURFACE_ZONE_TILE_SCALE)
            .setAlpha(TILE_SURFACE_TEXTURE_ALPHA);
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
              room.position.x,
              room.position.y,
            room.size.width,
            room.size.height,
            textureKey,
          )
          .setTileScale(TILE_SURFACE_ROOM_TILE_SCALE)
            .setAlpha(TILE_SURFACE_TEXTURE_ALPHA);
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

    this.renderPathways();

    this.renderDoorways();
  }

  private renderPathways(): void {
    if (!this.dungeon) {
      return;
    }

    for (const edge of this.dungeon.edges) {
      this.renderPathwayEdge(edge);
    }
  }

  private renderPathwayEdge(edge: DungeonEdge): void {
    const renderPoints = this.getRenderablePathPoints(edge);
    if (renderPoints.length < 2) {
      return;
    }

    const material = this.getPathwayMaterial(edge);

    for (let index = 0; index < renderPoints.length - 1; index += 1) {
      this.renderPathwaySegment(renderPoints[index], renderPoints[index + 1], material.tint, material.alpha);
    }

    for (let index = 0; index < renderPoints.length; index += 1) {
      const previous = renderPoints[index - 1] ?? null;
      const current = renderPoints[index];
      const next = renderPoints[index + 1] ?? null;
      this.renderPathwayNode(previous, current, next, material.tint, material.alpha);
    }
  }

  private getRenderablePathPoints(edge: DungeonEdge): DungeonPoint[] {
    if (edge.path.length < 2) {
      return edge.path;
    }

    const fromRoom = this.roomById.get(edge.fromRoomId);
    const toRoom = this.roomById.get(edge.toRoomId);
    if (!fromRoom || !toRoom) {
      return edge.path;
    }

    const firstTarget = edge.path[1] ?? toRoom.position;
    const lastTarget = edge.path[edge.path.length - 2] ?? fromRoom.position;
    const start = this.toDungeonPoint(this.getDoorAnchor(fromRoom, firstTarget));
    const end = this.toDungeonPoint(this.getDoorAnchor(toRoom, lastTarget));

    return [start, ...edge.path.slice(1, -1), end];
  }

  private toDungeonPoint(anchor: DoorAnchor): DungeonPoint {
    return { x: anchor.x, y: anchor.y };
  }

  private getPathwayMaterial(edge: DungeonEdge): { tint: number; alpha: number } {
    const fromRoom = this.roomById.get(edge.fromRoomId);
    const toRoom = this.roomById.get(edge.toRoomId);
    const fromBiomeId = fromRoom?.zoneId ? this.zoneById.get(fromRoom.zoneId)?.biome.id : 'lost-archive';
    const toBiomeId = toRoom?.zoneId ? this.zoneById.get(toRoom.zoneId)?.biome.id : fromBiomeId;

    return getPathwayMaterialForBiomes(fromBiomeId, toBiomeId, edge.type);
  }

  private renderPathwaySegment(from: DungeonPoint, to: DungeonPoint, tint: number, alpha: number): void {
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    if (length <= 0) {
      return;
    }

    const isVertical = from.x === to.x;
    const tileCount = Math.max(1, Math.ceil(length / PATHWAY_TILE_SPACING));

    for (let index = 0; index < tileCount; index += 1) {
      const progress = tileCount === 1 ? 0.5 : index / (tileCount - 1);
      const x = Phaser.Math.Linear(from.x, to.x, progress);
      const y = Phaser.Math.Linear(from.y, to.y, progress);

      this.add
        .image(x, y, getPathwaySprite('straight').textureKey)
        .setDisplaySize(PATHWAY_JOINT_SIZE, PATHWAY_WIDTH)
        .setRotation(isVertical ? Math.PI / 2 : 0)
        .setTint(tint)
        .setAlpha(alpha);
    }
  }

  private renderPathwayNode(
    previous: DungeonPoint | null,
    current: DungeonPoint,
    next: DungeonPoint | null,
    tint: number,
    alpha: number,
  ): void {
    const directions = [previous, next]
      .filter((point): point is DungeonPoint => point !== null)
      .map((point) => this.getPathDirection(current, point));

    if (directions.length === 0) {
      return;
    }

    const kind = this.getPathwayNodeKind(directions);
    const textureKey = getPathwaySprite(kind).textureKey;
    const rotation = this.getPathwayNodeRotation(kind, directions);

    this.add
      .image(current.x, current.y, textureKey)
      .setDisplaySize(PATHWAY_JOINT_SIZE, PATHWAY_JOINT_SIZE)
      .setRotation(rotation)
      .setTint(tint)
      .setAlpha(alpha);
  }

  private getPathDirection(from: DungeonPoint, to: DungeonPoint): DirectionKey {
    if (to.x > from.x) {
      return 'right';
    }
    if (to.x < from.x) {
      return 'left';
    }
    if (to.y > from.y) {
      return 'down';
    }
    return 'up';
  }

  private getPathwayNodeKind(directions: DirectionKey[]): PathwayNodeKind {
    const uniqueDirections = [...new Set(directions)];
    if (uniqueDirections.length >= 4) {
      return 'cross';
    }
    if (uniqueDirections.length === 3) {
      return 'tee';
    }
    if (uniqueDirections.length === 1) {
      return 'end';
    }

    const hasHorizontal = uniqueDirections.includes('left') || uniqueDirections.includes('right');
    const hasVertical = uniqueDirections.includes('up') || uniqueDirections.includes('down');
    return hasHorizontal && hasVertical ? 'corner' : 'straight';
  }

  private getPathwayNodeRotation(kind: PathwayNodeKind, directions: DirectionKey[]): number {
    const uniqueDirections = [...new Set(directions)];

    if (kind === 'straight') {
      return uniqueDirections.includes('up') || uniqueDirections.includes('down') ? Math.PI / 2 : 0;
    }

    if (kind === 'end') {
      return this.rotationForDirection(uniqueDirections[0]);
    }

    if (kind === 'corner') {
      const set = new Set(uniqueDirections);
      if (set.has('right') && set.has('down')) {
        return 0;
      }
      if (set.has('down') && set.has('left')) {
        return Math.PI / 2;
      }
      if (set.has('left') && set.has('up')) {
        return Math.PI;
      }
      return (Math.PI * 3) / 2;
    }

    if (kind === 'tee') {
      const set = new Set(uniqueDirections);
      if (!set.has('up')) {
        return 0;
      }
      if (!set.has('left')) {
        return Math.PI / 2;
      }
      if (!set.has('down')) {
        return Math.PI;
      }
      return (Math.PI * 3) / 2;
    }

    return 0;
  }

  private rotationForDirection(direction: DirectionKey): number {
    switch (direction) {
      case 'right':
        return 0;
      case 'down':
        return Math.PI / 2;
      case 'left':
        return Math.PI;
      case 'up':
      default:
        return (Math.PI * 3) / 2;
    }
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
        this.applyContextualCameraZoom();
        this.emitRoomEntryEvent(nextRoom);
      }
      return;
    }

    if (this.currentRoomId !== null) {
      this.currentRoomId = null;
      this.player.setCurrentRoom(null);
      this.applyContextualCameraZoom();
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
    this.activeRoomObjects.forEach((obj) => obj.setVisible(!obj.isCollected()));
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
      const payload = nearest.object.collect();
      if (!payload) {
        return;
      }
      this.interactionCount += 1;
      this.emitRoomObjectInteraction(payload);
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
      ? `Press E to collect ${nearest.object.getPromptTitle()}`
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
      this.requestInteraction();
    }
  };

  private emitRoomObjectInteraction(payload: RoomObjectInteractionPayload): void {
    this.events.emit('roomObjectInteracted', payload);
  }

  private emitContributorInteraction(payload: ContributorInteractionPayload): void {
    this.events.emit('contributorInteracted', payload);
  }

  setVirtualDirection(direction: DirectionKey, isPressed: boolean): void {
    this.virtualDirectionState[direction] = isPressed;
  }

  clearVirtualDirections(): void {
    this.virtualDirectionState.up = false;
    this.virtualDirectionState.down = false;
    this.virtualDirectionState.left = false;
    this.virtualDirectionState.right = false;
  }

  requestInteraction(): void {
    this.pendingInteractionRequest = true;
  }

  setPreferredZoom(zoom: number): void {
    this.preferredCameraZoom = Phaser.Math.Clamp(zoom, CAMERA_BASE_ZOOM_MIN, CAMERA_BASE_ZOOM_MAX);
    this.applyContextualCameraZoom();
  }

  private applyContextualCameraZoom(immediate = false): void {
    const camera = this.cameras.main;
    const targetZoom = Phaser.Math.Clamp(this.resolveContextualZoom(), CAMERA_BASE_ZOOM_MIN, CAMERA_BASE_ZOOM_MAX);

    this.cameraZoomTween?.stop();
    this.cameraZoomTween = null;

    if (immediate || this.reducedMotion) {
      camera.setZoom(targetZoom);
      return;
    }

    this.cameraZoomTween = this.tweens.add({
      targets: camera,
      zoom: targetZoom,
      duration: 240,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.cameraZoomTween = null;
      },
    });
  }

  private resolveContextualZoom(): number {
    const currentRoom = this.currentRoomId ? this.roomById.get(this.currentRoomId) ?? null : null;
    if (!currentRoom) {
      return this.preferredCameraZoom * CAMERA_CORRIDOR_ZOOM_MULTIPLIER;
    }

    const availableWidth = Math.max(240, GAME_DIMENSIONS.width - CAMERA_ROOM_PADDING * 2);
    const availableHeight = Math.max(180, GAME_DIMENSIONS.height - CAMERA_ROOM_PADDING * 2);
    const fitZoom = Math.min(availableWidth / currentRoom.size.width, availableHeight / currentRoom.size.height);

    return fitZoom * this.preferredCameraZoom;
  }

  private isDirectionActive(direction: DirectionKey): boolean {
    if (!this.cursors) {
      return this.virtualDirectionState[direction];
    }

    return this.isAnyKeyDown(this.cursors[direction]) || this.virtualDirectionState[direction];
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

    for (const sprite of getAllPathwaySprites()) {
      this.load.image(sprite.textureKey, sprite.assetPath);
    }

    for (const sprite of getAllPlayerClassSprites()) {
      this.load.image(sprite.textureKey, sprite.assetPath);
    }

    for (const sprite of getAllNpcSprites()) {
      this.load.image(sprite.textureKey, sprite.assetPath);
    }

    this.load.image('sprite-player', '/assets/sprites/player.svg');
    this.load.image('sprite-door', '/assets/sprites/door.svg');
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

  private ensurePathwayPlaceholderTextures(): void {
    for (const sprite of getAllPathwaySprites()) {
      if (this.textures.exists(sprite.textureKey)) {
        continue;
      }

      const graphics = this.make.graphics();
      graphics.fillStyle(0xffffff, 0.3);

      switch (sprite.id) {
        case 'straight':
          graphics.fillRoundedRect(0, 7, 32, 18, 7);
          break;
        case 'corner':
          graphics.lineStyle(18, 0xffffff, 0.3);
          graphics.beginPath();
          graphics.moveTo(16, 25);
          graphics.lineTo(16, 16);
          graphics.lineTo(25, 16);
          graphics.strokePath();
          break;
        case 'end':
          graphics.lineStyle(18, 0xffffff, 0.3);
          graphics.beginPath();
          graphics.moveTo(16, 16);
          graphics.lineTo(27, 16);
          graphics.strokePath();
          break;
        case 'tee':
          graphics.lineStyle(18, 0xffffff, 0.3);
          graphics.beginPath();
          graphics.moveTo(7, 16);
          graphics.lineTo(25, 16);
          graphics.moveTo(16, 16);
          graphics.lineTo(16, 25);
          graphics.strokePath();
          break;
        case 'cross':
          graphics.lineStyle(18, 0xffffff, 0.3);
          graphics.beginPath();
          graphics.moveTo(7, 16);
          graphics.lineTo(25, 16);
          graphics.moveTo(16, 7);
          graphics.lineTo(16, 25);
          graphics.strokePath();
          break;
      }

      graphics.generateTexture(sprite.textureKey, sprite.width, sprite.height);
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

    for (const sprite of getAllPlayerClassSprites()) {
      if (this.textures.exists(sprite.textureKey)) {
        continue;
      }

      const graphics = this.make.graphics();
      graphics.fillStyle(0xcfd8dc, 1);
      graphics.fillCircle(12, 8, 6);
      graphics.fillStyle(0x5c6bc0, 1);
      graphics.fillRect(7, 15, 10, 9);
      graphics.generateTexture(sprite.textureKey, 24, 24);
      graphics.destroy();
    }

    for (const sprite of getAllNpcSprites()) {
      if (this.textures.exists(sprite.textureKey)) {
        continue;
      }

      const graphics = this.make.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(9, 7, 5);
      graphics.fillRect(6, 12, 6, 7);
      graphics.generateTexture(sprite.textureKey, 18, 18);
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
    const displayLabel = label.length > 22 ? `${label.slice(0, 19)}...` : label;
    const charW = 7.1;
    const boardPadX = 12;
    const boardPadY = 6;
    const boardH = 12 + boardPadY * 2;
    const boardW = Math.min(Math.max(displayLabel.length * charW + boardPadX * 2, 72), 196);
    const postH = 18;
    const postW = 4;

    const boardBottom = roomTopY - postH;
    const boardTop = boardBottom - boardH;
    const boardLeft = cx - boardW / 2;

    const g = this.add.graphics();
    g.setDepth(40);

    g.fillStyle(0x000000, 0.28);
    g.fillRect(cx - postW / 2 + 2, boardBottom + 2, postW, postH);

    g.fillStyle(accentColor, 0.78);
    g.fillRect(cx - postW / 2, boardBottom, postW, postH);
    g.fillRect(boardLeft + 6, boardBottom - 3, boardW - 12, 3);

    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(boardLeft + 3, boardTop + 3, boardW, boardH, 4);

    g.fillStyle(accentColor, 0.95);
    g.fillRoundedRect(boardLeft - 2, boardTop - 2, boardW + 4, boardH + 4, 5);

    g.fillStyle(0x101722, 0.97);
    g.fillRoundedRect(boardLeft, boardTop, boardW, boardH, 4);

    g.lineStyle(1, 0xf3e8c8, 0.22);
    g.strokeRoundedRect(boardLeft + 2, boardTop + 2, boardW - 4, boardH - 4, 3);

    this.add
      .text(cx, boardTop + boardH / 2, displayLabel, {
        color: '#fff2d6',
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(41);
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
    this.playerClassUnsubscribe?.();
    this.playerClassUnsubscribe = null;
    this.clearVirtualDirections();
    this.pendingInteractionRequest = false;
    this.cameraZoomTween?.stop();
    this.cameraZoomTween = null;
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
