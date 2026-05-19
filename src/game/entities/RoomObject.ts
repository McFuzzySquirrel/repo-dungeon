import Phaser from 'phaser';
import type { DungeonRoomNode } from '@/game/systems/dungeonTypes';
import { buildRoomObjectBlueprints, type RoomObjectBlueprint, type RoomObjectType } from '@/game/entities/roomContent';
import { getBiomePresentation } from '@/game/config/biomePresentation';

export interface RoomObjectInteractionPayload {
  roomId: string;
  roomName: string;
  objectType: RoomObjectType;
  title: string;
  description: string;
}

const ROOM_OBJECT_ICONS: Record<RoomObjectType, string> = {
  'readme-scroll': '📜',
  'file-tree-archive': '🗃',
  'contributors-gallery': '👥',
};

const ROOM_OBJECT_COLORS: Record<RoomObjectType, number> = {
  'readme-scroll': 0x8ad6ff,
  'file-tree-archive': 0xffc86a,
  'contributors-gallery': 0xb0f09b,
};

export class RoomObject extends Phaser.GameObjects.Container {
  private readonly interactionRadius: number;
  private readonly payload: RoomObjectInteractionPayload;
  private collected = false;

  constructor(
    scene: Phaser.Scene,
    blueprint: RoomObjectBlueprint,
    room: DungeonRoomNode,
    biomeId: string,
    reducedMotion: boolean,
  ) {
    super(scene, blueprint.x, blueprint.y);
    scene.add.existing(this);

    const presentation = getBiomePresentation(biomeId);
    const accentColor = ROOM_OBJECT_COLORS[blueprint.objectType];
    const glow = scene.add.circle(0, 0, 16, accentColor, 0.22);
    const base = scene.add.circle(0, 0, 12, presentation.palette.prop, 0.96);
    base.setStrokeStyle(2, presentation.palette.accent, 0.95);
    const highlight = scene.add.circle(-3, -3, 4, accentColor, 0.7);

    const icon = scene.add.text(0, -1, ROOM_OBJECT_ICONS[blueprint.objectType], {
      fontFamily: 'monospace',
      fontSize: '14px',
    });
    icon.setOrigin(0.5);

    const caption = scene.add.text(0, 16, 'Loot', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#d6e9ff',
    });
    caption.setOrigin(0.5);

    this.add([glow, base, highlight, icon, caption]);
    this.interactionRadius = 44;
    this.payload = {
      roomId: room.id,
      roomName: room.name,
      objectType: blueprint.objectType,
      title: blueprint.label,
      description: blueprint.description,
    };

    if (!reducedMotion) {
      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.12, to: 0.3 },
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  canInteractFrom(playerX: number, playerY: number): boolean {
    if (this.collected || !this.visible || !this.active) {
      return false;
    }
    return Phaser.Math.Distance.Between(playerX, playerY, this.x, this.y) <= this.interactionRadius;
  }

  getPromptTitle(): string {
    return this.payload.title;
  }

  isCollected(): boolean {
    return this.collected;
  }

  collect(): RoomObjectInteractionPayload | null {
    if (this.collected) {
      return null;
    }

    this.collected = true;
    this.setVisible(false);
    this.setActive(false);
    return this.payload;
  }

  static spawnForRoom(
    scene: Phaser.Scene,
    room: DungeonRoomNode,
    biomeId: string,
    reducedMotion: boolean,
  ): RoomObject[] {
    return buildRoomObjectBlueprints(room).map(
      (blueprint) => new RoomObject(scene, blueprint, room, biomeId, reducedMotion),
    );
  }
}
